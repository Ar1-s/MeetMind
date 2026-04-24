# MeetMind

MeetMind 是一个面向会议场景的 AI 协作系统，提供会议记录、录音导入、纪要生成、任务提取、OKR 管理、PPT 生成、思维导图、同声传译和日历联动等能力。

## 项目结构

这是一个 `pnpm monorepo`，主要包含 4 个包：

- `packages/shared`
  共享的 TypeScript 类型和 API Client
- `packages/web`
  Web 前端，基于 Next.js 16 + React 19
- `packages/api`
  后端服务，基于 FastAPI + SQLAlchemy Async + SQLite
- `packages/mobile`
  移动端，基于 Expo SDK 52 + React Native

## 核心能力

- 会议创建、编辑、删除、导入录音
- AI 自动转写与纪要生成
- 任务提取、任务看板、任务回放时间点跳转
- OKR / 项目管理
- 思维导图生成与编辑助手
- 一键生成 PPT / PDF
- 日历联动与会议安排
- 参会人员匿名化
- 中英等多语言识别与中文摘要

## 技术栈

### Web

- Next.js 16
- React 19
- Material UI
- Zustand

### Backend

- FastAPI
- SQLAlchemy Async
- aiosqlite
- Tongyi Qwen / DashScope

### Mobile

- Expo SDK 52
- React Native
- Expo Router

### Deployment

- Docker / Docker Compose

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动 Web

```bash
pnpm --filter ./packages/web dev
```

默认地址：

- Web: `http://localhost:3000`

### 3. 启动 API

```bash
cd packages/api
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 3452
```

默认地址：

- API: `http://localhost:3452`
- Docs: `http://localhost:3452/docs`

### 4. 启动移动端

```bash
pnpm --filter ./packages/mobile start
```

或：

```bash
cd packages/mobile
npx expo start
```

## Docker 部署

### 本地源码构建启动

```bash
./start-project.sh build
```

### 直接拉镜像启动

```bash
./start-project.sh pull
```

### 默认启动逻辑

```bash
./start-project.sh
```

默认规则：

- 如果 `.env` 中设置了 `MEETMIND_IMAGE`，则拉取镜像启动
- 否则按本地源码构建启动

## 运行所需环境变量

最少需要：

```env
DASHSCOPE_API_KEY=your-key
```

常用可选项：

```env
MEETMIND_WEB_PORT=3000
MEETMIND_API_PORT=3452
MEETMIND_IMAGE=docker.io/<your-user>/meetmind:latest
```

## 生产部署建议

- 小内存服务器建议优先使用“预构建镜像 + pull 部署”
- 本地构建适合调试或没有镜像仓库时使用
- 数据库与上传文件通过 Docker volumes 持久化

## 相关文档

- Linux 部署说明：`docs/linux-deploy.md`
- 干净打包说明：`PORTABLE_README.md`

