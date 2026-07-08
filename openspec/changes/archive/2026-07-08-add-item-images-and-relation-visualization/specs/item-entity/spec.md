## MODIFIED Requirements

### Requirement: 创建物品
系统 SHALL 提供 `createItem` 云函数，接收 `{ name, boughtAt?: number, attrs?: object, note?: string, tags?: string[], coverImage?: { fileID: string } }`。

#### Scenario: 创建成功
- **WHEN** 提交 `name="鼠标", boughtAt=1717900000000`
- **THEN** 物品落库，boughtAt 为时间戳

#### Scenario: attrs 自由扩展
- **WHEN** 提交 `attrs={color: "黑", dpi: 16000}`
- **THEN** 物品落库，attrs 字段保留完整对象

#### Scenario: 上传主图创建物品
- **WHEN** 用户在创建物品时成功上传图片并提交 `coverImage.fileID`
- **THEN** 物品记录保存 `coverImage.fileID`，后续列表与详情可展示该主图

### Requirement: 更新物品
系统 SHALL 提供 `updateItem` 云函数，支持局部更新与 attrs 合并（深合并），并允许替换 `coverImage.fileID`。

#### Scenario: attrs 合并
- **WHEN** 提交 `attrs={dpi: 26000}`
- **THEN** `attrs` 变为 `{color: "黑", dpi: 26000}`，`color` 保留

#### Scenario: 替换主图
- **WHEN** 用户重新上传一张图片并更新 `coverImage.fileID`
- **THEN** 物品详情与列表后续展示新图片

### Requirement: 物品列表与搜索
系统 SHALL 提供 `listItems` 云函数，支持按 `name` 模糊搜索、按 `tag` 筛选、按 `boughtAt` 倒序分页，并在返回结果中包含 `coverImage` 信息。

#### Scenario: 模糊搜索
- **WHEN** `keyword="鼠"`
- **THEN** 返回 name 含「鼠」的物品

#### Scenario: 列表显示主图
- **WHEN** 物品已保存 `coverImage.fileID`
- **THEN** 列表项返回 `coverImage` 字段，前端可显示缩略图

### Requirement: 删除物品
系统 SHALL 提供 `deleteItem` 云函数，级联删除关联 `relations`。

#### Scenario: 级联删除
- **WHEN** 删除某物品
- **THEN** 物品记录移除，且以该物品为端点的 `relations` 一并删除
