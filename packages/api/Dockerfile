FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    ffmpeg \
    git \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PATH="/opt/venv/bin:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/web/package.json packages/web/package.json
COPY packages/api/pyproject.toml packages/api/pyproject.toml
COPY packages/api/requirements.txt packages/api/requirements.txt

# The backend invokes Slidev from packages/web, so keep those runtime deps installed.
RUN pnpm install --frozen-lockfile --prod=false --filter ./packages/web...

COPY packages/shared packages/shared
COPY packages/web packages/web
COPY packages/api packages/api

RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/python -m pip install -U pip \
    && /opt/venv/bin/python -m pip install -e /app/packages/api

RUN pnpm -C /app/packages/web exec playwright install --with-deps chromium

WORKDIR /app/packages/api

EXPOSE 3452

CMD ["/opt/venv/bin/python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3452"]
