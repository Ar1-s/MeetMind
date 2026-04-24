# MeetMind API

MeetMind API 是项目的后端服务，基于 FastAPI 构建，负责会议、任务、日历、录音、纪要、PPT、思维导图、项目与 OKR 等业务能力。

## 技术栈

- FastAPI
- SQLAlchemy Async
- SQLite / aiosqlite
- Tongyi Qwen / DashScope

## 本地启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 3452
```

## API 文档

启动后可访问：

- Swagger UI: `http://localhost:3452/docs`
- ReDoc: `http://localhost:3452/redoc`

## 主要目录

- `app/routes`
  API 路由层
- `app/services`
  业务服务层
- `app/models`
  数据模型与数据库初始化
- `app/schemas`
  Pydantic 模型
- `app/tools`
  Agent / Tool Calling 相关工具

## 运行配置

建议通过环境变量或 `.env` 提供至少以下配置：

```env
AI_PROVIDER=qwen
DASHSCOPE_API_KEY=your-key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
QWEN_CHAT_MODEL=qwen-plus
QWEN_TRANSCRIPTION_MODEL=qwen3-asr-flash
```

如果服务器需要处理长音频切片，可额外配置：

```env
FFMPEG_PATH=
FFPROBE_PATH=
```

