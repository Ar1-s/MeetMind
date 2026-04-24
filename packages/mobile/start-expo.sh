#!/bin/bash

set -e

PORT="${EXPO_DEV_PORT:-8081}"

kill_port() {
  local port="$1"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti tcp:"$port" 2>/dev/null | sort -u)
  elif command -v fuser >/dev/null 2>&1; then
    pids=$(fuser -n tcp "$port" 2>/dev/null | tr ' ' '\n' | sort -u)
  fi

  if [ -n "$pids" ]; then
    echo "[Expo] 端口 $port 被占用，正在终止进程: $pids"
    kill -15 $pids >/dev/null 2>&1 || true
    sleep 1
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

kill_port "$PORT"
exec expo start --clear --port "$PORT" "$@"
