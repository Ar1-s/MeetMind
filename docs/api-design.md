# 5.7 接口设计

本文在 `docs/development-guide.md` 的 `5.7 接口设计` 基础上展开，补充外部接口的鉴权方式、请求/响应示例，以及内部模块的调用约定。

## 5.7.0 通用约定

### Base URL

- 前端同域代理：`/api/v1`
- 后端直连示例：`http://localhost:3452/api/v1`

### 鉴权说明

- 本文列出的 7 个外部业务接口均依赖 `packages/api/app/dependencies.py` 中的 `get_current_user`
- 调用时必须携带请求头：`Authorization: Bearer <access_token>`
- `access_token` 通过以下接口获取：
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
- Token 无效或过期时返回：

```json
{
  "detail": "Invalid or expired token"
}
```

- 缺少鉴权头时返回：

```json
{
  "detail": "Not authenticated"
}
```

### 登录示例

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "alice",
  "password": "Passw0rd!"
}
```

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx",
  "user": {
    "user_id": "usr_123",
    "username": "alice",
    "email": "alice@example.com",
    "display_name": "Alice",
    "avatar_url": null,
    "calendar_token": "0fcb7d2b0c4a..."
  }
}
```

### 通用错误码

| HTTP 状态码 | 含义 | 常见场景 |
| --- | --- | --- |
| `400` | 请求参数错误 | 缺少必填字段、文件格式不支持 |
| `401` | 未认证 / Token 无效 | 未传 `Authorization`、Token 过期 |
| `403` | 禁止访问 | 账号被禁用等 |
| `404` | 资源不存在 | 会议、录音、摘要、用户不存在 |
| `500` | 服务异常 | AI 调用失败、内部处理异常 |

## 5.7.1 外部接口

### 1. 创建会议

`POST /api/v1/meetings`

作用：创建会议元数据，为后续录音导入、分析、任务抽取、OKR 生成提供主记录。

请求头：

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | `string` | 是 | 会议标题 |
| `start_time` | `datetime` | 否 | 会议开始时间，ISO 8601 |
| `end_time` | `datetime` | 否 | 会议结束时间，ISO 8601 |
| `timezone` | `string` | 否 | 时区，默认 `Asia/Shanghai` |
| `participants` | `Participant[]` | 否 | 参会人列表 |
| `tags` | `string[]` | 否 | 标签 |
| `project_id` | `string \| null` | 否 | 关联项目 ID |
| `source` | `string` | 否 | 来源，默认 `manual` |

请求示例：

```json
{
  "title": "Q2 产品评审会",
  "start_time": "2026-03-24T10:00:00+08:00",
  "end_time": "2026-03-24T11:30:00+08:00",
  "timezone": "Asia/Shanghai",
  "participants": [
    {
      "name": "张三",
      "email": "zhangsan@example.com",
      "role": "PM"
    },
    {
      "name": "李四",
      "email": "lisi@example.com",
      "role": "Tech Lead"
    }
  ],
  "tags": ["产品", "Q2", "评审"],
  "source": "manual"
}
```

成功响应示例：`201 Created`

```json
{
  "id": "mtg_001",
  "title": "Q2 产品评审会",
  "start_time": "2026-03-24T10:00:00+08:00",
  "end_time": "2026-03-24T11:30:00+08:00",
  "timezone": "Asia/Shanghai",
  "participants": [
    {
      "name": "张三",
      "email": "zhangsan@example.com",
      "role": "PM"
    },
    {
      "name": "李四",
      "email": "lisi@example.com",
      "role": "Tech Lead"
    }
  ],
  "tags": ["产品", "Q2", "评审"],
  "project_id": null,
  "source": "manual",
  "created_by": "usr_123",
  "workspace_id": null,
  "created_at": "2026-03-24T10:00:01Z",
  "updated_at": "2026-03-24T10:00:01Z",
  "recordings": [],
  "summary": null
}
```

