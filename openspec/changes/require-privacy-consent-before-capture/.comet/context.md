# Comet Design Handoff

- Change: require-privacy-consent-before-capture
- Phase: design
- Mode: compact
- Context hash: f2c9c266f3b94cfffe4ce023cbe93115dca9b63ac5a928565e8bc5aecc4125cc

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/require-privacy-consent-before-capture/proposal.md

- Source: openspec/changes/require-privacy-consent-before-capture/proposal.md
- Lines: 1-28
- SHA256: 3620c59be31af33d3f79e1521f50875a7516297dbf310dd252952dc9dc902f5f

```md
## Why

微信小程序审核指出“记一笔”在收集、使用和存储用户信息前，未完整展示《用户服务协议》《隐私政策》并取得用户授权。当前录入页会直接把人、事、物记录提交到云函数，需要补齐清晰告知和提交前授权闭环。

## What Changes

- 在录入页保存操作附近展示隐私授权确认入口，并提供《用户服务协议》《隐私政策》的可读内容。
- 明确说明所收集的数据类型、收集目的、处理方式、存储位置和使用范围。
- 未明确同意时拦截保存，不调用业务云函数、不上传录入数据；用户同意后恢复原有保存流程。
- 记录本机授权状态，支持用户查看协议并撤回当前授权。
- 增加覆盖授权、拒绝和云函数调用边界的自动化校验。

## Capabilities

### New Capabilities

- `privacy-consent`: 定义录入数据提交前的协议告知、明确同意、拒绝拦截、授权记录与撤回行为。

### Modified Capabilities

- `quick-capture`: 录入表单提交增加隐私授权前置条件，授权通过后才进入现有校验和云函数保存流程。

## Impact

- 前端：`miniprogram/pages/capture/` 的页面状态、协议展示、提交逻辑和样式。
- 工具层：新增本地隐私授权状态与协议版本管理模块。
- 规格：新增 `privacy-consent`，修改 `quick-capture` 的提交要求。
- 云函数和数据库 schema 不变；授权前不会调用现有业务云函数。

```

## openspec/changes/require-privacy-consent-before-capture/design.md

- Source: openspec/changes/require-privacy-consent-before-capture/design.md
- Lines: 1-56
- SHA256: f655d0403282c06a5a96f4ef9716a60ea93ca1b5dce9f371f51a4e82a8c9a470

```md
## Context

录入页当前在用户点击“保存”后直接构造人、事、物 payload，并通过 `wx.cloud.callFunction` 写入云数据库。页面没有协议入口、数据处理告知或明确同意状态，导致微信审核失败。修复必须保持现有云函数和集合结构不变，并保证授权前无业务数据外发。

## Goals / Non-Goals

**Goals:**

- 在录入页内提供完整、可查看的《用户服务协议》和《隐私政策》。
- 以未勾选为默认状态，只有用户主动勾选后才能提交。
- 在云函数调用之前执行授权拦截，并按协议版本持久化本机授权状态。
- 用户取消勾选时立即撤回当前本机授权记录。
- 保持人、事、物原有录入、提醒和关联流程不变。

**Non-Goals:**

- 不新增账号、服务端授权表或数据库 schema。
- 不处理本次审核中的内容安全和类目问题。
- 不替代微信公众平台后台配置的《小程序用户隐私保护指引》。

## Decisions

### 1. 使用录入页内联勾选与协议弹层

保存按钮上方展示未预选的同意控件，协议名称可点击打开页面内弹层。相比新增独立页面，该方案不改变既有页面路由，并能在保存动作附近形成清晰授权证据。

### 2. 协议内容和授权状态集中到独立工具模块

新增 `utils/privacy-consent.js`，统一维护协议版本、服务协议正文、隐私政策正文和本地存储读写。页面只消费稳定接口，避免协议版本和存储 key 散落在视图逻辑中。

授权记录保存 `{ version, agreedAt }`。读取时仅接受当前版本；协议升级后旧授权自动失效，用户必须重新确认。

### 3. 授权拦截位于 `onSubmit` 的第一条业务路径

`onSubmit` 在表单校验和任何云函数调用前检查 `privacyAgreed`。未同意时仅提示“请先阅读并同意用户服务协议和隐私政策”，不进入 loading、订阅消息授权、图片上传或业务云函数调用。

### 4. 协议正文明确实际数据处理边界

隐私政策说明收集的人、事、物字段、可选图片和提醒信息；用途为记录、关联、复盘和用户主动开启的提醒；处理方式为通过微信云开发云函数传输并存储；数据按 `_openid` 隔离，不用于广告营销或出售。服务协议说明用户内容责任、服务范围、账号与数据安全、服务变更及终止方式。

## Risks / Trade-offs

- [本地授权记录可被清理] → 清理后恢复为未同意并要求重新授权，不影响数据安全。
- [协议内容变更后旧授权仍被误用] → 用固定协议版本校验，版本变化自动失效。
- [自定义协议不能替代平台隐私指引] → 发布前仍需在微信公众平台维护对应隐私保护指引；本变更只修复小程序内告知和同意闭环。
- [弹层内容较长] → 使用可滚动区域并保留清晰关闭入口。

## Migration Plan

1. 发布包含协议工具模块和录入页授权 UI 的版本。
2. 所有现有用户首次进入录入页均为未授权状态，需要主动同意。
3. 如需回滚，移除录入页授权 UI 与工具模块即可；云函数和数据库无需迁移。

## Open Questions

无。

```

