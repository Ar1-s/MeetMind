# MeetMind Linux Deployment

## Recommended approach

Use Docker on the Linux server. The repository now includes:

- `Dockerfile`
- `docker-compose.prod.yml`
- `docker-compose.build.yml`
- `start-project.sh`

The production stack now runs as **two containers**:

- `api`: FastAPI backend
- `web`: Next.js frontend

This reduces single-image build pressure and makes pull-based deployment lighter on low-memory servers.

`start-project.sh` supports both deployment styles:

- pull images from Docker Hub / registry
- build locally from source

## Prerequisites

- Docker
- Docker Compose v2
- A copied repository on the server

## 1. Create the runtime environment file

Create `.env` at the repository root and include at least:

```env
DASHSCOPE_API_KEY=your-qwen-key

# Optional public ports
MEETMIND_WEB_PORT=3000
MEETMIND_API_PORT=3452
```

If you already use a reverse proxy such as Nginx or Caddy, keeping the defaults is fine.

## 2. Choose a deployment strategy

### Option A: Deploy from Docker Hub or another registry

Add this to `.env`:

```env
MEETMIND_WEB_IMAGE=docker.io/<your-dockerhub-user>/meetmind-web:latest
MEETMIND_API_IMAGE=docker.io/<your-dockerhub-user>/meetmind-api:latest
```

Then start:

```bash
chmod +x start-project.sh
./start-project.sh pull
```

This will:

- pull the published web and API images
- start the frontend and backend as separate containers
- persist SQLite data and uploaded files through the API container volume mounts

### Option B: Build directly on the server from source

```bash
chmod +x start-project.sh
./start-project.sh build
```

This will:

- build the web and API images separately on the server
- start the frontend and backend as separate containers
- persist SQLite data and uploaded files through Docker volumes

If your network has trouble reaching the default Debian sources during image build, you can optionally add to `.env`:

```env
DEBIAN_MIRROR=http://deb.debian.org/debian
DEBIAN_SECURITY_MIRROR=http://deb.debian.org/debian-security
```

If the server has very low memory (for example 2 GB), you can also lower build pressure:

```env
MEETMIND_COMPOSE_PARALLEL_LIMIT=1
PNPM_FILTER=./packages/web...
PNPM_NETWORK_CONCURRENCY=1
PNPM_CHILD_CONCURRENCY=1
NODE_MAX_OLD_SPACE_SIZE=512
```

This reduces:

- concurrent service builds
- pnpm install concurrency
- Next.js build heap size

### Default mode

```bash
./start-project.sh
```

Default behavior:

- if both `MEETMIND_WEB_IMAGE` and `MEETMIND_API_IMAGE` are set, it pulls from the registry
- otherwise, it builds locally from source

## 3. Check logs

```bash
./start-project.sh logs
```

## 4. Stop the stack

```bash
./start-project.sh stop
```

## Public endpoints

- Web: `http://<server-ip>:3000`
- API: `http://<server-ip>:3452`
- API docs: `http://<server-ip>:3452/docs`

If you set `MEETMIND_WEB_PORT` or `MEETMIND_API_PORT`, replace the ports above with your values.

## Notes

- The API container includes `ffmpeg`, so long-audio slicing and transcription can run on Linux too.
- Uploaded recordings, generated PPT assets, and SQLite data are persisted through Docker volumes.
- `docker-compose.prod.yml` is registry-friendly. `docker-compose.build.yml` is only needed when building from source.
