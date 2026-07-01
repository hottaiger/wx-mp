---
change: add-item-images-and-relation-visualization
design-doc: docs/superpowers/specs/2026-07-01-item-images-relation-visualization-design.md
base-ref: 4e7942ec341dfed0ede2dd9570a0169c234851ab
---

# 实施计划

## 1. Spec 对齐

- [ ] 更新 `item-entity` delta spec
- [ ] 更新 `entity-relation` delta spec

## 2. 物品图片

- [ ] 在 `pages/capture` 增加选图、上传、删除、回显
- [ ] 在 `cloudfunctions/item` 支持 `coverImage`
- [ ] 在首页物品卡片增加缩略图
- [ ] 在物品详情页增加大图和替换入口

## 3. 关联可视化

- [ ] 扩展 `person/event/item` 的 `getDetail` 聚合结果，返回对端摘要
- [ ] 抽取详情页的关系分组逻辑
- [ ] 重写详情页“关联”Tab 为分组树状列表
- [ ] 对“人”详情页优化分组标题与信息密度

## 4. 验证

- [ ] 跑 `bash scripts/ci-build.sh`
- [ ] 手工验证：物品创建 + 上传图
- [ ] 手工验证：人详情页分组展示
