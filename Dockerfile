FROM node:20-slim AS build

ARG DEBIAN_MIRROR=http://deb.debian.org/debian
ARG DEBIAN_SECURITY_MIRROR=http://deb.debian.org/debian-security

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
        && apt-get install -y --no-install-recommends \
          ca-certificates python3 python3-venv python3-pip build-essential ffmpeg; then \
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

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
COPY packages/mobile/package.json packages/mobile/
COPY packages/api/pyproject.toml packages/api/requirements.txt packages/api/

RUN corepack enable && pnpm install --no-frozen-lockfile

COPY . .

ENV INTERNAL_API_URL=http://localhost:3452/api
ENV INTERNAL_API_URL_UPLOADS=http://localhost:3452/uploads
ENV NEXT_PUBLIC_PROD_API_PATH=/api

RUN pnpm --filter ./packages/web build


FROM build AS runtime

ENV INTERNAL_API_URL=http://localhost:3452/api
ENV INTERNAL_API_URL_UPLOADS=http://localhost:3452/uploads
ENV NEXT_PUBLIC_PROD_API_PATH=/api
ENV NEXT_TELEMETRY_DISABLED=1
ENV PYTHONUNBUFFERED=1

RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/python -m pip install --no-cache-dir -U pip \
    && /opt/venv/bin/python -m pip install --no-cache-dir -e /app/packages/api

ENV PATH="/opt/venv/bin:$PATH"
ENV NODE_ENV=production

EXPOSE 3000 3452

CMD ["bash", "-c", "cd /app/packages/api && /opt/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 3452 & HOSTNAME=0.0.0.0 PORT=3000 pnpm -C /app/packages/web start & wait -n"]
