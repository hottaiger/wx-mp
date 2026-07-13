# 验证报告：require-privacy-consent-before-capture

## 结论

| 维度 | 结果 |
|---|---|
| 完整性 | 3/3 OpenSpec 任务完成；2 个能力规格、5 项 Requirement 均有实现证据 |
| 正确性 | 11 个授权行为测试覆盖协议正文、版本、撤回、图片入口和保存入口；完整 CI 通过 |
| 一致性 | 实现符合 OpenSpec design 与 Superpowers Design Doc；未发现规格漂移 |

验证结果：PASS。未发现 CRITICAL、WARNING 或 SUGGESTION 问题。

## 验证证据

- `openspec status --change require-privacy-consent-before-capture --json`：`isComplete: true`。
- `node --test scripts/test-privacy-consent.js scripts/test-capture-privacy-consent.js`：退出码 0，两个测试文件通过；文件内共 11 个行为测试。
- `bash scripts/ci-build.sh`：退出码 0，最后输出 `BUILD_OK`。
- `miniprogram/utils/privacy-consent.js`：集中维护协议版本、协议正文、授权记录校验、写入和撤回。
- `miniprogram/pages/capture/index.js`：`onChooseItemImage` 与 `onSubmit` 均在数据处理前调用 `ensurePrivacyConsent()`。
- `miniprogram/pages/capture/index.wxml`：同意控件默认由授权状态驱动，提供《用户服务协议》《隐私政策》入口和可滚动弹层。
- 微信公众平台截图：用户隐私保护指引状态为“审核中”，用户生成内容场景状态为“已声明”；项目无订单中心，订单中心 path 保持未设置。

## 规格逐项核对

### privacy-consent

- 协议内容告知：结构化正文覆盖数据类型、目的、云函数/云存储处理、云数据库/云存储位置、使用范围和用户权利。
- 明确同意后方可收集：未授权时图片选择、上传、表单校验、订阅请求和业务云函数均不执行。
- 授权状态与版本绑定：仅接受当前版本且 `agreedAt` 有效的记录，旧版本自动失效。
- 撤回授权：优先删除记录；删除失败时写入无法通过校验的撤回标记，双重失败时返回失败并提示。

### quick-capture

- 提交校验：隐私守卫早于必填校验和业务副作用；授权后沿用原有校验、防重复提交和保存流程。

## 安全检查

- 未新增硬编码密钥、令牌或个人联系方式。
- 未新增前端直写数据库逻辑。
- 授权前不向云存储或业务云函数传输录入数据。
- 数据隔离与既有 `_openid` 规则保持不变。