### 2. 获取会议列表

`GET /api/v1/meetings`

作用：按当前登录用户获取会议列表，支持分页和基础筛选。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `page` | `int` | 否 | `1` | 页码，最小 1 |
| `limit` | `int` | 否 | `20` | 每页条数，最大 100 |
| `tags` | `string` | 否 | - | 标签过滤，当前实现为字符串包含匹配 |
| `project_id` | `string` | 否 | - | 按项目过滤 |
| `search` | `string` | 否 | - | 标题模糊搜索 |

请求示例：

```http
GET /api/v1/meetings?page=1&limit=20&search=Q2&tags=产品
Authorization: Bearer <access_token>
```

成功响应示例：`200 OK`

```json
{
  "meetings": [
    {
      "id": "mtg_001",
      "title": "Q2 产品评审会",
      "start_time": "2026-03-24T10:00:00+08:00",
      "end_time": "2026-03-24T11:30:00+08:00",
      "participants_count": 2,
      "has_recording": true,
      "has_summary": true,
      "tags": ["产品", "Q2", "评审"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

### 3. 导入录音

`POST /api/v1/recordings/meetings/{meeting_id}/import`

作用：给指定会议上传音频文件，供后续分析使用。

请求头：

```http
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `file` | `file` | 是 | - | 音频文件 |
| `storage_preference` | `string` | 否 | `local` | 存储偏好 |

支持格式：`.mp3`、`.m4a`、`.wav`、`.aac`

请求示例：

```bash
curl -X POST "http://localhost:3452/api/v1/recordings/meetings/mtg_001/import" \
  -H "Authorization: Bearer <access_token>" \
  -F "file=@/path/to/demo.mp3" \
  -F "storage_preference=local"
```

成功响应示例：`200 OK`

```json
{
  "id": "rec_001",
  "meeting_id": "mtg_001",
  "type": "import",
  "storage": "local",
  "audio_uri": "/uploads/recordings/7c5317ab-2e0d-4f68.mp3",
  "duration": null,
  "file_size": 10485760,
  "status": "completed",
  "created_at": "2026-03-24T10:05:10Z",
  "imported_at": "2026-03-24T10:05:10Z"
}
```

失败响应示例：文件格式不支持

```json
{
  "detail": "Unsupported file format"
}
```

### 4. 启动分析

`POST /api/v1/meetings/{meeting_id}/analyze`

作用：异步启动会议分析流程，包括转写、摘要生成、风险/决策提取、任务自动创建、会议记忆更新。

请求体字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `recording_id` | `string` | 是 | 本次要分析的录音 ID |

请求示例：

```json
{
  "recording_id": "rec_001"
}
```

成功响应示例：`200 OK`

```json
{
  "analysis_id": "analysis_mtg_001",
  "status": "processing",
  "message": "分析已开始"
}
```

关联轮询接口：

- `GET /api/v1/analysis/{analysis_id}/status`

轮询响应示例：

```json
{
  "status": "processing",
  "progress": 70,
  "message": "正在生成纪要和行动项...",
  "stage": "summarize",
  "steps": [
    {
      "label": "准备",
      "progress": 100
    },
    {
      "label": "转写",
      "progress": 100
    },
    {
      "label": "生成纪要",
      "progress": 70
    },
    {
      "label": "保存",
      "progress": 0
    },
    {
      "label": "创建任务",
      "progress": 0
    },
    {
      "label": "完成",
      "progress": 0
    }
  ],
  "eta_seconds": 18
}
```

说明：

- 当前实现中，启动分析接口本身要求鉴权
- 关联的状态轮询接口 `GET /api/v1/analysis/{analysis_id}/status` 目前未挂 `get_current_user`，如果作为正式对外接口，建议补齐鉴权和资源归属校验

### 5. 获取任务看板

`GET /api/v1/tasks/board`

