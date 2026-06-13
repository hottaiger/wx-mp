# person-entity Specification

## Purpose
TBD - created by archiving change init-weilu-mvp. Update Purpose after archive.
## Requirements
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

