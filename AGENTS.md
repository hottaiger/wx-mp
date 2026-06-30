# AGENTS.md

本文件作用域：仓库根目录及其全部子目录。

## 项目概览

- 项目名：`微录（weilu）`
- 类型：微信小程序 + 云开发
- 前端目录：`miniprogram/`
- 云函数目录：`cloudfunctions/`
- 规格目录：`openspec/specs/`
- 设计文档目录：`docs/superpowers/specs/`

## 当前产品边界

- 已上线能力：人 / 事 / 物记录、实体关联、周复盘、分享给朋友、分享到朋友圈
- 暂不要求本轮完成：提醒推送完整上线（订阅消息模板、定时触发器、生产可用推送链路）
- 后续版本能力：语音录入、AI 实体抽取、人脉图谱、物品推荐、提醒推送完整上线

## 开发规则

- 优先修改现有结构，不随意重命名页面、集合、云函数
- 小程序页面路径保持：
  - `pages/index/index`
  - `pages/capture/index`
  - `pages/detail/index`
  - `pages/relation/index`
  - `pages/weekly-review/index`
- 云函数名保持：
  - `person`
  - `event`
  - `item`
  - `relation`
  - `reminder`
  - `reminderDispatcher`
  - `weeklyStats`

## 云函数约束

- 微信云函数按目录独立部署，不共享上级目录文件
- 如业务函数依赖公共模块，必须保证该函数部署包内包含依赖代码
- 当前仓库采用“每个函数目录内自带 `common/` 副本”的方式运行
- 不要恢复到 `require('../common/...')` 这种依赖上级目录的写法

## 数据与权限约束

- 所有集合默认按 `_openid` 做数据隔离
- 所有业务读写优先走 `wx.cloud.callFunction`
- 不要新增绕过云函数直接写数据库的前端逻辑
- 当前集合：
  - `persons`
  - `events`
  - `items`
  - `relations`
  - `reminders`

## 分享能力约束

- 分享能力当前只在以下页面启用：
  - 首页 `pages/index/index`
  - 详情页 `pages/detail/index`
  - 周复盘页 `pages/weekly-review/index`
- 录入页与关联页默认不启用分享菜单
- 分享规则的主规格文件：`openspec/specs/content-sharing/spec.md`

## Spec / Workflow 规则

- 后续需求开发默认严格遵循 `specdrive` / `specdrive-v2`
- 完整功能开发走 `specdrive-v2`
- hotfix / tweak 走 `specdrive`
- 不跳过 brainstorming、design、verify、archive 等阶段
- 规格变更优先更新 `openspec/specs/`，不要只改实现不改 spec

## 验证命令

- 本地基础校验：
  - `bash scripts/ci-build.sh`
- 该命令应保持可用；如改动影响校验链路，需要同步更新脚本

## 发布注意事项

- `miniprogram/config.js` 中的 `cloudEnv` 必须使用真实云开发环境 ID
- `subscribeMessageTemplateId` 允许在当前版本保持占位，但这意味着提醒推送不完整
- 发布前至少验证：
  - 首页列表加载
  - 三类实体录入
  - 详情页查看 / 编辑 / 删除
  - 关联创建
  - 周复盘
  - 分享菜单可见
