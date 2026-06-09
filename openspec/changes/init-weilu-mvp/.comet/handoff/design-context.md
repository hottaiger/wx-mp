# Comet Design Handoff

- Change: init-weilu-mvp
- Phase: design
- Mode: compact
- Context hash: 4b6c9f0a8c56600c367228dfdcc8da76db35e16d0ef9736aa2017635cb6bccae

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/init-weilu-mvp/proposal.md

- Source: openspec/changes/init-weilu-mvp/proposal.md
- Lines: 1-40
- SHA256: bee9a66c81a7b01368967ec615f5dd6f67d1e0140462feb61716bd7f84b2573e

```md
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
```

## openspec/changes/init-weilu-mvp/design.md

- Source: openspec/changes/init-weilu-mvp/design.md
- Lines: 1-136
- SHA256: 9449258d0431a4d9abeb8ba22f405f8e3c75ce5468dfc37caabe016edc10c684

[TRUNCATED]

```md
## Context

仓库当前是微信云开发 quickstart 模板，提供了数据库/存储/云函数三件套的最小演示。本 change 在该模板基础上构建「微录」产品 MVP。

**关键约束：**
- 微信小程序端无外网域名，云函数是唯一服务端入口
- 微信云开发数据库为 JSON 文档型，关联查询需多次 `db.collection().where()` 或云函数聚合
- 订阅消息受模板限制（需事前在 MP 平台申请）
- 录音与 ASR：v2 再做；MVP 阶段仅文字录入
- 微信云开发有「集合数上限 100、单集合文档数无硬限」等限制，本期不会触及

**利益相关方：** 仅产品本人（自用向 MVP），后续考虑开放注册

## Goals / Non-Goals

**Goals:**
- 三实体（人/事/物）独立建模、互不耦合、可独立演化
- 实体可手动关联，关联带类型与方向
- 文字录入 ≤ 2 次点击（首页 → 输入框 → 选类型 → 提交）
- 时间提醒支持相对（"20 分钟后"）和绝对（"明早 9 点"）两种表达
- 周复盘一次性展示本周会议类事件总时长 + 全部事项计数
- 数据隔离：所有集合带 `_openid` 字段，云函数端做权限校验
- 模型与目录结构为 v2（语音、AI 抽取、人脉图谱、推荐）预留扩展点

**Non-Goals:**
- 语音录入、ASR、AI 实体抽取（v2）
- 人脉关系图谱可视化（v2）
- 物品搭配/电商推荐（v3 商业化）
- 多用户协作、分享、公开页面（v3+）
- 富文本编辑、图片附件（MVP 仅纯文本 + 标签；图片在 v2）

## Decisions

### D1. 数据模型：四集合 + 关联集合，关联独立成表

**选型**：四个主集合 `persons / events / items / relations`。
**理由**：
- 关联独立成表（edge-style）而非在实体上嵌数组，便于双向遍历、统一权限和未来图谱查询
- 文档型数据库对单实体属性扩展天然友好（属性自由 key）
- 相比关系型，MVP 阶段无 JOIN 需求，性能足够

**备选**：
- 嵌入式关联（实体上挂 `relationIds` 数组）→ 双向同步复杂，已弃
- 关系型 MySQL → 自建成本高，过度设计，弃

```
persons  { _id, _openid, name, traits[], tags[], note, createdAt, updatedAt }
events   { _id, _openid, title, type, startAt, durationMin, description, tags[], createdAt }
items    { _id, _openid, name, boughtAt, attrs{}, note, tags[], createdAt }
relations{ _id, _openid, fromId, fromType, toId, toType, relType, createdAt }
```

事件 `type` 取值：meeting / todo / reminder / generic
关联 `relType` 取值：event-involves-person / event-involves-item / person-owns-item / person-knows-person / item-pairs-with-item / generic

### D2. 云函数按域拆分，客户端只调云函数不直连数据库

**选型**：客户端只通过 `wx.cloud.callFunction` 调用云函数，云函数内做 `_openid` 注入和权限校验。
**理由**：
- 防止前端绕过权限过滤直接读写他人数据
- 业务逻辑（提醒调度、统计聚合）天然在云端
- 微信云开发官方推荐做法

**备选**：
- 前端直连数据库 + 安全规则（`db.security`）→ 安全规则表达力有限，复杂校验仍需云函数，弃

### D3. 提醒实现：云函数定时触发 + 订阅消息推送

**选型**：在 `reminders` 集合存待发送提醒，云函数使用「定时触发器」每分钟扫描到期的提醒，调用 `cloud.openapi.subscribeMessage.send` 推送。
**理由**：
- 微信小程序没有前端常驻进程，必须云端触发
- 定时触发器是云开发原生能力，零额外成本
- 发送订阅消息需用户在小程序内 `wx.requestSubscribeMessage` 授权一次

**约束**：
- 一次性订阅消息（不弹窗骚扰），用户授权一次发一条
- 若发送时用户未授权或订阅消息次数已用完，标记 `status=failed`，UI 提示去订阅页续期

### D4. 周复盘：云函数聚合 + 客户端展示

```

