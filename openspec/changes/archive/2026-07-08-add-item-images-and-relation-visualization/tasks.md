## 1. Specs

- [x] 1.1 更新 `item-entity` delta spec，补充物品图片上传、存储、展示要求
- [x] 1.2 更新 `entity-relation` delta spec，补充分组展示与对端实体摘要要求

## 2. Item Images

- [x] 2.1 扩展 `item` 云函数，支持 `coverImage.fileID`
- [x] 2.2 在 `pages/capture` 的物品表单增加选图、上传、删除与预览
- [x] 2.3 在 `pages/detail` 的物品编辑与详情展示增加图片区域
- [x] 2.4 在首页物品卡片中增加缩略图展示与无图占位

## 3. Relation Visualization

- [x] 3.1 扩展详情页聚合数据，补充对端实体标题与摘要
- [x] 3.2 在 `pages/detail` 将关联列表按 `person / event / item` 分组展示
- [x] 3.3 为“人”详情页增加树状层级视觉与分组计数
- [x] 3.4 优化关联卡片文案，显示标题/名称而不是只显示标签

## 4. Verify

- [x] 4.1 验证物品创建时上传图片成功并可回显
- [x] 4.2 验证物品编辑替换图片成功
- [x] 4.3 验证人详情页分组展示清晰且点击跳转正常
- [x] 4.4 运行 `bash scripts/ci-build.sh`
