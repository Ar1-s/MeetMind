#!/bin/bash
# 启动后端 API 服务

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

kill_port() {
  local port="$1"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti tcp:"$port" 2>/dev/null | sort -u)
  elif command -v fuser >/dev/null 2>&1; then
    pids=$(fuser -n tcp "$port" 2>/dev/null | tr ' ' '\n' | sort -u)
  fi

  if [ -n "$pids" ]; then
    echo "[API] 端口 $port 被占用，正在终止进程: $pids"
    kill -15 $pids >/dev/null 2>&1 || true
    sleep 1
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

# 查找可用的 Python (>= 3.9)，优先用高版本
find_python() {
  for ver in 3.12 3.11 3.10 3.9; do
    # Homebrew (Apple Silicon)
    local brew_py="/opt/homebrew/opt/python@${ver}/bin/python${ver}"
    if [ -x "$brew_py" ]; then
      echo "$brew_py"
      return
    fi
    # Homebrew (Intel Mac)
    local brew_py_intel="/usr/local/opt/python@${ver}/bin/python${ver}"
    if [ -x "$brew_py_intel" ]; then
      echo "$brew_py_intel"
      return
    fi
    # PATH 中的
    local path_py
    path_py=$(command -v "python${ver}" 2>/dev/null)
    if [ -n "$path_py" ]; then
      echo "$path_py"
      return
    fi
  done
  # 回退到 python3
  command -v python3 2>/dev/null
}

PYTHON_BIN=$(find_python)
if [ -z "$PYTHON_BIN" ]; then
  echo "[API] 错误: 未找到 Python，请安装 Python 3.9+"
  exit 1
fi

PY_VERSION=$("$PYTHON_BIN" --version 2>&1)
echo "[API] 使用 Python: $PYTHON_BIN ($PY_VERSION)"

# 检测 venv 是否存在且可用
NEED_RECREATE=false
if [ ! -d "venv" ]; then
  NEED_RECREATE=true
elif [ ! -f "venv/bin/python" ] || ! venv/bin/python --version &>/dev/null; then
  echo "[API] 检测到虚拟环境损坏，重建..."
  rm -rf venv
  NEED_RECREATE=true
fi

if [ "$NEED_RECREATE" = true ]; then
  echo "[API] 创建 Python 虚拟环境..."
  "$PYTHON_BIN" -m venv venv
  if [ $? -ne 0 ]; then
    echo "[API] 错误: 创建虚拟环境失败"
    echo "  请手动运行: $PYTHON_BIN -m venv packages/api/venv"
    exit 1
  fi
  echo "[API] 安装 Python 依赖..."
  venv/bin/pip install -q --upgrade pip
  venv/bin/pip install -q -r requirements.txt
  venv/bin/pip install -q -e .
fi

# 检查依赖是否已安装
if ! venv/bin/python -c "import fastapi" 2>/dev/null; then
  echo "[API] 安装 Python 依赖..."
  venv/bin/pip install -q -r requirements.txt
  venv/bin/pip install -q -e .
fi

# --setup-only: 仅安装依赖，不启动服务
if [ "$1" = "--setup-only" ]; then
  echo "[API] 依赖安装完成"
  exit 0
fi

kill_port 3452
echo "[API] 启动 FastAPI 服务 → http://localhost:3452"
echo "[API] API 文档 → http://localhost:3452/docs"
exec venv/bin/python -m uvicorn app.main:app --reload --port 3452