Full source: openspec/changes/init-weilu-mvp/design.md

## openspec/changes/init-weilu-mvp/tasks.md

- Source: openspec/changes/init-weilu-mvp/tasks.md
- Lines: 1-71
- SHA256: b69178a8176cb6d6e86727be2d65443f1373c848d95ffc433ae30d5e166ece0d

```md
## 1. 项目脚手架与基础配置

- [ ] 1.1 在 `miniprogram/app.json` 替换 pages 列表为 `[pages/index/index, pages/capture/index, pages/detail/index, pages/weekly-review/index, pages/relation/index]`，更新 `navigationBarTitleText: "微录"`
- [ ] 1.2 在 `project.config.json` 调整 `miniprogramRoot`、appid 占位，配置云开发环境 id
- [ ] 1.3 删除 quickstart 示例：`pages/example/index`、示例云函数逻辑、README 中 quickstart 描述
- [ ] 1.4 在云开发控制台创建集合 `persons / events / items / relations / reminders`，并为 `events.startAt`、`relations.fromId`、`relations.toId`、`reminders.sendAt` 建索引

## 2. 数据层云函数（cloud-data-layer）

- [ ] 2.1 在 `cloudfunctions/quickstartFunctions` 下按域拆分子函数目录 `person / event / item / relation / reminder / weeklyStats`，每目录一个 `index.js` + `package.json`
- [ ] 2.2 实现统一 `withAuth` 工具：注入 OPENID、捕获错误并返回标准错误码
- [ ] 2.3 实现统一 `crud` 基类：`create / update / list / remove`，list 支持 `where/page/pageSize/field/orderBy`
- [ ] 2.4 在 `cloudfunctions/quickstartFunctions/index.js` 注册 router，把不同 action 派发到对应域

## 3. 人物实体（person-entity）

- [ ] 3.1 实现 `createPerson / updatePerson / listPersons / deletePerson` 云函数
- [ ] 3.2 在 `pages/index` 渲染人物 Tab 列表，调用 `listPersons`，支持搜索与下拉刷新
- [ ] 3.3 在 `pages/detail` 渲染 person 详情，支持编辑（弹出底部 sheet 复用 entity-card）
- [ ] 3.4 实现删除时的级联 relation 删除

## 4. 事件实体（event-entity）

- [ ] 4.1 实现 `createEvent / updateEvent / listEvents / deleteEvent` 云函数，含 type 与 startAtRange 筛选
- [ ] 4.2 在 `pages/index` 事件 Tab 渲染列表，按 startAt 倒序
- [ ] 4.3 在 `pages/detail` event 详情展示时间、时长、描述、标签
- [ ] 4.4 实现删除时级联 relation/reminder 删除

## 5. 物品实体（item-entity）

- [ ] 5.1 实现 `createItem / updateItem / listItems / deleteItem` 云函数，attrs 深合并
- [ ] 5.2 在 `pages/index` 物品 Tab 渲染，按 boughtAt 倒序
- [ ] 5.3 物品详情页支持编辑自由 attrs（key/value 输入对）

## 6. 实体关联（entity-relation）

- [ ] 6.1 实现 `createRelation / listRelations / deleteRelation` 云函数，含 relType 白名单与幂等去重
- [ ] 6.2 在 `pages/relation` 实现关联选择器：选 from → 选 to（按类型筛）→ 选 relType → 提交
- [ ] 6.3 在 `pages/detail` 加「关联 Tab」，展示当前实体作为端点的所有关联，点击跳转对端
- [ ] 6.4 列表卡片显示对方实体摘要（名字/标题/图）

## 7. 快速录入（quick-capture）

- [ ] 7.1 在 `pages/index` 加右下角悬浮按钮（自定义 Tab Bar + 按钮），点击 `navigateTo pages/capture`
- [ ] 7.2 `pages/capture` 实现顶部三 Tab（人/事/物）切换表单
- [ ] 7.3 表单字段按 spec/cloud-data-layer 列出渲染，必填校验
- [ ] 7.4 提交成功后弹窗「去关联 / 跳过」二选一
- [ ] 7.5 失败/网络错误显示 toast 并保留输入

## 8. 时间提醒（time-reminder）

- [ ] 8.1 客户端实现相对时间解析工具：`parseRelativeTime('20 分钟后' | '明天 9 点' | '下周一')`
- [ ] 8.2 录入页加「提醒我」开关，开启后弹时间输入（带相对时间快捷选项）
- [ ] 8.3 实现 `createReminder` 云函数，触发时调 `wx.requestSubscribeMessage` 写 subscribed 字段
- [ ] 8.4 部署定时触发器云函数 `reminderDispatcher`，每分钟扫表发送订阅消息，状态机：`pending → sent | failed_unsub`
- [ ] 8.5 在 MP 平台申请一次性订阅消息模板（待办提醒类），上传模板 id 到配置

## 9. 周复盘（weekly-review）

- [ ] 9.1 实现 `weeklyStats` 云函数，含会议总时长、按天分布、Top 5 关联实体
- [ ] 9.2 `pages/weekly-review` 实现：标题区显示本周日期范围、会议总时长大字
- [ ] 9.3 渲染 7 天柱状图（简易 view 实现，无图表库）
- [ ] 9.4 渲染 Top 5 列表，跳转详情

## 10. 联调与发布

- [ ] 10.1 真机自测：录入一条「明早 9 点开会 + 关联自己 + 关联电脑」流程
- [ ] 10.2 验证提醒到点能收到订阅消息
- [ ] 10.3 验证周复盘周一切换时数据正确
- [ ] 10.4 上传体验版（`uploadCloudFunction.sh` 改造 + miniprogram 上传）
- [ ] 10.5 写 `README.md` 介绍微录能力、部署步骤、订阅消息模板申请指引
```

