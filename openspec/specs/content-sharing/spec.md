# content-sharing Specification

## Purpose
定义微录在微信小程序内的分享能力，包括分享给朋友、分享到朋友圈，以及不同页面的分享载荷规则。

## Requirements
### Requirement: 首页支持分享入口
系统 SHALL 在首页启用微信小程序分享菜单，支持“分享给朋友”和“分享到朋友圈”。

#### Scenario: 首页显示分享菜单
- **WHEN** 用户进入 `pages/index/index`
- **THEN** 页面调用分享菜单展示能力，右上角菜单中可见“发送给朋友”和“分享到朋友圈”

### Requirement: 首页分享载荷
系统 SHALL 为首页分享返回固定的产品级分享文案与首页路径。

#### Scenario: 分享给朋友
- **WHEN** 用户从首页触发“分享给朋友”
- **THEN** 返回的分享数据包含标题“微录 · 把人、事、物记在一起”和路径 `/pages/index/index`

#### Scenario: 分享到朋友圈
- **WHEN** 用户从首页触发“分享到朋友圈”
- **THEN** 返回的分享数据包含标题“微录 · 把人、事、物记在一起”

### Requirement: 详情页支持实体分享
系统 SHALL 在详情页启用分享菜单，并按当前实体类型与实体主标题生成分享文案。

#### Scenario: 事件详情分享
- **WHEN** 用户在事件详情页触发分享
- **THEN** 分享标题包含“微录 · 记录了一件事：<事件标题>”

#### Scenario: 人物详情分享
- **WHEN** 用户在人物详情页触发分享
- **THEN** 分享标题包含“微录 · 认识一下 <人物名称>”

#### Scenario: 物品详情分享
- **WHEN** 用户在物品详情页触发分享
- **THEN** 分享标题包含“微录 · 记录了物品 <物品名称>”

### Requirement: 详情页分享路径携带实体定位参数
系统 SHALL 在详情页分享时带上 `type` 与 `id`，使被分享者可直接落到对应实体详情页。

#### Scenario: 详情页分享给朋友
- **WHEN** 用户从详情页触发“分享给朋友”
- **THEN** 分享路径为 `/pages/detail/index?type=<type>&id=<id>`

#### Scenario: 详情页分享到朋友圈
- **WHEN** 用户从详情页触发“分享到朋友圈”
- **THEN** 分享查询参数包含 `type=<type>&id=<id>`

### Requirement: 周复盘页支持分享
系统 SHALL 在周复盘页启用分享菜单，并使用当周会议总时长生成分享文案。

#### Scenario: 周复盘分享给朋友
- **WHEN** 用户在周复盘页触发“分享给朋友”
- **THEN** 分享标题包含“微录 · 本周会议 <totalDurationMin> 分钟”，路径为 `/pages/weekly-review/index`

#### Scenario: 周复盘分享到朋友圈
- **WHEN** 用户在周复盘页触发“分享到朋友圈”
- **THEN** 分享标题包含“微录 · 本周会议 <totalDurationMin> 分钟”

### Requirement: 未接入页面不暴露分享能力
系统 SHALL 仅在首页、详情页、周复盘页启用分享配置；录入页和关联页默认不暴露分享菜单。

#### Scenario: 录入页无分享菜单
- **WHEN** 用户进入 `pages/capture/index`
- **THEN** 页面不主动启用分享菜单

#### Scenario: 关联页无分享菜单
- **WHEN** 用户进入 `pages/relation/index`
- **THEN** 页面不主动启用分享菜单
