## MODIFIED Requirements

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

### Requirement: 详情页关联分组展示
系统 SHALL 在详情页把当前实体的关联按对端实体类型分组展示，至少分为 `person`、`event`、`item` 三组，并展示每组数量。

#### Scenario: 人详情页分组
- **WHEN** 用户打开人物详情页且该人物同时关联事件和物品
- **THEN** 页面分开显示“关联的事”和“关联的物”，而不是单一线性列表

#### Scenario: 空分组不展示
- **WHEN** 某一组没有任何关联
- **THEN** 页面不渲染该分组或渲染为空态提示

### Requirement: 关联卡片展示对端实体摘要
系统 SHALL 在详情页的关联卡片里显示对端实体的标题/名称与简短摘要，而不只是关系标签。

#### Scenario: 物品关联卡片显示标题
- **WHEN** 人物详情页中有一个关联物品“鼠标”
- **THEN** 卡片展示“鼠标”标题，而不是只显示“物品”或关系标签

#### Scenario: 事件关联卡片显示标题
- **WHEN** 人物详情页中有一个关联事件“买鼠标”
- **THEN** 卡片展示事件标题“买鼠标”

### Requirement: 人详情页树状层级视觉
系统 SHALL 在人物详情页中使用分组层级视觉表达关联结果，使用户能快速看清“这个人关联了哪些事、哪些物、哪些人”。

#### Scenario: 层级清晰
- **WHEN** 用户查看人物详情页
- **THEN** 页面以树状或分组二级列表方式展示关联结构，层级关系清晰可辨