## openspec/changes/init-weilu-mvp/specs/cloud-data-layer/spec.md

- Source: openspec/changes/init-weilu-mvp/specs/cloud-data-layer/spec.md
- Lines: 1-63
- SHA256: 05b34a37a3cf62d36762cf30d482f1f79cd1174e616b053e3dd50279147a9b49

```md
## ADDED Requirements

### Requirement: 云函数统一鉴权
系统 MUST 在每个业务云函数入口校验 `wx.getWXContext().OPENID`，未通过鉴权时返回 `ERR_UNAUTHORIZED`。

#### Scenario: 合法 openid 调用
- **WHEN** 客户端传入 `wx.cloud.callFunction` 调用 `createPerson`
- **THEN** 云函数读取 OPENID 并以该 OPENID 写入 `persons._openid`

#### Scenario: 无 OPENID 直连
- **WHEN** 请求上下文缺少 OPENID
- **THEN** 云函数返回 `{ code: 'ERR_UNAUTHORIZED', message: '...' }`，HTTP 状态 401

### Requirement: 跨集合数据隔离
系统 MUST 在 `persons / events / items / relations / reminders` 所有集合的写入上强制写入 `_openid`，查询时仅返回当前 OPENID 的文档。

#### Scenario: 跨用户读取被隔离
- **WHEN** 用户 A 调用 `listEvents` 拉取列表
- **THEN** 返回结果只包含 `_openid == A` 的 events

#### Scenario: 跨用户写入被拒
- **WHEN** 客户端尝试以 `_openid=B` 写入
- **THEN** 云函数覆盖 `_openid` 为调用者 OPENID，写入始终属于调用者

#### Scenario: list 强制 _openid 过滤
- **WHEN** 客户端不传 _openid 直接调 `listEvents`
- **THEN** 云函数在 where 条件强制注入 `_openid == 当前OPENID`，客户端无法绕过

### Requirement: 统一错误码
系统 MUST 业务云函数返回结构 `{ code: string, data?: any, message?: string }`，错误码枚举：`ERR_UNAUTHORIZED / ERR_NOT_FOUND / ERR_VALIDATION / ERR_INTERNAL`。

#### Scenario: 校验失败
- **WHEN** 必填字段缺失
- **THEN** 返回 `{ code: 'ERR_VALIDATION', message: '<字段名> 必填' }`

### Requirement: 集合索引
系统 MUST 在 `events.startAt`、`relations.fromId`、`relations.toId`、`reminders.sendAt` 上建立数据库索引。

#### Scenario: 索引缺失告警
- **WHEN** 上线后查询日志发现全表扫描
- **THEN** 提示需补建对应字段索引

### Requirement: 公共包与按域部署
系统 MUST 把鉴权、错误码、crud 基类抽到 `cloudfunctions/common/`，各业务域（person / event / item / relation / reminder / weeklyStats）独立云函数部署，仅 require 引用公共包。

#### Scenario: 公共代码复用
- **WHEN** 业务函数 require `common/withAuth`
- **THEN** 拿到一致的鉴权与错误返回

#### Scenario: 独立冷启动
- **WHEN** 部署 reminder 函数后调用 person 函数
- **THEN** person 函数不受 reminder 部署影响

### Requirement: 列表查询边界
系统 MUST 在所有 list 接口强制注入 `_openid` 过滤、按 `updatedAt` 或业务指定字段排序、限制 `pageSize ≤ 100`。

#### Scenario: 超限 pageSize
- **WHEN** 客户端传 pageSize=500
- **THEN** 云函数截断到 100 并返回

#### Scenario: 无排序
- **WHEN** 客户端不传 orderBy
- **THEN** 默认 `updatedAt desc`，避免全表无序扫描
```

