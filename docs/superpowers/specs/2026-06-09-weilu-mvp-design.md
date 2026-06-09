---
comet_change: init-weilu-mvp
role: technical-design
canonical_spec: openspec
---

# 微录 MVP — 技术设计

## 1. 范围与定位

本 Design Doc 描述「微录」MVP 的实现方案。**OpenSpec delta spec 为需求事实源**（`openspec/changes/init-weilu-mvp/specs/*/spec.md`），本文档只补充技术决策、数据流、风险与测试策略，不重写需求。

MVP 范围：人/事/物 CRUD + 手动关联 + 文字录入 + 微信订阅消息提醒 + 周复盘。语音/AI 抽取/人脉图谱/电商推荐在 v2+。

## 2. 部署架构

```
┌────────────────────────┐
│  微信小程序端 (miniprogram) │
│  - pages/* (原生 Page)      │
│  - components/*           │
│  - utils/* (解析/缓存)     │
└────────────┬─────────────┘
             │ wx.cloud.callFunction
             ▼
┌────────────────────────────────────────────────────────┐
│  微信云开发 (cloudfunctions)                            │
│                                                         │
│  common/ ← 公共代码（鉴权/crud/错误码）                │
│     ▲   ▲   ▲   ▲   ▲   ▲                              │
│     │   │   │   │   │   │                              │
│   person event item relation reminder weeklyStats     │
│                                                         │
│  定时触发器 ──→ reminderDispatcher (每分钟)            │
│                                                         │
│  数据库: persons / events / items / relations / reminders│
└────────────────────────────────────────────────────────┘
```

**决策 D-ARCH-1**：共享 common 包 + 每域独立云函数（方案 C）
- 公共代码 `cloudfunctions/common/` 抽出 withAuth、crud 基类、统一错误码
- 6 个业务域独立部署、独立冷启动、独立扩缩容
- 定时触发器天然只对 reminderDispatcher 生效
- 部署脚本：`uploadCloudFunction.sh` 改造为遍历 `cloudfunctions/*/package.json` 逐个上传

**决策 D-ARCH-2**：客户端零直连数据库
- 所有读写走 `wx.cloud.callFunction`
- `_openid` 由云函数从 `wx.getWXContext()` 注入，客户端无法伪造
- 防止跨用户读取（spec: cloud-data-layer §跨集合数据隔离）

## 3. 关键数据流

### 3.1 录入流程

```
User tap FAB
  → pages/index navigateTo pages/capture?type=event
  → 填表 → 提交
  → wx.cloud.callFunction({ name: 'event', data: { action: 'create', payload } })
  → cloudfunction event/index.js withAuth → crud.create('events', payload+_openid)
  → 返回 { _id }
  → 客户端 wx.showToast('已记录')
  → 弹窗「去关联 / 跳过」
     → 跳关联：navigateTo pages/relation?fromId=_id&fromType=event
     → 跳过：navigateBack
```

### 3.2 提醒调度

```
User 在录入页开启「提醒我」+ 选时间
  → 客户端 parseRelativeTime → triggerAt (timestamp)
  → wx.requestSubscribeMessage(templateIdList)  ← 弹一次
  → cloudfunction reminder/index.js createReminder
     → 写 reminders { targetType, targetId, triggerAt, subscribed, status:'pending' }
  → 定时触发器 (每分钟) reminderDispatcher 扫表
     → status=='pending' && triggerAt<=now
        → subscribed=true: cloud.openapi.subscribeMessage.send → status='sent'
        → subscribed=false: status='in_app'，首页待办 Tab 出现
        → template 缺失：status='in_app'，写日志
```

### 3.3 周复盘

```
User 进 pages/weekly-review
  → 计算 weekStart=本周一 00:00, weekEnd=下周一 00:00 (本地时区)
  → cloudfunction weeklyStats/index.js({ weekStart, weekEnd })
     → 内部：
        1) db.collection('events').where({ _openid, startAt: gte+lte }).get()
        2) 内存聚合 meetings / eventsByDay
        3) 取 relations.where({ fromId IN weekEventIds })
        4) 计数 person/item 被关联次数 → 排序取 Top 5
        5) batchGet persons + items 拿完整字段
     → 返回 { meetings, eventsByDay, topPersons[], topItems[] }
  → 客户端纯展示：会议总时长大字 + 7 天柱状 + Top 5 列表
```

