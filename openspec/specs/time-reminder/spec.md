# time-reminder Specification

## Purpose
TBD - created by archiving change init-weilu-mvp. Update Purpose after archive.
## Requirements
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