## openspec/changes/init-weilu-mvp/specs/entity-relation/spec.md

- Source: openspec/changes/init-weilu-mvp/specs/entity-relation/spec.md
- Lines: 1-37
- SHA256: d2ac2a709139bf86666c46eb3dcf8274c3d2992aa3a3becf4295cd764d6906eb

```md
## ADDED Requirements

### Requirement: 创建关联
系统 SHALL 提供 `createRelation` 云函数，接收 `{ fromId, fromType, toId, toType, relType }`，fromType/toType 取值 person/event/item，relType 必须在白名单内。

#### Scenario: 关联事件与人物
- **WHEN** `fromType=event, toType=person, relType=event-involves-person`
- **THEN** 关联落库，fromId/toId 为对应实体 _id

#### Scenario: relType 非法
- **WHEN** 提交未在白名单的 relType
- **THEN** 返回 `ERR_VALIDATION`

### Requirement: 关联去重
系统 SHALL 在写入时检查「同方向 (fromId, toId, relType)」已存在则跳过写入，返回原记录 `_id`。

#### Scenario: 重复关联幂等
- **WHEN** 两次提交完全相同的 fromId/toId/relType
- **THEN** 集合只新增 1 条，第二次返回已有 _id

### Requirement: 双向查询
系统 SHALL 提供 `listRelations` 云函数，支持 `byFrom={id, type}` 和 `byTo={id, type}` 两种模式，返回该实体作为端点的所有关联。

#### Scenario: 按 from 查
- **WHEN** `byFrom={id: 'E1', type: 'event'}`
- **THEN** 返回所有 `fromId=='E1'` 的 relations

#### Scenario: 按 to 查
- **WHEN** `byTo={id: 'P1', type: 'person'}`
- **THEN** 返回所有 `toId=='P1'` 的 relations

### Requirement: 删除关联
系统 SHALL 提供 `deleteRelation` 云函数，按 `_id` 删除，仅允许删除当前 OPENID 的关联。

#### Scenario: 跨用户删除被拒
- **WHEN** 尝试删除 `_openid != 当前` 的 relation
- **THEN** 返回 `ERR_NOT_FOUND`
```

