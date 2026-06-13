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

**选型**：周复盘页打开时调用 `weeklyStats` 云函数，传入起止日期，返回该周事件分组与统计。前端纯展示。
**理由**：
- 聚合逻辑在云端，前端零计算
- 后续可缓存到集合做历史回溯，扩展性好

**统计项**：
- 会议类事件（type=meeting）总时长（求和 durationMin）
- 全部事件计数（按天分组）
- 人物/物品被关联次数 Top 5

### D5. 录入交互：底部 Tab + 居中悬浮按钮

**选型**：首页采用三 Tab（人/事/物）切换列表，右下角悬浮按钮唤起快速录入。
**理由**：
- 三 Tab 符合用户对"实体化随手记"的心智模型
- 悬浮按钮降低录入摩擦（一跳即录入）
- 微信小程序原生 TabBar 不支持中间凸起，自定义 Tab + 悬浮按钮成本可控

### D6. 目录结构

```
miniprogram/
  pages/
    index/          # 首页（三 Tab 列表）
    capture/        # 快速录入
    detail/         # 实体详情（含关联 Tab）
    weekly-review/  # 周复盘
    relation/       # 关联管理
  components/
    entity-card/    # 实体卡片
    relation-picker/# 关联选择器
cloudfunctions/
  quickstartFunctions/  # 改造：person / event / item / relation / reminder / weeklyStats
```

## Risks / Trade-offs

- **[R1] 关联独立成表导致查询需 N+1** → 详情页云函数一次性聚合（一次 callFunction 返回实体 + 关联列表），客户端零 N+1
- **[R2] 订阅消息模板未申请** → 在 tasks 中列为前置依赖，模板未就绪时降级为「应用内未读角标」
- **[R3] 微信云开发数据库弱事务** → 单集合写用 `add`/`update`；跨集合操作走云函数内部串行调用，失败回滚以最终一致为目标
- **[R4] 三 Tab 列表大数据量性能** → 列表分页 + 客户端缓存 + 字段精简查询（`field`），MVP 单用户量级无需更复杂
- **[R5] 提醒依赖用户订阅授权** → 录入提醒时立即拉起授权，未授权的提醒标记为待授权状态

## Migration Plan

1. 在 `miniprogram/app.json` 替换 `pages`，新页面先放占位
2. 在云开发控制台新建集合（开发环境）
3. 部署云函数（先 `quickstartFunctions`，按域拆分子函数）
4. 灰度发布（v0.0.1）：自用测试
5. 回滚策略：保留 quickstart 模板页面与 `example` 路径 git tag，便于回退

## Open Questions

- OQ1：是否需要「提醒未读/已读」状态？暂定需要
- OQ2：周复盘起始日是周一还是周日？默认周一，可在设置项改
- OQ3：关联类型是否需要自定义 relType？MVP 仅枚举值，自定义留 v2