## openspec/changes/require-privacy-consent-before-capture/tasks.md

- Source: openspec/changes/require-privacy-consent-before-capture/tasks.md
- Lines: 1-11
- SHA256: 7f62498b70ce45ea312e466bbb3ff320bcfe8d56cc7f75ec0a4266619b5b7076

```md
## 1. 隐私授权基础能力

- [ ] 1.1 以测试驱动方式新增协议版本、协议正文和本地授权状态工具模块，覆盖有效授权、版本失效和撤回。

## 2. 录入页授权闭环

- [ ] 2.1 在录入页实现协议入口、可滚动协议弹层、主动勾选和提交前拦截，确保未授权时不调用业务云函数。

## 3. 验证与规格同步

- [ ] 3.1 增加录入页授权边界测试，运行 `bash scripts/ci-build.sh`，并根据验证结果同步任务状态。

```

## openspec/changes/require-privacy-consent-before-capture/specs/privacy-consent/spec.md

- Source: openspec/changes/require-privacy-consent-before-capture/specs/privacy-consent/spec.md
- Lines: 1-41
- SHA256: 35638d6c39b0005b2e56ebe7e037769694ec35cb3378faf822710147e895b761

```md
## ADDED Requirements

### Requirement: 协议内容告知
系统 SHALL 在“记一笔”录入页提供可访问的《用户服务协议》和《隐私政策》，隐私政策 MUST 明确说明收集的数据类型、使用目的、处理方式、存储位置和使用范围。

#### Scenario: 查看用户服务协议
- **WHEN** 用户点击《用户服务协议》
- **THEN** 系统展示完整服务协议正文，并允许用户关闭后返回当前录入内容

#### Scenario: 查看隐私政策
- **WHEN** 用户点击《隐私政策》
- **THEN** 系统展示包含人、事、物、图片和提醒数据处理说明的完整隐私政策正文

### Requirement: 明确同意后方可收集数据
系统 MUST 默认不勾选隐私授权，并且只有用户主动同意当前版本的《用户服务协议》和《隐私政策》后，才允许向业务云函数传输录入数据。

#### Scenario: 未同意时保存
- **WHEN** 用户未勾选协议授权并点击“保存”
- **THEN** 系统提示用户先阅读并同意协议，且不调用任何业务云函数

#### Scenario: 同意后保存
- **WHEN** 用户主动勾选协议授权并提交合法录入内容
- **THEN** 系统记录当前协议版本和同意时间，并进入原有保存流程

### Requirement: 授权状态与协议版本绑定
系统 SHALL 将本机授权状态绑定到协议版本；当前协议版本变化或授权记录无效后，系统 MUST 恢复为未同意状态。

#### Scenario: 当前版本授权有效
- **WHEN** 本机授权记录的版本与当前协议版本一致
- **THEN** 录入页显示已同意状态

#### Scenario: 协议版本变化
- **WHEN** 本机授权记录版本与当前协议版本不一致
- **THEN** 录入页显示未同意，并要求用户重新确认

### Requirement: 撤回授权
系统 SHALL 允许用户取消协议勾选，取消后 MUST 删除当前本机授权记录，并阻止后续录入数据提交，直至再次主动同意。

#### Scenario: 取消已同意授权
- **WHEN** 用户取消已勾选的协议授权
- **THEN** 系统删除本机授权记录并立即恢复提交拦截

```

## openspec/changes/require-privacy-consent-before-capture/specs/quick-capture/spec.md

- Source: openspec/changes/require-privacy-consent-before-capture/specs/quick-capture/spec.md
- Lines: 1-16
- SHA256: 00d3671b6582b8e4f8af5e93b27aab4013be82cc974bc84e6a368e49ac84ff15

```md
## MODIFIED Requirements

### Requirement: 提交校验
系统 SHALL 提交前先确认用户已主动同意当前版本的《用户服务协议》和《隐私政策》，再校验必填项（name / title 必填）；任一校验失败时显示提示，提交过程中按钮置 disabled 防重复提交。未获得隐私授权时 MUST NOT 调用业务云函数或传输录入数据。

#### Scenario: 未同意协议
- **WHEN** 用户未同意当前版本协议并点击提交
- **THEN** 系统提示“请先阅读并同意用户服务协议和隐私政策”，且业务云函数调用次数为 0

#### Scenario: 缺标题
- **WHEN** 用户已同意协议但 event 表单未填 title
- **THEN** 系统提示“请填写标题”，且不调用业务云函数

#### Scenario: 防止重复提交
- **WHEN** 用户已同意协议并快速双击合法表单的提交按钮
- **THEN** 第二次点击被 disabled 拦截，集合只新增 1 条

```