## openspec/changes/init-weilu-mvp/specs/event-entity/spec.md

- Source: openspec/changes/init-weilu-mvp/specs/event-entity/spec.md
- Lines: 1-33
- SHA256: 70e6f573c77ba75ff68a5a06e9c7f3452d75fc7457ddb7e921ac775f79632e24

```md
## ADDED Requirements

### Requirement: 创建事件
系统 SHALL 提供 `createEvent` 云函数，接收 `{ title, type, startAt, durationMin?: number, description?: string, tags?: string[] }`。`type` 取值 meeting / todo / reminder / generic。

#### Scenario: 创建会议
- **WHEN** `type=meeting, durationMin=60`
- **THEN** 事件落库，时长字段为 60 分钟

#### Scenario: type 非法
- **WHEN** `type=invalid`
- **THEN** 返回 `ERR_VALIDATION`

### Requirement: 更新事件
系统 SHALL 提供 `updateEvent` 云函数，支持更新任意字段，自动刷新 `updatedAt`。

#### Scenario: 改时间
- **WHEN** 仅传 `startAt`
- **THEN** 仅更新 `startAt`

### Requirement: 事件列表与筛选
系统 SHALL 提供 `listEvents` 云函数，支持按 `type` 精确筛选、按 `startAt` 区间筛选、按 `tag` 筛选，默认按 `startAt` 倒序分页。

#### Scenario: 取本周会议
- **WHEN** `type=meeting, startAtRange=[本周一, 下周一)`
- **THEN** 仅返回本周会议

### Requirement: 删除事件
系统 SHALL 提供 `deleteEvent` 云函数，同时级联删除关联的 `relations` 和 `reminders`。

#### Scenario: 级联删除
- **WHEN** 删除某事件
- **THEN** events/relations/reminders 三表对应记录全删
```

## openspec/changes/init-weilu-mvp/specs/item-entity/spec.md

- Source: openspec/changes/init-weilu-mvp/specs/item-entity/spec.md
- Lines: 1-29
- SHA256: 21a07de5a4f47612592bfb93659355cb9730b8afa7cc3ab9968f1a8270247fe2

```md
## ADDED Requirements

### Requirement: 创建物品
系统 SHALL 提供 `createItem` 云函数，接收 `{ name, boughtAt?: number, attrs?: object, note?: string, tags?: string[] }`。

#### Scenario: 创建成功
- **WHEN** 提交 `name="鼠标", boughtAt=1717900000000`
- **THEN** 物品落库，boughtAt 为时间戳

#### Scenario: attrs 自由扩展
- **WHEN** 提交 `attrs={color: "黑", dpi: 16000}`
- **THEN** 物品落库，attrs 字段保留完整对象

### Requirement: 更新物品
系统 SHALL 提供 `updateItem` 云函数，支持局部更新与 attrs 合并（深合并）。

#### Scenario: attrs 合并
- **WHEN** 提交 `attrs={dpi: 26000}`
- **THEN** `attrs` 变为 `{color: "黑", dpi: 26000}`，`color` 保留

### Requirement: 物品列表与搜索
系统 SHALL 提供 `listItems` 云函数，支持按 `name` 模糊搜索、按 `tag` 筛选、按 `boughtAt` 倒序分页。

#### Scenario: 模糊搜索
- **WHEN** `keyword="鼠"`
- **THEN** 返回 name 含「鼠」的物品

### Requirement: 删除物品
系统 SHALL 提供 `deleteItem` 云函数，级联删除关联 `relations`。
```