作用：返回当前用户任务列表和聚合统计信息，可用于看板页、列表页、会议详情侧边任务区。

请求参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `view` | `string` | 否 | `kanban` | 视图类型，当前实现接收但不影响返回结构 |
| `assignee` | `string` | 否 | - | 按负责人过滤 |
| `status` | `string` | 否 | - | 按任务状态过滤 |
| `priority` | `string` | 否 | - | 按优先级过滤 |
| `meeting_id` | `string` | 否 | - | 按来源会议过滤 |

请求示例：

```http
GET /api/v1/tasks/board?status=todo&priority=high&meeting_id=mtg_001
Authorization: Bearer <access_token>
```

成功响应示例：`200 OK`

```json
{
  "tasks": [
    {
      "id": "task_001",
      "title": "整理发布需求清单",
      "description": "From Meeting Summary",
      "assignee": "张三",
      "due_date": "2026-03-26",
      "priority": "high",
      "status": "todo",
      "source_meeting": {
        "meeting_id": "mtg_001",
        "title": "Q2 产品评审会",
        "date": "2026-03-24"
      },
      "key_result_id": "kr_001",
      "okr": {
        "project_id": "proj_001",
        "project_name": "Q2 产品推进",
        "objective_id": "obj_001",
        "objective_title": "完成核心能力上线",
        "key_result_id": "kr_001",
        "key_result_title": "完成发布流程梳理",
        "progress": 30.0
      },
      "source_segment_start": 120,
      "source_segment_end": 185,
      "created_at": "2026-03-24T10:20:00Z",
      "updated_at": "2026-03-24T10:20:00Z",
      "completed_at": null
    }
  ],
  "statistics": {
    "total_tasks": 12,
    "todo_count": 5,
    "in_progress_count": 4,
    "done_count": 3,
    "overdue_count": 1
  }
}
```

### 6. 从会议生成项目 / OKR

`POST /api/v1/projects/from-meeting`

作用：基于会议摘要调用 AI 生成项目、Objective、Key Result，并尝试把会议任务关联到 KR。

前置条件：

- 会议存在且归属于当前用户
- 该会议已经完成分析并生成 `summary`

请求示例：

```json
{
  "meeting_id": "mtg_001"
}
```

成功响应示例：`201 Created`

```json
{
  "id": "proj_001",
  "name": "Q2 产品推进",
  "description": "围绕 Q2 核心能力上线形成执行计划与衡量指标",
  "status": "active",
  "start_date": null,
  "end_date": null,
  "progress": 0.0,
  "objectives": [
    {
      "id": "obj_001",
      "project_id": "proj_001",
      "title": "完成核心能力上线准备",
      "description": "围绕需求、研发、验收三条线推进",
      "status": "on_track",
      "progress": 0.0,
      "key_results": [
        {
          "id": "kr_001",
          "objective_id": "obj_001",
          "title": "输出正式发布清单",
          "current_value": 0.0,
          "target_value": 1.0,
          "unit": null,
          "status": "on_track",
          "progress": 0.0,
          "created_at": "2026-03-24T10:30:00Z",
          "updated_at": "2026-03-24T10:30:00Z"
        }
      ],
      "created_at": "2026-03-24T10:30:00Z",
      "updated_at": "2026-03-24T10:30:00Z"
    }
  ],
  "created_at": "2026-03-24T10:30:00Z",
  "updated_at": "2026-03-24T10:30:00Z"
}
```

失败响应示例：会议未完成分析

```json
{
  "detail": "Summary not found"
}
```

说明：

- AI 生成 OKR 失败时，当前实现会使用摘要和行动项构造兜底项目结构，而不是直接失败

### 7. 获取日历事件

`GET /api/v1/calendar/events`

作用：汇总指定时间范围内的会议与任务，输出统一事件流，供日历视图展示。

请求参数：

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `start_date` | `datetime` | 是 | 起始时间，ISO 8601 |
| `end_date` | `datetime` | 是 | 截止时间，ISO 8601 |

