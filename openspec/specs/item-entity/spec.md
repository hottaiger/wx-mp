# item-entity Specification

## Purpose
TBD - created by archiving change init-weilu-mvp. Update Purpose after archive.
## Requirements
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

#### Scenario: 级联删除
- **WHEN** 删除某物品
- **THEN** 物品记录移除，且以该物品为端点的 `relations` 一并删除