## openspec/changes/init-weilu-mvp/specs/person-entity/spec.md

- Source: openspec/changes/init-weilu-mvp/specs/person-entity/spec.md
- Lines: 1-37
- SHA256: 2aa473380a19915f283c9c31eaf2d95e9f1860b62e319e05f3172e5ef533f78e

```md
## ADDED Requirements

### Requirement: 创建人物
系统 SHALL 提供 `createPerson` 云函数，接收 `{ name, traits?: string[], tags?: string[], note?: string }`，返回 `{ id }`。

#### Scenario: 创建成功
- **WHEN** 提交完整字段
- **THEN** 返回新 `_id`，`persons` 集合新增一条记录，含 `createdAt / updatedAt`

#### Scenario: name 必填校验
- **WHEN** 提交时缺少 `name`
- **THEN** 返回 `ERR_VALIDATION`

### Requirement: 更新人物
系统 SHALL 提供 `updatePerson` 云函数，支持局部更新任意字段，自动刷新 `updatedAt`。

#### Scenario: 部分更新
- **WHEN** 仅传 `traits`
- **THEN** 仅更新 `traits` 字段，其他字段不变

### Requirement: 查询人物列表
系统 SHALL 提供 `listPersons` 云函数，支持按 `name` 模糊搜索（`db.RegExp`），按 `updatedAt` 倒序分页返回（`page`/`pageSize`，默认 20）。

#### Scenario: 模糊搜索命中
- **WHEN** `keyword="张"`
- **THEN** 返回 `name` 含「张」的人物

#### Scenario: 分页
- **WHEN** `page=2, pageSize=10`
- **THEN** 返回第 11-20 条

### Requirement: 删除人物
系统 SHALL 提供 `deletePerson` 云函数，删除人物时同时删除其作为端点的所有 `relations`。

#### Scenario: 级联删除
- **WHEN** 删除某人物
- **THEN** `persons` 删 1 条，`relations` 删所有 `fromId 或 toId == 此人物 _id` 的记录
```

## openspec/changes/init-weilu-mvp/specs/quick-capture/spec.md

- Source: openspec/changes/init-weilu-mvp/specs/quick-capture/spec.md
- Lines: 1-48
- SHA256: a976483b0e2da92d9f270c41ec9e6bfc8bdaf52cd533fbef6986d14825190deb

```md
## ADDED Requirements

### Requirement: 快速录入入口
系统 SHALL 在首页右下角展示悬浮按钮，点击后跳转至 `pages/capture` 录入页。

#### Scenario: 唤起录入
- **WHEN** 用户点击悬浮按钮
- **THEN** `wx.navigateTo` 至 `pages/capture`，URL 参数 `type` 默认 `event`

### Requirement: 录入表单
系统 SHALL 录入页根据 `type` 渲染对应表单：event 显示 title/type/startAt/durationMin，person 显示 name/traits，item 显示 name/boughtAt/attrs。

#### Scenario: 切换类型
- **WHEN** 顶部 Tab 切换 person → event
- **THEN** 表单字段替换为事件字段

### Requirement: 提交校验
系统 SHALL 提交前校验必填项（name / title 必填），校验失败显示行内错误；提交过程中按钮置 disabled 防重复提交。

#### Scenario: 缺标题
- **WHEN** event 表单未填 title
- **THEN** 提交按钮禁用，「请填写标题」提示

#### Scenario: 防止重复提交
- **WHEN** 用户快速双击提交
- **THEN** 第二次点击被 disabled 拦截，集合只新增 1 条

### Requirement: 提交后 loading 与成功反馈
系统 SHALL 提交期间显示 loading toast（`wx.showLoading`），成功后 `wx.showToast` 提示「已记录」并弹关联引导弹窗；失败保留输入并 toast 错误。

#### Scenario: 提交成功
- **WHEN** 录入合法且网络通
- **THEN** 列表新增 1 条，弹窗「去关联 / 跳过」出现

#### Scenario: 提交失败
- **WHEN** 云函数返回 ERR_INTERNAL
- **THEN** 输入保留，toast「保存失败，请重试」

### Requirement: 关联引导
系统 SHALL 在录入成功后，弹窗询问「是否立即建立关联？」，提供「跳过」和「去关联」两个动作。

#### Scenario: 跳过关联
- **WHEN** 用户点击「跳过」
- **THEN** 弹窗关闭，返回首页

#### Scenario: 去关联
- **WHEN** 用户点击「去关联」
- **THEN** 跳转至 `pages/relation`，自动带上刚录入实体的 id/type
```

