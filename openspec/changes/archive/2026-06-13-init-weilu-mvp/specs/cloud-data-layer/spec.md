## ADDED Requirements

### Requirement: 云函数统一鉴权
系统 MUST 在每个业务云函数入口校验 `wx.getWXContext().OPENID`，未通过鉴权时返回 `ERR_UNAUTHORIZED`。

#### Scenario: 合法 openid 调用
- **WHEN** 客户端传入 `wx.cloud.callFunction` 调用 `createPerson`
- **THEN** 云函数读取 OPENID 并以该 OPENID 写入 `persons._openid`

#### Scenario: 无 OPENID 直连
- **WHEN** 请求上下文缺少 OPENID
- **THEN** 云函数返回 `{ code: 'ERR_UNAUTHORIZED', message: '...' }`，HTTP 状态 401

### Requirement: 跨集合数据隔离
系统 MUST 在 `persons / events / items / relations / reminders` 所有集合的写入上强制写入 `_openid`，查询时仅返回当前 OPENID 的文档。

#### Scenario: 跨用户读取被隔离
- **WHEN** 用户 A 调用 `listEvents` 拉取列表
- **THEN** 返回结果只包含 `_openid == A` 的 events

#### Scenario: 跨用户写入被拒
- **WHEN** 客户端尝试以 `_openid=B` 写入
- **THEN** 云函数覆盖 `_openid` 为调用者 OPENID，写入始终属于调用者

#### Scenario: list 强制 _openid 过滤
- **WHEN** 客户端不传 _openid 直接调 `listEvents`
- **THEN** 云函数在 where 条件强制注入 `_openid == 当前OPENID`，客户端无法绕过

### Requirement: 统一错误码
系统 MUST 业务云函数返回结构 `{ code: string, data?: any, message?: string }`，错误码枚举：`ERR_UNAUTHORIZED / ERR_NOT_FOUND / ERR_VALIDATION / ERR_INTERNAL`。

#### Scenario: 校验失败
- **WHEN** 必填字段缺失
- **THEN** 返回 `{ code: 'ERR_VALIDATION', message: '<字段名> 必填' }`

### Requirement: 集合索引
系统 MUST 在 `events.startAt`、`relations.fromId`、`relations.toId`、`reminders.sendAt` 上建立数据库索引。

#### Scenario: 索引缺失告警
- **WHEN** 上线后查询日志发现全表扫描
- **THEN** 提示需补建对应字段索引

### Requirement: 公共包与按域部署
系统 MUST 把鉴权、错误码、crud 基类抽到 `cloudfunctions/common/`，各业务域（person / event / item / relation / reminder / weeklyStats）独立云函数部署，仅 require 引用公共包。

#### Scenario: 公共代码复用
- **WHEN** 业务函数 require `common/withAuth`
- **THEN** 拿到一致的鉴权与错误返回

#### Scenario: 独立冷启动
- **WHEN** 部署 reminder 函数后调用 person 函数
- **THEN** person 函数不受 reminder 部署影响

### Requirement: 列表查询边界
系统 MUST 在所有 list 接口强制注入 `_openid` 过滤、按 `updatedAt` 或业务指定字段排序、限制 `pageSize ≤ 100`。

#### Scenario: 超限 pageSize
- **WHEN** 客户端传 pageSize=500
- **THEN** 云函数截断到 100 并返回

#### Scenario: 无排序
- **WHEN** 客户端不传 orderBy
- **THEN** 默认 `updatedAt desc`，避免全表无序扫描