### 3.4 详情页一次聚合

```
User 进 pages/detail?id=X&type=event
  → cloudfunction event/index.js({ action: 'getDetail', id })
     → 内部：db.collection('events').doc(id).get()
            + relations.where({ fromId: id }).get()
            + relations.where({ toId: id }).get()
     → 返回 { entity, relationsFrom, relationsTo }
  → 客户端单次 loading，UX 平滑
```

## 4. 关键技术决策

| ID | 决策 | 备选 | 理由 |
|---|---|---|---|
| D-LIST-1 | MVP 列表全量拉（limit 100） | 游标分页 / skip+limit | 单用户数据量小，实现极简；spec/cloud-data-layer §列表查询边界 限 pageSize≤100 |
| D-LIST-2 | Top 5 在云函数内 batchGet | 客户端 N+1 | 一次 callFunction 返回，spec/weekly-review §Top 5 关联实体完整字段 |
| D-CACHE-1 | 客户端用 `wx.setStorageSync` 缓存 list，TTL 30s | 内存 / 持久化 | 30s 内多次进首页不重复打云函数 |
| D-STATE-1 | 全局状态仅 openid（app.js 启动拿一次） | MobX / Redux | MVP 体量无需引第三方 |
| D-REL-1 | v1 只展示 1 度关联，不做图谱 | BFS 2 度 | 范围控制（proposal 已写 v2） |
| D-REM-1 | 订阅未授权降级为 in_app 角标 | 弹窗骚扰 / 强拒 | 静默兜底，体验好（spec/time-reminder §订阅未授权降级） |

## 5. 数据模型

```
persons  { _id, _openid, name, traits[], tags[], note, createdAt, updatedAt }
events   { _id, _openid, title, type, startAt, durationMin?, description?, tags[], createdAt, updatedAt }
items    { _id, _openid, name, boughtAt?, attrs{}, note?, tags[], createdAt, updatedAt }
relations{ _id, _openid, fromId, fromType, toId, toType, relType, createdAt }
reminders{ _id, _openid, targetType, targetId, triggerAt, message?, subscribed, status,
           createdAt, sentAt? }
```

**事件 type**: meeting / todo / reminder / generic
**关联 relType**: event-involves-person / event-involves-item / person-owns-item / person-knows-person / item-pairs-with-item / generic
**reminder status**: pending / sent / in_app / failed_unsub

## 6. 目录结构

```
wx-mp/
├── miniprogram/
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/         # 三 Tab + 悬浮 FAB
│   │   ├── capture/       # 快速录入
│   │   ├── detail/        # 实体详情（含关联 Tab）
│   │   ├── weekly-review/ # 周复盘
│   │   └── relation/      # 关联选择
│   ├── components/
│   │   ├── entity-card/
│   │   └── relation-picker/
│   ├── utils/
│   │   ├── time-parser.js   # 相对时间解析
│   │   ├── storage.js       # 缓存封装
│   │   └── cloud.js         # callFunction 封装
│   └── images/
├── cloudfunctions/
│   ├── common/            # 公共代码
│   │   ├── withAuth.js
│   │   ├── crud.js
│   │   └── errors.js
│   ├── person/
│   ├── event/
│   ├── item/
│   ├── relation/
│   ├── reminder/
│   ├── reminderDispatcher/  # 定时触发器
│   └── weeklyStats/
└── docs/superpowers/specs/
    └── 2026-06-09-weilu-mvp-design.md
```