## openspec/changes/init-weilu-mvp/specs/time-reminder/spec.md

- Source: openspec/changes/init-weilu-mvp/specs/time-reminder/spec.md
- Lines: 1-73
- SHA256: 5549dab85882ef823d4f271052183a0e48e12be0c4b6b6b13a920a522f977d4f

```md
## ADDED Requirements

### Requirement: 创建提醒
系统 SHALL 提供 `createReminder` 云函数，接收 `{ targetType, targetId, triggerAt, message? }`，triggerAt 为绝对时间戳。

#### Scenario: 创建明天 9 点提醒
- **WHEN** 提交 `triggerAt=明天 9 点对应时间戳`
- **THEN** reminder 落库，状态 `pending`

### Requirement: 相对时间解析
系统 SHALL 在客户端解析中文相对时间表达式，转换为绝对时间戳：
- 「N 分钟后」→ now + N*60s
- 「明天 HH:mm」→ 明天 HH:mm
- 「下周一」→ 下个周一 09:00

#### Scenario: 「20 分钟后」解析
- **WHEN** 用户输入「20 分钟后」
- **THEN** triggerAt = 当前时间戳 + 20*60*1000

#### Scenario: 解析失败
- **WHEN** 用户输入「下辈子」
- **THEN** 提示「无法解析时间，请改为具体时刻」

### Requirement: 订阅消息授权
系统 SHALL 在创建提醒时拉起 `wx.requestSubscribeMessage` 请求授权，授权结果写入 reminder 记录 `subscribed` 字段。

#### Scenario: 用户同意
- **WHEN** 用户点击「允许」
- **THEN** reminder.subscribed = true

#### Scenario: 用户拒绝
- **WHEN** 用户点击「取消」
- **THEN** reminder.subscribed = false，UI 标记「未订阅」

### Requirement: 定时触发发送
系统 SHALL 部署云函数定时触发器（每分钟一次），扫描 `status=pending && sendAt<=now && subscribed=true` 的 reminders，调用 `cloud.openapi.subscribeMessage.send` 发送，成功后置 `status=sent`。

#### Scenario: 到期发送
- **WHEN** 当前时间 ≥ sendAt 且已订阅
- **THEN** 发送订阅消息，状态置 sent

#### Scenario: 未订阅跳过
- **WHEN** sendAt 到期但未订阅
- **THEN** 状态置 `failed_unsub`，UI 提示去订阅页

### Requirement: 取消提醒
系统 SHALL 提供 `cancelReminder` 云函数，按 _id 删除 pending 状态的提醒。

#### Scenario: 取消 pending
- **WHEN** 删除 pending 提醒
- **THEN** 记录删除，定时器下次扫描不再命中

#### Scenario: 取消 sent
- **WHEN** 尝试删除已发送提醒
- **THEN** 返回 `ERR_VALIDATION`，提示「已发送不可取消」

### Requirement: 订阅未授权降级
系统 SHALL 当 reminder.subscribed=false 时，定时器不调用 send，直接置 `status=in_app`，并在首页「待办」Tab 展示，附带「去订阅」入口。

#### Scenario: 未授权降级
- **WHEN** sendAt 到期 + subscribed=false
- **THEN** 状态置 `in_app`，待办 Tab 出现该条

#### Scenario: 模板未申请降级
- **WHEN** 订阅消息模板未配置（环境变量缺失）
- **THEN** 定时器走 in_app 分支，写日志「template_missing」，不影响其他提醒

### Requirement: 重复订阅请求限额保护
系统 SHALL 在单次提醒创建中，`wx.requestSubscribeMessage` 至多触发一次；用户在 24h 内对同 templateId 的「总是保持以上选择」状态下不再弹窗。

#### Scenario: 不重复弹窗
- **WHEN** 24h 内同 templateId 已请求过且用户选过
- **THEN** 不再次弹窗，直接采用上次结果
```

