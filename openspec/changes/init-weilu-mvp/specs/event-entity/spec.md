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
