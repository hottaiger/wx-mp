## ADDED Requirements

### Requirement: 快速录入入口
系统 SHALL 在首页右下角展示悬浮按钮，点击后跳转至 `pages/capture` 录入页。

#### Scenario: 唤起录入
- **WHEN** 用户点击悬浮按钮
- **THEN** `wx.navigateTo` 至 `pages/capture`，URL 参数 `type` 默认 `event`

### Requirement: 录入表单
系统 SHALL 录入页根据 `type` 渲染对应表单：event 显示 title/type/startAt/durationMin，person 显示 name/traits，item 显示 name/boughtAt/attrs。

#### Scenario: 切换类型
- **WHEN** 顶部 Tab 切换 person → event
- **THEN** 表单字段替换为事件字段

### Requirement: 提交校验
系统 SHALL 提交前校验必填项（name / title 必填），校验失败显示行内错误；提交过程中按钮置 disabled 防重复提交。

#### Scenario: 缺标题
- **WHEN** event 表单未填 title
- **THEN** 提交按钮禁用，「请填写标题」提示

#### Scenario: 防止重复提交
- **WHEN** 用户快速双击提交
- **THEN** 第二次点击被 disabled 拦截，集合只新增 1 条

### Requirement: 提交后 loading 与成功反馈
系统 SHALL 提交期间显示 loading toast（`wx.showLoading`），成功后 `wx.showToast` 提示「已记录」并弹关联引导弹窗；失败保留输入并 toast 错误。

#### Scenario: 提交成功
- **WHEN** 录入合法且网络通
- **THEN** 列表新增 1 条，弹窗「去关联 / 跳过」出现

#### Scenario: 提交失败
- **WHEN** 云函数返回 ERR_INTERNAL
- **THEN** 输入保留，toast「保存失败，请重试」

### Requirement: 关联引导
系统 SHALL 在录入成功后，弹窗询问「是否立即建立关联？」，提供「跳过」和「去关联」两个动作。

#### Scenario: 跳过关联
- **WHEN** 用户点击「跳过」
- **THEN** 弹窗关闭，返回首页

#### Scenario: 去关联
- **WHEN** 用户点击「去关联」
- **THEN** 跳转至 `pages/relation`，自动带上刚录入实体的 id/type