请求示例：

```http
GET /api/v1/calendar/events?start_date=2026-03-24T00:00:00Z&end_date=2026-03-31T23:59:59Z
Authorization: Bearer <access_token>
```

成功响应示例：`200 OK`

```json
[
  {
    "id": "meeting_mtg_001",
    "title": "会议: Q2 产品评审会",
    "start": "2026-03-24T10:00:00+08:00",
    "end": "2026-03-24T11:30:00+08:00",
    "all_day": false,
    "type": "meeting",
    "status": "scheduled",
    "metadata": {
      "original_id": "mtg_001",
      "has_recording": true,
      "has_summary": true
    }
  },
  {
    "id": "task_task_001",
    "title": "任务: 整理发布需求清单 · OKR 30%",
    "start": "2026-03-26T00:00:00Z",
    "end": "2026-03-27T00:00:00Z",
    "all_day": true,
    "type": "task",
    "status": "todo",
    "metadata": {
      "original_id": "task_001",
      "assignee": "张三",
      "priority": "high",
      "okr": {
        "project_id": "proj_001",
        "project_name": "Q2 产品推进",
        "objective_id": "obj_001",
        "objective_title": "完成核心能力上线",
        "key_result_id": "kr_001",
        "key_result_title": "完成发布流程梳理",
        "progress": 30.0
      }
    }
  }
]
```

## 5.7.2 内部接口

内部接口这里指 Python 服务层与工具层之间的模块边界，不是 HTTP 对外 API。建议在实现和评审时按“输入/输出契约”理解，而不是只把它们当文件目录。

### 1. `services/ai_analysis.py`

作用：统一会议分析流程，封装转写、摘要生成和任务提取能力。

关键函数：

| 函数 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| `transcribe_audio(audio_path)` | 音频路径 | 转写结果 `dict` | 调用当前 AI 服务做语音转写 |
| `generate_summary(transcript)` | 转写片段 `list[dict]` | 摘要 `dict` | 生成摘要、决策、风险、行动项、导图 |
| `analyze_meeting(recording_id, audio_path, existing_transcript=None)` | 录音 ID、音频路径、可选已有转写 | 标准分析结果 `dict` | 完整分析编排入口 |
| `get_meeting_tasks(meeting_id, db)` | 会议 ID、数据库会话 | `list[dict]` | 从摘要中提取任务，或构造兜底任务 |

标准输出示例：

```json
{
  "summary": {
    "abstract": "会议围绕 Q2 产品上线计划展开，明确了发布清单与验收责任。",
    "decisions": [
      "本周内完成发布清单评审"
    ],
    "risks": [
      "验收标准尚未最终确认"
    ],
    "action_items": [
      {
        "title": "整理发布需求清单",
        "assignee": "张三",
        "due_date": "2026-03-26",
        "priority": "high"
      }
    ],
    "mindmap": {
      "type": "reactflow",
      "nodes": []
    },
    "transcript": [
      {
        "speaker": "Speaker 1",
        "start": 0,
        "end": 12,
        "text": "今天先确认 Q2 发布目标。"
      }
    ]
  },
  "model_version": "configured-model",
  "analyzed_at": "2026-03-24T10:10:00Z"
}
```

调用关系：

- `routes/analysis.py` 中的 `run_analysis()` 调用 `analyze_meeting()`
- 分析完成后由路由层负责写入 `Summary`、`MeetingMemory` 和自动任务

### 2. `services/slidev.py`

作用：负责会议纪要到 Slidev/PPT 资源的生成与导出。

关键函数：

| 函数 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| `generate_slidev_markdown(meeting_title, meeting_time, summary, transcript)` | 会议标题、时间、摘要、转写 | `str` | 生成 Slidev Markdown，AI 失败时自动回退到模板方案 |
| `build_slidev_assets(...)` | 会议 ID、会议信息、摘要、转写、主题等 | `dict[str, str]` | 生成 `slides.md`、HTML、导出文件及日志 |

