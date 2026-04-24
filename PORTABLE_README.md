MeetMind clean package

This package is prepared for fresh deployment and excludes local runtime data.

Excluded from this package:
- local databases
- uploaded recordings and generated slides
- logs, caches, temp files, and build outputs
- local environment files containing real secrets

Included as empty initial directories:
- packages/api/app/data
- packages/api/app/uploads/recordings
- packages/api/app/uploads/slides

Before first start:
1. Copy `.env.example` to `.env` in the project root.
2. Fill in your Tongyi Qwen / DashScope key.
3. If needed, copy `packages/api/.env.ai.example` or `packages/api/.env.example` as a reference for backend-only configuration.

Recommended startup:
- Docker: `docker compose -f docker-compose.prod.yml up -d --build`
- Linux helper script: `./start-project.sh`