## 7. 关键技术风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| 订阅消息模板未申请 | 提醒全失败 | 降级 in_app（spec §订阅未授权降级） + 上线 checklist 必填 |
| 关联 N+1 | 详情页慢 | 一次 getDetail 云函数（§3.4） |
| 定时触发器延迟 | 提醒漂移 ≤ 1min | MVP 接受，文档记录；v2 客户端前台自检 |
| 微信云开发弱事务 | 级联删除中间失败 | 串联调用 + 最终一致；删除前先列 id 集合，失败重试 |
| 跨用户权限绕过 | 数据泄露 | `_openid` 云函数端注入，前端无 inject 路径 |
| 真机调试限制 | 联调慢 | 微信开发者工具 + 体验版 + 一台真机 |

## 8. 性能与可观测

- 慢查询：云开发控制台 db 慢日志，list 接口 < 300ms
- 错误日志：云函数 `console.error` 走 `console.log` 收集
- 前端：`wx.reportMonitor` 关键操作打点（capture submit / reminder send / weekly load）

## 9. 测试策略

### 9.1 单元测试（云函数）

工具：jest + tcb-admin-sdk（mock 云环境）

| 测试目标 | 覆盖 spec | 用例 |
|---|---|---|
| 鉴权 withAuth | cloud-data-layer §云函数统一鉴权 | 缺 OPENID → ERR_UNAUTHORIZED |
| list _openid 注入 | cloud-data-layer §跨集合数据隔离 | 客户端不传 _openid 仍被过滤 |
| 关联去重 | entity-relation §关联去重 | 重复提交返回同 _id |
| 关联 relType 白名单 | entity-relation §创建关联 | 非法 relType → ERR_VALIDATION |
| 提醒状态机 | time-reminder §定时触发发送 | 到期+subscribed → sent |
| 提醒降级 | time-reminder §订阅未授权降级 | subscribed=false → in_app |
| 周复盘聚合 | weekly-review §会议时长聚合 | 30+60+90=180 |
| 周复盘 Top 5 batchGet | weekly-review §Top 5 关联实体完整字段 | 排名 1 含完整字段 |
| 周复盘边界 | weekly-review §时区与起止 | startAt==weekEnd 不计 |
| 重复提交防护 | quick-capture §提交校验 | 双击只增 1 条 |

### 9.2 集成（云函数）

- 端到端：建人 → 建事 → 关联 → 删事 → 验关联级联删
- 提醒到点：构造 triggerAt=now+30s，等待 1 分钟，验 status=sent
- 周复盘空周：events 集合空，返回 0 计数

### 9.3 前端冒烟（真机）

- 录入一条「明早 9 点开会 + 关联自己 + 关联电脑」全流程
- 验证提醒到点能收到订阅消息
- 验证周复盘周一切换时数据正确
- 验证删除级联

### 9.4 验收门槛

- 单测覆盖率：cloudfunctions/** 业务代码 ≥ 70%
- 所有 spec Scenario 对应 1 个测试用例，全绿
- 真机冒烟 5 个流程全过

## 10. Spec Patch 已回写

本次设计 brainstorming 中识别到 4 处 spec 缺口，已回写到 OpenSpec：

1. **weekly-review/spec.md** — 补充 Top 5 完整字段（batchGet）、时区与开区间、空周 schema
2. **time-reminder/spec.md** — 补充订阅未授权/模板缺失降级、24h 不重复弹窗
3. **quick-capture/spec.md** — 补充防重复提交 disabled、loading + 成功/失败 toast
4. **cloud-data-layer/spec.md** — 补充 list 强制 _openid 注入 + pageSize 上限、common 包复用

## 11. 部署与回滚

- 部署：体验版 v0.0.1，先自用
- 集合创建：在云开发控制台手工建（无 CLI）
- 索引：同上
- 回滚：保留 quickstart 模板代码 git tag v0.0.0-template，git revert 即可

## 12. 待办与开放问题

- OQ1：周起始日默认周一，是否加设置项？→ spec 已写默认周一
- OQ2：关联 relType 是否支持自定义？→ MVP 不支持，spec/entity-relation §创建关联 写明白名单
- OQ3：图片附件？→ MVP 不做，v2
- OQ4：reminderDispatcher 失败重试策略？→ 单次失败不重试，下一分钟再扫；超过 triggerAt + 24h 置 failed_timeout
