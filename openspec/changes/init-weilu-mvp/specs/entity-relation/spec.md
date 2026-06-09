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
