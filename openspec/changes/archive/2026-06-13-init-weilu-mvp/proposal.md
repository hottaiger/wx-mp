## Why

用户需要一个低摩擦的随手记工具来沉淀三类信息——人、事、物——并让它们可关联、可回溯。现有方案（备忘录/便签/Notion）把人/事/物割裂在扁平文本里，缺乏实体化建模和关联能力，且不支持语音快速录入和基于时间的提醒。本 change 在微信小程序内构建一个**实体化的**随手记系统，从云开发 quickstart 模板起步，建立可扩展的数据模型与基础能力。

## What Changes

- 新增「微录」小程序产品：替换云开发 quickstart 模板的示例页面
- 引入三大核心实体模型：`person`（人）、`event`（事）、`item`（物），分别带属性 schema
- 新增 `relation`（关联）模型：连接任意两个实体，支持类型化关系（参与、涉及、属于、朋友等）
- 新增文字录入入口（首页快速输入）
- 新增时间维度提醒：相对时间（N 分钟后/明天/指定日期）通过微信订阅消息触发
- 新增周复盘页：聚合本周事件，统计会议类事件总时长与频次
- 数据存储在微信云开发数据库（`wx.cloud.database`），鉴权走微信原生 openid
- 商业化与人脉图谱、语音录入、AI 实体抽取在 v2 引入，本 change 不包含

## Capabilities

### New Capabilities

- `person-entity`: 人物实体的 CRUD、属性管理（姓名、性格特点、标签、备注）
- `event-entity`: 事件实体的 CRUD、属性管理（标题、发生时间、时长、类型、描述）
- `item-entity`: 物品实体的 CRUD、属性管理（名称、购买时间、属性、备注）
- `entity-relation`: 实体间关联的创建、查询、删除，支持双向遍历
- `quick-capture`: 文字快速录入入口，提交后落到对应实体集合
- `time-reminder`: 基于事件的相对/绝对时间提醒，通过微信订阅消息发送
- `weekly-review`: 周维度事件聚合，输出会议总时长、事项计数等统计
- `cloud-data-layer`: 微信云开发数据访问封装（鉴权、CRUD 基类、错误处理）

### Modified Capabilities

无

## Impact

- **代码**：替换 `miniprogram/pages/index/index`、`miniprogram/pages/example/index` 的示例内容，新增 pages（`capture`、`weekly-review`、`detail` 等）
- **配置**：`miniprogram/app.json` 的 `pages` 列表、`navigationBarTitleText`、`window` 主题
- **云函数**：扩展 `cloudfunctions/quickstartFunctions`，新增 `person`、`event`、`item`、`relation`、`reminder`、`weeklyStats` 等业务函数
- **数据库**：在云开发控制台新增集合 `persons`、`events`、`items`、`relations`、`reminders`
- **依赖**：基础库最低版本调整为支持 `wx.requestSubscribeMessage`、`wx.cloud.callFunction`
- **合规**：订阅消息需在微信公众平台申请一次性订阅模板（待办提醒类）
