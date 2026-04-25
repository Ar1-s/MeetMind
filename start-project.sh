#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
COMPOSE_BUILD_FILE="$ROOT_DIR/docker-compose.build.yml"
WEB_PORT="${MEETMIND_WEB_PORT:-3000}"
API_PORT="${MEETMIND_API_PORT:-3452}"
MODE="${1:-start}"
DEFAULT_WEB_IMAGE_PLACEHOLDER="meetmind-web:latest"
DEFAULT_API_IMAGE_PLACEHOLDER="meetmind-api:latest"
COMPOSE_PARALLEL_LIMIT_VALUE="${MEETMIND_COMPOSE_PARALLEL_LIMIT:-1}"

print_usage() {
  cat <<'EOF'
MeetMind Linux Launcher

Usage:
  ./start-project.sh            Start the stack (pull images if MEETMIND_WEB_IMAGE and MEETMIND_API_IMAGE are set, otherwise build locally)
  ./start-project.sh start      Same as default
  ./start-project.sh pull       Pull images from registry and start
  ./start-project.sh build      Build from local source and start
  ./start-project.sh stop       Stop the production Docker stack
  ./start-project.sh restart    Restart using the same strategy as start
  ./start-project.sh logs       Follow container logs

Environment:
  MEETMIND_WEB_PORT             Public web port (default: 3000)
  MEETMIND_API_PORT             Public API port (default: 3452)
  MEETMIND_WEB_IMAGE            Registry image tag for the web container
  MEETMIND_API_IMAGE            Registry image tag for the API container
  MEETMIND_COMPOSE_PARALLEL_LIMIT  Limit concurrent service builds (default: 1)
EOF
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required but was not found."
    exit 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose v2 is required but was not found."
    exit 1
  fi
}

require_env_file() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    cat <<'EOF'
Missing .env file at the repository root.
Create it first and include at least:
  DASHSCOPE_API_KEY=your-key

Optional runtime ports:
  MEETMIND_WEB_PORT=3000
  MEETMIND_API_PORT=3452
EOF
    exit 1
  fi
}

run_compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

run_build_compose() {
  COMPOSE_PARALLEL_LIMIT="$COMPOSE_PARALLEL_LIMIT_VALUE" \
    docker compose -f "$COMPOSE_FILE" -f "$COMPOSE_BUILD_FILE" "$@"
}

read_env_value() {
  local key="$1"

  if [[ -n "${!key:-}" ]]; then
    printf '%s' "${!key}"
    return
  fi

  if [[ -f "$ROOT_DIR/.env" ]]; then
    local line
    line="$(grep -E "^${key}=" "$ROOT_DIR/.env" | tail -n1 || true)"
    if [[ -n "$line" ]]; then
      line="${line#*=}"
      line="${line%\"}"
      line="${line#\"}"
      printf '%s' "$line"
      return
    fi
  fi

  printf ''
}

has_registry_images() {
  local web_image api_image
  web_image="$(read_env_value "MEETMIND_WEB_IMAGE")"
  api_image="$(read_env_value "MEETMIND_API_IMAGE")"

  [[ -n "$web_image" && -n "$api_image" && "$web_image" != "$DEFAULT_WEB_IMAGE_PLACEHOLDER" && "$api_image" != "$DEFAULT_API_IMAGE_PLACEHOLDER" ]]
}

start_from_registry() {
  run_compose pull
  run_compose up -d
}

start_from_local_build() {
  run_build_compose up -d --build
}

start_default() {
  if has_registry_images; then
    start_from_registry
  else
    start_from_local_build
  fi
}

print_endpoints() {
  echo
  echo "MeetMind is running."
  echo "Web: http://<server-ip>:$WEB_PORT"
  echo "API: http://<server-ip>:$API_PORT"
  echo "Docs: http://<server-ip>:$API_PORT/docs"
  echo
  echo "Use './start-project.sh logs' to view container logs."
}

case "$MODE" in
  start)
    require_docker
    require_env_file
    start_default
    print_endpoints
    ;;
  pull)
    require_docker
    require_env_file
    if ! has_registry_images; then
      echo "MEETMIND_WEB_IMAGE and MEETMIND_API_IMAGE must both be set in .env before using pull mode."
      exit 1
    fi
    start_from_registry
    print_endpoints
    ;;
  build)
    require_docker
    require_env_file
    start_from_local_build
    print_endpoints
    ;;
  stop)
    require_docker
    run_compose down
    ;;
  restart)
    require_docker
    require_env_file
    run_compose down
    start_default
    print_endpoints
    ;;
  logs)
    require_docker
    run_compose logs -f
    ;;
  -h|--help|help)
    print_usage
    ;;
  *)
    echo "Unknown command: $MODE"
    echo
    print_usage
    exit 1
    ;;
esac
