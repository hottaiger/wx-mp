# weekly-review Specification

## Purpose
TBD - created by archiving change init-weilu-mvp. Update Purpose after archive.
## Requirements
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

