# 微录（weilu）

随手记微信小程序 —— 语音/文字记录人、事、物，三者关联，周复盘。

## 能力

- **人**：记录姓名、性格特点、标签
- **事**：记录会议/待办/提醒，支持开始时间与时长
- **物**：记录物品名、购买时间、自定义属性（颜色/DPI/容量等）
- **关联**：人 ↔ 事 ↔ 物 自由关联，支持关联类型（涉及/拥有/认识/搭配/通用）
- **提醒**：相对时间（"20 分钟后"）+ 绝对时间（"明早 9 点"）通过微信订阅消息
- **周复盘**：本周会议总时长、7 天事项分布、Top 5 关联人物/物品

v2 规划：语音录入、AI 实体抽取、人脉图谱可视化、物品电商推荐、提醒推送完整上线（订阅消息模板 + 定时触发器）。

## 目录结构

```
miniprogram/                  # 小程序前端
  app.js / app.json / app.wxss / config.js
  pages/
    index/                    # 三 Tab + 悬浮 FAB
    capture/                  # 快速录入
    detail/                   # 实体详情（含关联 Tab）
    relation/                 # 建立关联
    weekly-review/            # 周复盘
  utils/                      # cloud/storage/time-parser
  components/

cloudfunctions/               # 微信云函数
  common/                     # 共享：withAuth + crud + errors
  person/ event/ item/        # 三实体 CRUD
  relation/                   # 关联
  reminder/                   # 提醒 CRUD
  reminderDispatcher/         # 定时触发器（每分钟扫表发送）
  weeklyStats/                # 周复盘聚合
docs/
  superpowers/
    specs/2026-06-09-weilu-mvp-design.md
    plans/2026-06-09-weilu-mvp.md
openspec/changes/init-weilu-mvp/   # OpenSpec change（含 proposal/design/specs/tasks）
```

## 部署步骤

### 1. 开通云开发

1. 微信开发者工具 → 顶部「云开发」按钮 → 开通并获取环境 ID

### 2. 创建集合

在云开发控制台 → 数据库，创建以下集合：
- `persons`
- `events`
- `items`
- `relations`
- `reminders`

### 3. 建立索引

- `events.startAt`（升序）
- `relations.fromId`（升序）
- `relations.toId`（升序）
- `reminders.sendAt`（升序）

### 4. 部署云函数

在 `cloudfunctions/<name>/` 每个目录右键 → 「上传并部署：云端安装依赖」

需部署的函数：
- `person`, `event`, `item`, `relation`, `reminder`, `weeklyStats`
- `reminderDispatcher`（**必须配置定时触发器：每分钟一次 `* * * * * *`**）

### 5. 配置订阅消息模板

1. 微信公众平台 → 订阅消息 → 一次性订阅 → 申请「待办提醒」类模板
2. 模板至少包含 `thing1`（事项）和 `time2`（时间）字段
3. 把模板 ID 填到 `miniprogram/config.js` 的 `subscribeMessageTemplateId`
4. 在云函数 `reminderDispatcher` 配置环境变量 `SUBSCRIBE_TEMPLATE_ID`

### 6. 配置前端

编辑 `miniprogram/config.js`：
```js
module.exports = {
  cloudEnv: 'your-env-id',              // 云开发环境 ID
  subscribeMessageTemplateId: 'your-tpl-id',
  listCacheTTL: 30,
};
```

### 7. 上传体验版

`miniprogram/` 右键 → 上传 → 设为体验版

## 本地开发

```bash
# 仅做语法检查（无 wx-server-sdk 安装）
node --check miniprogram/utils/*.js
node --check cloudfunctions/common/*.js
node --check cloudfunctions/*/index.js
```

## 数据模型摘要

```
persons  { _id, _openid, name, traits[], tags[], note, createdAt, updatedAt }
events   { _id, _openid, title, type, startAt, durationMin?, description?, tags[] }
items    { _id, _openid, name, boughtAt?, attrs{}, note?, tags[] }
relations{ _id, _openid, fromId, fromType, toId, toType, relType, createdAt }
reminders{ _id, _openid, targetType, targetId, triggerAt, message?, subscribed, status }
```

事件 `type`：`meeting / todo / reminder / generic`
关联 `relType`：`event-involves-person / event-involves-item / person-owns-item / person-knows-person / item-pairs-with-item / generic`
提醒 `status`：`pending / sent / in_app / failed_unsub`

## 错误码

| 码 | 含义 |
|---|---|
| OK | 成功 |
| ERR_UNAUTHORIZED | 未鉴权（缺 OPENID） |
| ERR_NOT_FOUND | 记录不存在或非当前用户 |
| ERR_VALIDATION | 参数校验失败 |
| ERR_INTERNAL | 服务异常 |

## Spec Patch 历史

设计阶段从 brainstorming 识别的 spec 增量已回写到 `openspec/changes/init-weilu-mvp/specs/`：
- weekly-review：Top 5 完整字段 / 时区开区间 / 空周 schema
- time-reminder：未授权降级 in_app / 24h 不重复弹窗
- quick-capture：防重复提交 / loading + 失败 toast
- cloud-data-layer：list 强制 _openid 注入 / pageSize 上限 / common 包复用

## 当前发布说明

- 当前版本已支持分享给朋友、分享到朋友圈：首页、详情页、周复盘页均已接入分享菜单。
- 当前版本的提醒能力为基础版：录入与数据结构已具备，定时触发器和订阅消息模板建议在下一版本完整启用。
