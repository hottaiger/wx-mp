## Why

录入页“我已阅读并同意《用户服务协议》和《隐私政策》”确认区的点击会穿透到底部保存操作，用户仅切换授权状态时可能误触发录入提交。

## What Changes

- 阻止隐私授权确认区及协议链接的点击事件触发底部保存操作。
- 保持主动勾选、撤回授权和查看协议的既有行为不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `privacy-consent`: 协议确认区和协议入口的交互不得触发录入提交。

## Impact

- `miniprogram/pages/capture/index.wxml` 的事件绑定。
- 录入页隐私授权交互测试。
