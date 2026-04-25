FROM node:20-slim AS web-build

ARG PNPM_FILTER=./packages/web...
ARG PNPM_NETWORK_CONCURRENCY=4
ARG PNPM_CHILD_CONCURRENCY=2
ARG NODE_MAX_OLD_SPACE_SIZE=768

ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/

RUN corepack enable \
    && pnpm install \
      --filter "${PNPM_FILTER}" \
      --frozen-lockfile \
      --network-concurrency=${PNPM_NETWORK_CONCURRENCY} \
      --child-concurrency=${PNPM_CHILD_CONCURRENCY}

COPY . .

ENV INTERNAL_API_URL=http://api:3452/api
ENV INTERNAL_API_URL_UPLOADS=http://api:3452
ENV NEXT_PUBLIC_PROD_API_PATH=/api

RUN NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}" pnpm --filter ./packages/web build


FROM node:20-slim AS web-runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV INTERNAL_API_URL=http://api:3452/api
ENV INTERNAL_API_URL_UPLOADS=http://api:3452
ENV NEXT_PUBLIC_PROD_API_PATH=/api

WORKDIR /app

COPY --from=web-build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=web-build /app/node_modules ./node_modules
COPY --from=web-build /app/packages/shared ./packages/shared
COPY --from=web-build /app/packages/web ./packages/web

RUN corepack enable

EXPOSE 3000

CMD ["pnpm", "-C", "/app/packages/web", "start"]


FROM python:3.11-slim AS api-runtime

ARG DEBIAN_MIRROR=http://deb.debian.org/debian
ARG DEBIAN_SECURITY_MIRROR=http://deb.debian.org/debian-security

ENV PYTHONUNBUFFERED=1

RUN set -eux; \
    export DEBIAN_FRONTEND=noninteractive; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i "s|URIs: .*deb.debian.org/debian|URIs: ${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
      sed -i "s|URIs: .*deb.debian.org/debian-security|URIs: ${DEBIAN_SECURITY_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    fi; \
    success=''; \
    for attempt in 1 2 3 4 5; do \
      rm -rf /var/lib/apt/lists/*; \
      if apt-get update -o Acquire::Retries=5 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 \
        && apt-get install -y --no-install-recommends ffmpeg; then \
        success=1; \
        break; \
      fi; \
      echo "apt install attempt ${attempt} failed, retrying..." >&2; \
      sleep $((attempt * 5)); \
    done; \
    if [ -z "$success" ]; then \
      echo "apt dependencies could not be installed after retries" >&2; \
      exit 1; \
    fi; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY packages/api /app/packages/api

RUN python -m pip install --no-cache-dir -U pip \
    && python -m pip install --no-cache-dir /app/packages/api

WORKDIR /app/packages/api

EXPOSE 3452

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3452"]