资源输出位置：

- `packages/api/app/uploads/slides/<meeting_id>/slides.md`
- `packages/api/app/uploads/slides/<meeting_id>/dist/`
- `packages/api/app/uploads/slides/<meeting_id>/exports/`
- `packages/api/app/uploads/slides/<meeting_id>/build.log`

调用特征：

- 先生成或回退生成 Markdown
- 再处理主题、背景、依赖和构建命令
- 最终产出 HTML/PDF/PPTX 等文件资产

### 3. `services/agent_service.py`

作用：智能助手编排层，负责把用户自然语言请求转换为工具调用，再把工具结果整理成前端可消费的消息与组件数据。

核心入口：

| 方法 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- |
| `AgentService.chat(...)` | 用户消息、历史消息、会话 ID、用户 ID、Agent 配置 | `dict` | 助手主循环，最多执行 5 轮工具调用 |
| `_build_system_prompt(tools_schema, agent)` | 工具 Schema、Agent 定义 | `str` | 构造大模型系统提示词 |
| `_parse_tool_call(content)` | 模型输出文本 | `dict \| None` | 解析 JSON 工具调用 |

工具调用协议：

```json
{
  "tool": "query_tasks",
  "parameters": {
    "status": "todo",
    "limit": 10
  }
}
```

工具标准返回协议：

```json
{
  "success": true,
  "message": "找到 3 个任务",
  "data": {
    "tasks": [
      {
        "id": "task_001",
        "title": "整理发布需求清单",
        "status": "todo"
      }
    ]
  }
}
```

说明：

- `AgentService` 会把 `user_id` 透传给工具层，保证工具查询按用户隔离
- 工具成功时，编排层会按数据类型组装成 `task_list`、`meeting_list`、`calendar`、`project` 等组件输出

### 4. `tools/*`

作用：为助手提供工具化能力，是 LLM 调用业务能力的统一适配层。

当前目录：

- `meetings.py`
- `tasks.py`
- `projects.py`
- `calendar_tools.py`
- `analysis_tools.py`
- `slides.py`
- `mindmap.py`
- `memory_tools.py`
- `integrations.py`
- `translate_tool.py`

统一接口约束：

- 继承 `BaseTool`
- 必须声明：
  - `name`
  - `description`
  - `args_schema`
  - `async def run(...)`
- 通过 `ToolRegistry.register()` 注册，供 `AgentService` 读取 Schema

基础抽象示意：

```python
class BaseTool(ABC):
    name: str
    description: str

    @property
    @abstractmethod
    def args_schema(self) -> Type[BaseModel]:
        pass

    @abstractmethod
    async def run(self, **kwargs) -> Dict[str, Any]:
        pass
```

典型工具能力：

| 模块 | 代表能力 |
| --- | --- |
| `tools/meetings.py` | 创建会议、搜索会议、触发分析 |
| `tools/tasks.py` | 导入任务、查询任务、创建/更新/完成任务 |
| `tools/projects.py` | 创建项目、查看项目、从会议生成 OKR |
| `tools/calendar_tools.py` | 查询时间范围内日程、生成 ICS 下载链接 |
| `tools/analysis_tools.py` | 启动分析、查询分析状态、导出摘要 |

推荐的内部分层关系：

```text
routes/* -> services/* -> models/*
assistant -> services/agent_service.py -> tools/* -> services/* / models/*
```

## 5.7.3 设计备注

- 外部接口整体已经具备“会议创建 -> 录音导入 -> 启动分析 -> 任务/OKR/日历消费”的闭环
- 若作为正式对外 API 发布，建议补齐：
  - `analysis status` 的鉴权校验
  - 更统一的错误响应结构
  - OpenAPI 示例与字段枚举说明
  - 异步任务状态的标准化字段定义
