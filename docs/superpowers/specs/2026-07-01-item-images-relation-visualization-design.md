---
change: add-item-images-and-relation-visualization
role: technical-design
canonical_spec: openspec
archived-with: 2026-07-08-add-item-images-and-relation-visualization
status: final
---

# 物品图片与关联可视化设计

## 1. 背景

当前 `item` 只支持文本属性，无法承载“这个物是什么”的视觉信息。详情页关联区也仍然是原始关系列表，用户只能看到关系标签和粗粒度类型，不知道具体关联到了哪一条事件、哪个物品、哪个人物。

本次改动聚焦两个目标：

1. 给物品增加单张主图上传与展示能力
2. 把详情页关联展示升级为按类型分组的二级树状结构

## 2. 设计决策

### 2.1 物品图片

- 只支持 1 张主图，不做多图相册
- 前端使用 `wx.chooseMedia` 选图
- 通过 `wx.cloud.uploadFile` 上传到云存储
- `items` 集合写入：

```js
coverImage: {
  fileID: string,
  cloudPath?: string
}
```

- 列表卡片与详情页优先直接使用 `fileID` 渲染；不引入额外换临时 URL 逻辑

### 2.2 关联可视化

- 保留现有 `relations` 存储模型
- 在 `getDetail` 聚合结果中为每条 relation 补充一个 `counterparty` 字段：

```js
{
  _id,
  fromId,
  fromType,
  toId,
  toType,
  relType,
  counterparty: {
    id,
    type,
    title,
    subtitle
  }
}
```

- 前端详情页将 `relations` 分成三组：
  - `events`
  - `items`
  - `persons`

- 对“人”详情页默认展示为：
  - 关联的事
  - 关联的物
  - 关联的人

- 每组渲染分组标题、数量和组内卡片
- 组内卡片显示：
  - 对端标题 / 名称
  - 关系标签
  - 次级摘要

### 2.3 UI 形式

- 不接图谱库
- 用“树状分组列表”表达层级关系
- 物品图片在列表页以 88rpx 左侧缩略图形式出现
- 详情页顶部对物品显示大图

## 3. 数据流

### 3.1 物品创建

1. 用户在 `capture` 的“物”表单选图
2. 前端上传云存储
3. 获取 `fileID`
4. `createItem` 传 `coverImage.fileID`
5. 首页与详情页用该字段渲染

### 3.2 详情页关联聚合

1. `getDetail` 拉当前实体
2. 拉 `relationsFrom` 与 `relationsTo`
3. 归一化出“对端实体”
4. 按对端实体类型批量查询 title/name
5. 返回带 `counterparty` 的 relation 列表
6. 前端按 `counterparty.type` 分组渲染

## 4. 风险与处理

- 上传失败：前端 toast + 保留表单，不写脏数据
- 旧物品无图：显示占位图块
- 旧 relation 无对端摘要：后端聚合时兜底为 `未命名记录`
- 某些对端实体已删除：卡片显示 `已删除`，但保留关系占位便于排查脏数据

## 5. 验证重点

- 物品创建上传图后可在首页和详情页看到
- 物品编辑替换主图后能即时生效
- 人详情页可以明确看出“关联的事 / 关联的物 / 关联的人”
- 组内卡片点击仍能跳到对应详情页