## openspec/changes/init-weilu-mvp/specs/weekly-review/spec.md

- Source: openspec/changes/init-weilu-mvp/specs/weekly-review/spec.md
- Lines: 1-51
- SHA256: 011ba3703559a86456099196d5eabe2154083c5696f5248e1676264a420aab50

```md
## ADDED Requirements

### Requirement: 周统计接口
系统 SHALL 提供 `weeklyStats` 云函数，接收 `{ weekStart, weekEnd }`（ISO 字符串），返回 `{ meetings: {count, totalDurationMin}, eventsByDay: {day: count}[], topPersons: Person[], topItems: Item[] }`。

#### Scenario: 取本周统计
- **WHEN** 调用 weeklyStats 传 [本周一 00:00, 下周一 00:00)
- **THEN** 返回该周会议总时长与按天分布

### Requirement: 会议时长聚合
系统 SHALL 聚合 `type=meeting` 的 events，对 `durationMin` 求和。

#### Scenario: 0 会议
- **WHEN** 本周无会议
- **THEN** `meetings.count=0, totalDurationMin=0`

#### Scenario: 3 场会议
- **WHEN** 3 场会议 durationMin 分别为 30/60/90
- **THEN** `totalDurationMin=180`

### Requirement: 事项按天分布
系统 SHALL 按 `startAt` 所在日期分组（设备本地时区），统计每日事件数；返回 7 个 key（含 0 计数的天）。

#### Scenario: 7 天分布
- **WHEN** 本周有 5 天各有事件
- **THEN** `eventsByDay` 含 7 个 key，每天 count 准确

### Requirement: Top 5 关联实体完整字段
系统 SHALL 统计本周事件关联的 person/item（经 `relations.fromId` 为本周 eventId 的记录），按被关联次数倒序取 Top 5，**返回实体完整字段**（name + traits/tags + updatedAt 等），由云函数内部 batchGet 一次完成，禁止客户端 N+1。

#### Scenario: 排名稳定
- **WHEN** 2 个 person 各被关联 3 次
- **THEN** topPersons 同时含两人，按 updatedAt 次序兜底

#### Scenario: Top 5 含完整字段
- **WHEN** 排名第一的 person 为「张三」
- **THEN** topPersons[0] 包含 `{ _id, name, traits, tags, updatedAt }` 完整对象，不只是 _id

### Requirement: 时区与起止
系统 SHALL 接收 `weekStart / weekEnd` 为 ISO 字符串（带时区），按 ISO 区间 `[weekStart, weekEnd)` 严格过滤。

#### Scenario: 边界排除
- **WHEN** event.startAt == weekEnd
- **THEN** 不计入本周（开区间）

### Requirement: 空周返回
系统 SHALL 当周内无任何事件时，返回结构仍为完整 schema，所有计数为 0，topPersons/topItems 为空数组。

#### Scenario: 空周
- **WHEN** 周内 0 events
- **THEN** 返回 `{ meetings: {count: 0, totalDurationMin: 0}, eventsByDay: {7 天全 0}, topPersons: [], topItems: [] }`
```

