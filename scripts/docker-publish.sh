#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_PREFIX="${1:-${MEETMIND_IMAGE_PREFIX:-}}"
PLATFORMS="${MEETMIND_IMAGE_PLATFORMS:-linux/amd64}"
BUILDER_NAME="${MEETMIND_BUILDX_BUILDER:-meetmind-builder}"

if [[ -z "$IMAGE_PREFIX" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/docker-publish.sh docker.io/<your-user>/meetmind

This publishes:
  docker.io/<your-user>/meetmind-web:latest
  docker.io/<your-user>/meetmind-api:latest

Or set:
  MEETMIND_IMAGE_PREFIX=docker.io/<your-user>/meetmind
EOF
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found."
  exit 1
fi

if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
  docker buildx create --name "$BUILDER_NAME" --use
else
  docker buildx use "$BUILDER_NAME"
fi

docker buildx build \
  --platform "$PLATFORMS" \
  --target web-runtime \
  -t "${IMAGE_PREFIX}-web:latest" \
  --push \
  "$ROOT_DIR"

docker buildx build \
  --platform "$PLATFORMS" \
  --target api-runtime \
  -t "${IMAGE_PREFIX}-api:latest" \
  --push \
  "$ROOT_DIR"
