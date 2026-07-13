---
change: require-privacy-consent-before-capture
design-doc: docs/superpowers/specs/2026-07-13-privacy-consent-before-capture-design.md
base-ref: a51cecc17c4d0e354300451465c139cb57ff156e
archived-with: 2026-07-13-require-privacy-consent-before-capture
---

# 录入前隐私授权 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在“记一笔”页面完整展示协议，并确保用户主动同意当前协议版本前，图片选择/上传和业务提交均不会发生。

**Architecture:** 新建纯 CommonJS 授权领域模块，集中管理协议正文、版本化授权记录和异常降级；录入页仅维护展示状态，并通过统一 `ensurePrivacyConsent()` 守卫保护图片与提交入口。页面测试用 `node:test` 注入 `Page`、`wx` 和依赖模块，直接证明守卫位于所有副作用之前。

**Tech Stack:** 微信小程序 WXML/WXSS/CommonJS、微信同步存储 API、`node:test`、Shell CI

## Global Constraints

- 协议版本固定为 `2026-07-13`，授权记录固定为 `{ version, agreedAt }`。
- 隐私提示固定为“请先阅读并同意用户服务协议和隐私政策”。
- 授权默认不勾选；旧版本、损坏记录、读取异常均视为未授权。
- 图片入口必须在 `wx.showLoading`、图片选择和 `wx.cloud.uploadFile` 之前执行授权守卫。
- 提交入口必须在表单校验、loading、订阅消息授权及任何业务云函数调用之前执行授权守卫。
- 取消勾选立即删除授权记录；写入失败时保持未授权并提示“授权保存失败，请稍后重试”。
- 不新增页面路由，不改变现有云函数名、集合名、`_openid` 数据隔离及云函数写入路径。
- 协议正文必须覆盖姓名、事项、物品、标签、备注、时间、属性、可选图片、提醒信息，以及使用目的、处理方式、存储位置、使用范围和用户控制。
- 代码内协议不能替代微信公众平台后台的《小程序用户隐私保护指引》；发布前须人工核对后台声明包含“选中的照片或视频信息”及云开发存储用途。

archived-with: 2026-07-13-require-privacy-consent-before-capture
---

## 文件结构

- Create: `miniprogram/utils/privacy-consent.js` — 唯一的协议版本、正文和授权持久化边界。
- Create: `scripts/test-privacy-consent.js` — 授权模块的版本、异常、授权/撤回及协议内容单元测试。
- Create: `scripts/test-capture-privacy-consent.js` — 录入页控制器边界测试，验证图片与提交双守卫及勾选交互。
- Modify: `miniprogram/pages/capture/index.js` — 页面状态、协议弹层动作、授权切换和统一守卫。
- Modify: `miniprogram/pages/capture/index.wxml` — 默认未勾选确认区及可滚动协议弹层。
- Modify: `miniprogram/pages/capture/index.wxss` — 确认区和弹层样式。
- Modify: `scripts/ci-build.sh` — 把两组隐私测试加入仓库基础校验。
- Modify: `openspec/changes/require-privacy-consent-before-capture/tasks.md` — 仅在全部验证通过后勾选对应任务。

### Task 1: 版本化隐私授权领域模块

**Files:**
- Create: `miniprogram/utils/privacy-consent.js`
- Create: `scripts/test-privacy-consent.js`

**Interfaces:**
- Consumes: 默认存储适配器 `{ getStorageSync, setStorageSync, removeStorageSync }`，来自全局 `wx`；测试可显式传入同形对象。
- Produces: `CONSENT_VERSION: string`、`CONSENT_STORAGE_KEY: string`、`getAgreement(type: 'service'|'privacy'): Agreement|null`、`isConsentValid(storage?): boolean`、`grantConsent(storage?, now?): boolean`、`revokeConsent(storage?): boolean`；`Agreement` 形状为 `{ title: string, sections: Array<{ title: string, paragraphs: string[] }> }`。

- [x] **Step 1: 编写授权模块失败测试**

创建 `scripts/test-privacy-consent.js`，完整内容如下：

```js
#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');

const privacyConsent = require('../miniprogram/utils/privacy-consent.js');

function createStorage(initialValue, failures = {}) {
  let value = initialValue;
  return {
    getStorageSync(key) {
      assert.equal(key, privacyConsent.CONSENT_STORAGE_KEY);
      if (failures.read) throw new Error('read failed');
      return value;
    },
    setStorageSync(key, nextValue) {
      assert.equal(key, privacyConsent.CONSENT_STORAGE_KEY);
      if (failures.write) throw new Error('write failed');
      value = nextValue;
    },
    removeStorageSync(key) {
      assert.equal(key, privacyConsent.CONSENT_STORAGE_KEY);
      if (failures.remove) throw new Error('remove failed');
      value = undefined;
    },
    readValue() { return value; },
  };
}

test('无记录、损坏记录、旧版本和读取异常均无效', () => {
  assert.equal(privacyConsent.isConsentValid(createStorage()), false);
  assert.equal(privacyConsent.isConsentValid(createStorage('bad')), false);
  assert.equal(privacyConsent.isConsentValid(createStorage({ version: '2026-07-12', agreedAt: 1 })), false);
  assert.equal(privacyConsent.isConsentValid(createStorage({ version: privacyConsent.CONSENT_VERSION, agreedAt: 0 })), false);
  assert.equal(privacyConsent.isConsentValid(createStorage(undefined, { read: true })), false);
});

test('当前版本且同意时间有效时授权有效', () => {
  const storage = createStorage({ version: privacyConsent.CONSENT_VERSION, agreedAt: 1720857600000 });
  assert.equal(privacyConsent.isConsentValid(storage), true);
});

test('主动同意写入当前版本和同意时间，写入失败返回 false', () => {
  const storage = createStorage();
  assert.equal(privacyConsent.grantConsent(storage, 1720857600000), true);
  assert.deepEqual(storage.readValue(), {
    version: privacyConsent.CONSENT_VERSION,
    agreedAt: 1720857600000,
  });
  assert.equal(privacyConsent.grantConsent(createStorage(undefined, { write: true }), 1720857600000), false);
});

test('撤回删除授权记录，删除失败返回 false', () => {
  const storage = createStorage({ version: privacyConsent.CONSENT_VERSION, agreedAt: 1720857600000 });
  assert.equal(privacyConsent.revokeConsent(storage), true);
  assert.equal(storage.readValue(), undefined);
  assert.equal(privacyConsent.revokeConsent(createStorage(undefined, { remove: true })), false);
});

test('协议正文完整披露数据、目的、处理、存储、范围和用户控制', () => {
  const service = privacyConsent.getAgreement('service');
  const privacy = privacyConsent.getAgreement('privacy');
  assert.equal(service.title, '用户服务协议');
  assert.equal(privacy.title, '隐私政策');
  assert.equal(privacyConsent.getAgreement('unknown'), null);
  const text = JSON.stringify([service, privacy]);
  ['姓名', '事项', '物品', '标签', '备注', '时间', '属性', '图片', '提醒',
    '记录管理', '实体关联', '周复盘', '云函数', '云存储', '云数据库',
    '不出售', '广告营销', '删除记录', '取消授权'].forEach((word) => {
    assert.match(text, new RegExp(word));
  });
});
```

- [x] **Step 2: 运行测试，确认因模块缺失而失败**

Run: `node --test scripts/test-privacy-consent.js`

Expected: FAIL，包含 `Cannot find module '../miniprogram/utils/privacy-consent.js'`。

- [x] **Step 3: 实现最小且完整的授权领域模块**

创建 `miniprogram/utils/privacy-consent.js`：

```js
const CONSENT_VERSION = '2026-07-13';
const CONSENT_STORAGE_KEY = 'privacy-consent';

const AGREEMENTS = {
  service: {
    title: '用户服务协议',
    sections: [
      { title: '一、服务内容', paragraphs: ['微录用于记录和管理用户主动填写的人、事、物信息，建立实体关联并生成周复盘；提醒仅在用户主动开启时提供。'] },
      { title: '二、用户责任', paragraphs: ['用户应确保录入内容合法，并对录入内容拥有相应权利；不得利用本服务侵害他人合法权益。'] },
      { title: '三、数据与控制', paragraphs: ['用户可查看、编辑或删除记录，也可随时取消本机授权。取消授权后停止新增数据上传，已保存记录仍可使用现有删除功能处理。'] },
    ],
  },
  privacy: {
    title: '隐私政策',
    sections: [
      { title: '一、收集的数据', paragraphs: ['我们处理用户主动填写的姓名、事项、物品、标签、备注、时间、属性、可选图片和提醒信息。'] },
      { title: '二、使用目的', paragraphs: ['这些数据仅用于记录管理、实体关联、周复盘和用户主动开启的提醒。'] },
      { title: '三、处理与存储', paragraphs: ['数据通过微信云开发云函数或云存储传输，并保存在微信云开发的云数据库或云存储中。'] },
      { title: '四、使用范围', paragraphs: ['数据仅用于向当前微信用户提供上述功能；我们不出售用户数据，也不用于广告营销。'] },
      { title: '五、用户控制', paragraphs: ['用户可以删除记录或取消授权。取消授权后停止新增数据上传，已保存记录仍可按现有删除功能处理。'] },
    ],
  },
};

function defaultStorage() { return wx; }

function getAgreement(type) {
  return AGREEMENTS[type] || null;
}

function isConsentValid(storage = defaultStorage()) {
  try {
    const record = storage.getStorageSync(CONSENT_STORAGE_KEY);
    return Boolean(record && typeof record === 'object'
      && record.version === CONSENT_VERSION
      && Number.isFinite(record.agreedAt) && record.agreedAt > 0);
  } catch (err) {
    return false;
  }
}

function grantConsent(storage = defaultStorage(), now = Date.now()) {
  try {
    storage.setStorageSync(CONSENT_STORAGE_KEY, { version: CONSENT_VERSION, agreedAt: now });
    return true;
  } catch (err) {
    return false;
  }
}

function revokeConsent(storage = defaultStorage()) {
  try {
    storage.removeStorageSync(CONSENT_STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  CONSENT_VERSION,
  CONSENT_STORAGE_KEY,
  getAgreement,
  isConsentValid,
  grantConsent,
  revokeConsent,
};
```

- [x] **Step 4: 运行授权模块测试，确认通过**

Run: `node --test scripts/test-privacy-consent.js`

Expected: PASS，`tests 5`、`fail 0`。

- [x] **Step 5: 提交授权领域模块**

```bash
git add miniprogram/utils/privacy-consent.js scripts/test-privacy-consent.js
git commit -m "feat: add versioned privacy consent module"
```

### Task 2: 录入页双入口授权守卫与交互闭环

**Files:**
- Create: `scripts/test-capture-privacy-consent.js`
- Modify: `miniprogram/pages/capture/index.js:2-49,76-89,176-184`
- Modify: `miniprogram/pages/capture/index.wxml:155-159`
- Modify: `miniprogram/pages/capture/index.wxss:1,57-60`

**Interfaces:**
- Consumes: Task 1 的 `getAgreement`、`isConsentValid`、`grantConsent`、`revokeConsent`。
- Produces: 页面方法 `ensurePrivacyConsent(): boolean`、`onPrivacyConsentChange(event): void`、`onOpenAgreement(event): void`、`onClosePrivacyDialog(): void`；页面状态 `privacyAgreed`、`privacyDialogVisible`、`privacyDialogTitle`、`privacyDialogSections`。

- [x] **Step 1: 编写页面控制器失败测试，覆盖两个守卫和授权交互**

创建 `scripts/test-capture-privacy-consent.js`。测试加载器必须复制页面初始 `data`，支持 `form.coverImage` 点路径写入，并在每个测试后恢复 `Module._load`、`global.Page`、`global.wx`、`global.getApp`：

```js
#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const pageFile = path.resolve(__dirname, '../miniprogram/pages/capture/index.js');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadPage({ consentValid = false, grantResult = true, revokeResult = true } = {}) {
  const calls = { choose: 0, upload: 0, cloud: 0, grant: 0, revoke: 0, toasts: [] };
  const consent = {
    isConsentValid: () => consentValid,
    grantConsent: () => { calls.grant += 1; return grantResult; },
    revokeConsent: () => { calls.revoke += 1; return revokeResult; },
    getAgreement: (type) => ({ title: type === 'service' ? '用户服务协议' : '隐私政策', sections: [{ title: '正文', paragraphs: ['内容'] }] }),
  };
  const itemImage = {
    chooseOneImage: async () => { calls.choose += 1; return { tempFilePath: '/tmp/a.png' }; },
    uploadImage: async () => { calls.upload += 1; return { fileID: 'cloud://a', cloudPath: 'items/a.png' }; },
  };
  const cloud = { call: async () => { calls.cloud += 1; return { _id: 'created-id' }; } };
  const originalLoad = Module._load;
  const originalPage = global.Page;
  const originalWx = global.wx;
  const originalGetApp = global.getApp;
  let definition;
  Module._load = function(request, parent, isMain) {
    if (request === '../../utils/privacy-consent.js') return consent;
    if (request === '../../utils/item-image.js') return itemImage;
    if (request === '../../utils/cloud.js') return cloud;
    if (request === '../../utils/time-parser.js') return { parseRelativeTime: () => Date.now() + 60000 };
    return originalLoad.call(this, request, parent, isMain);
  };
  global.Page = (config) => { definition = config; };
  global.wx = {
    showToast: (payload) => calls.toasts.push(payload),
    showLoading() {}, hideLoading() {}, navigateBack() {},
    requestSubscribeMessage: async () => ({}),
  };
  global.getApp = () => ({ globalData: { config: {} } });
  delete require.cache[pageFile];
  require(pageFile);
  Module._load = originalLoad;
  global.Page = originalPage;
  const page = {
    ...definition,
    data: clone(definition.data),
    setData(patch) {
      Object.entries(patch).forEach(([key, value]) => {
        const parts = key.split('.');
        let target = this.data;
        parts.slice(0, -1).forEach((part) => { target = target[part]; });
        target[parts.at(-1)] = value;
      });
    },
  };
  return {
    page, calls,
    restore() { global.wx = originalWx; global.getApp = originalGetApp; },
  };
}

test('onLoad 仅恢复当前版本有效授权', (t) => {
  const fixture = loadPage({ consentValid: true });
  t.after(fixture.restore);
  fixture.page.onLoad({ type: 'item' });
  assert.equal(fixture.page.data.activeTab, 'item');
  assert.equal(fixture.page.data.privacyAgreed, true);
});

test('未授权图片入口不选择、不上传且不显示 loading', async (t) => {
  const fixture = loadPage();
  t.after(fixture.restore);
  let loadingCount = 0;
  global.wx.showLoading = () => { loadingCount += 1; };
  await fixture.page.onChooseItemImage();
  assert.equal(fixture.calls.choose, 0);
  assert.equal(fixture.calls.upload, 0);
  assert.equal(loadingCount, 0);
  assert.equal(fixture.calls.toasts.at(-1).title, '请先阅读并同意用户服务协议和隐私政策');
});

test('未授权提交不校验表单、不请求订阅、不调用业务云函数', async (t) => {
  const fixture = loadPage();
  t.after(fixture.restore);
  let validateCount = 0;
  fixture.page.validateAndBuild = () => { validateCount += 1; return { type: 'event', payload: { title: 'A' }, reminder: null }; };
  await fixture.page.onSubmit();
  assert.equal(validateCount, 0);
  assert.equal(fixture.calls.cloud, 0);
  assert.equal(fixture.page.data.submitting, false);
});

test('有效授权继续原有图片和保存流程', async (t) => {
  const fixture = loadPage({ consentValid: true });
  t.after(fixture.restore);
  fixture.page.data.privacyAgreed = true;
  await fixture.page.onChooseItemImage();
  assert.equal(fixture.calls.choose, 1);
  assert.equal(fixture.calls.upload, 1);
  fixture.page.validateAndBuild = () => ({ type: 'event', payload: { title: 'A' }, reminder: null });
  global.setTimeout = () => 0;
  await fixture.page.onSubmit();
  assert.equal(fixture.calls.cloud, 1);
});

test('主动勾选、写入失败和取消授权同步更新页面状态', (t) => {
  const granted = loadPage({ consentValid: true });
  t.after(granted.restore);
  granted.page.onPrivacyConsentChange({ detail: { value: ['agreed'] } });
  assert.equal(granted.calls.grant, 1);
  assert.equal(granted.page.data.privacyAgreed, true);
  granted.page.onPrivacyConsentChange({ detail: { value: [] } });
  assert.equal(granted.calls.revoke, 1);
  assert.equal(granted.page.data.privacyAgreed, false);

  const failed = loadPage({ grantResult: false });
  t.after(failed.restore);
  failed.page.onPrivacyConsentChange({ detail: { value: ['agreed'] } });
  assert.equal(failed.page.data.privacyAgreed, false);
  assert.equal(failed.calls.toasts.at(-1).title, '授权保存失败，请稍后重试');
});

test('协议弹层按类型展示并可关闭', (t) => {
  const fixture = loadPage();
  t.after(fixture.restore);
  fixture.page.onOpenAgreement({ currentTarget: { dataset: { type: 'privacy' } } });
  assert.equal(fixture.page.data.privacyDialogVisible, true);
  assert.equal(fixture.page.data.privacyDialogTitle, '隐私政策');
  assert.equal(fixture.page.data.privacyDialogSections.length, 1);
  fixture.page.onClosePrivacyDialog();
  assert.equal(fixture.page.data.privacyDialogVisible, false);
});
```

- [x] **Step 2: 运行页面测试，确认页面尚未实现接口**

Run: `node --test scripts/test-capture-privacy-consent.js`

Expected: FAIL，首个失败包含 `privacyAgreed` 不符合预期或 `ensurePrivacyConsent is not a function`。

- [x] **Step 3: 在页面控制器接入授权模块和统一守卫**

在 `miniprogram/pages/capture/index.js` 顶部加入：

```js
const privacyConsent = require('../../utils/privacy-consent.js');
const PRIVACY_PROMPT = '请先阅读并同意用户服务协议和隐私政策';
```

在 `data` 中加入：

```js
privacyAgreed: false,
privacyDialogVisible: false,
privacyDialogTitle: '',
privacyDialogSections: [],
```

将 `onLoad` 与新增方法实现为：

```js
onLoad(opts) {
  const tab = TABS.find((t) => t.key === opts.type) ? opts.type : 'event';
  this.setData({
    activeTab: tab,
    privacyAgreed: privacyConsent.isConsentValid(),
  });
},

ensurePrivacyConsent() {
  const valid = this.data.privacyAgreed && privacyConsent.isConsentValid();
  if (valid) return true;
  this.setData({ privacyAgreed: false });
  wx.showToast({ title: PRIVACY_PROMPT, icon: 'none' });
  return false;
},

onPrivacyConsentChange(e) {
  const agreed = Array.isArray(e.detail.value) && e.detail.value.includes('agreed');
  if (!agreed) {
    privacyConsent.revokeConsent();
    this.setData({ privacyAgreed: false });
    return;
  }
  const saved = privacyConsent.grantConsent();
  this.setData({ privacyAgreed: saved });
  if (!saved) wx.showToast({ title: '授权保存失败，请稍后重试', icon: 'none' });
},

onOpenAgreement(e) {
  const agreement = privacyConsent.getAgreement(e.currentTarget.dataset.type);
  if (!agreement) return;
  this.setData({
    privacyDialogVisible: true,
    privacyDialogTitle: agreement.title,
    privacyDialogSections: agreement.sections,
  });
},

onClosePrivacyDialog() {
  this.setData({ privacyDialogVisible: false });
},
```

把图片方法的第一行和提交方法的前两行改为：

```js
async onChooseItemImage() {
  if (!this.ensurePrivacyConsent()) return;
  try {
    wx.showLoading({ title: '上传中...' });
    // 保留原有选择、上传、成功和异常处理代码
  }
},

async onSubmit() {
  if (this.data.submitting) return;
  if (!this.ensurePrivacyConsent()) return;
  const r = this.validateAndBuild();
  // 保留原有校验和提交代码
},
```

这里的顺序不可调整：图片守卫必须早于 `wx.showLoading` 和 `chooseOneImage`；提交守卫必须早于 `validateAndBuild`、`setData({ submitting: true })`、订阅消息和 `cloud.call`。

- [x] **Step 4: 增加协议确认区和可滚动弹层**

将 `miniprogram/pages/capture/index.wxml` 的 dock 替换为：

```xml
<view class="dock">
  <checkbox-group class="privacy-consent" bindchange="onPrivacyConsentChange">
    <label class="privacy-consent__label">
      <checkbox value="agreed" checked="{{privacyAgreed}}" color="#2F4A3A" />
      <text>我已阅读并同意</text>
    </label>
    <text class="privacy-consent__link" data-type="service" catchtap="onOpenAgreement">《用户服务协议》</text>
    <text>和</text>
    <text class="privacy-consent__link" data-type="privacy" catchtap="onOpenAgreement">《隐私政策》</text>
  </checkbox-group>
  <view class="dock__btn {{submitting ? 'dock__btn--disabled' : ''}}" hover-class="{{submitting ? '' : 'press'}}" bindtap="onSubmit">保存</view>
</view>

<view class="privacy-dialog" wx:if="{{privacyDialogVisible}}" catchtouchmove="noop">
  <view class="privacy-dialog__mask" bindtap="onClosePrivacyDialog"></view>
  <view class="privacy-dialog__panel">
    <view class="privacy-dialog__head">
      <text class="privacy-dialog__title">{{privacyDialogTitle}}</text>
      <view class="privacy-dialog__close" bindtap="onClosePrivacyDialog">×</view>
    </view>
    <scroll-view class="privacy-dialog__body" scroll-y>
      <view class="privacy-dialog__section" wx:for="{{privacyDialogSections}}" wx:key="title">
        <view class="privacy-dialog__section-title">{{item.title}}</view>
        <view class="privacy-dialog__paragraph" wx:for="{{item.paragraphs}}" wx:key="*this" wx:for-item="paragraph">{{paragraph}}</view>
      </view>
    </scroll-view>
  </view>
</view>
```

在页面控制器加入空事件方法，阻止弹层触摸穿透：

```js
noop() {},
```

- [x] **Step 5: 增加确认区和弹层样式**

把 `miniprogram/pages/capture/index.wxss` 的 `.page` 底部留白改为 `280rpx`，并追加：

```css
.privacy-consent { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; margin-bottom: 18rpx; color: var(--ink-3); font-size: 22rpx; line-height: 1.6; }
.privacy-consent__label { display: flex; align-items: center; }
.privacy-consent__label checkbox { transform: scale(0.72); transform-origin: center; }
.privacy-consent__link { color: var(--brand); }

.privacy-dialog { position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; }
.privacy-dialog__mask { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.45); }
.privacy-dialog__panel { position: relative; width: 100%; max-height: 80vh; padding: var(--s-3); padding-bottom: calc(var(--s-4) + env(safe-area-inset-bottom, 0)); border-radius: var(--r-md) var(--r-md) 0 0; background: var(--bg-elevated); }
.privacy-dialog__head { display: flex; align-items: center; padding-bottom: var(--s-3); border-bottom: 1rpx solid var(--line); }
.privacy-dialog__title { flex: 1; color: var(--ink-1); font-size: 32rpx; font-weight: 600; }
.privacy-dialog__close { padding: 8rpx 16rpx; color: var(--ink-3); font-size: 40rpx; }
.privacy-dialog__body { height: 60vh; }
.privacy-dialog__section { padding-top: var(--s-3); }
.privacy-dialog__section-title { margin-bottom: var(--s-2); color: var(--ink-1); font-size: 28rpx; font-weight: 600; }
.privacy-dialog__paragraph { margin-bottom: var(--s-2); color: var(--ink-2); font-size: 26rpx; line-height: 1.7; }
```

- [x] **Step 6: 运行页面与授权模块测试，确认通过**

Run: `node --test scripts/test-privacy-consent.js scripts/test-capture-privacy-consent.js`

Expected: PASS，`tests 11`、`fail 0`；其中明确包含“未授权图片入口不选择、不上传”和“未授权提交不校验表单、不请求订阅、不调用业务云函数”。

- [x] **Step 7: 提交录入页授权闭环**

```bash
git add miniprogram/pages/capture/index.js miniprogram/pages/capture/index.wxml miniprogram/pages/capture/index.wxss scripts/test-capture-privacy-consent.js
git commit -m "feat: guard capture behind privacy consent"
```

### Task 3: CI 接入、规格任务同步与发布核对

**Files:**
- Modify: `scripts/ci-build.sh:15-23`
- Modify: `openspec/changes/require-privacy-consent-before-capture/tasks.md:1-10`

**Interfaces:**
- Consumes: Task 1、Task 2 的两组 `node:test` 测试入口。
- Produces: `bash scripts/ci-build.sh` 对隐私授权行为的持续回归门禁；OpenSpec 任务状态与真实验证结果一致。

- [x] **Step 1: 先证明现有 CI 尚未执行隐私测试**

Run: `rg -n "test-(privacy-consent|capture-privacy-consent)" scripts/ci-build.sh`

Expected: 无输出，退出码为 1。

- [x] **Step 2: 将两组测试加入基础校验**

在 `scripts/ci-build.sh` 的既有脚本测试之后、内容安全副本一致性检查之前加入：

```bash
node --test scripts/test-privacy-consent.js
node --test scripts/test-capture-privacy-consent.js
```

- [x] **Step 3: 运行完整基础校验**

Run: `bash scripts/ci-build.sh`

Expected: 所有语法、JSON、关系、删除、内容安全和隐私授权测试通过，最后一行输出 `BUILD_OK`。

- [x] **Step 4: 按规格逐项核对双守卫与正文覆盖**

Run:

```bash
node --test scripts/test-privacy-consent.js scripts/test-capture-privacy-consent.js
rg -n "ensurePrivacyConsent|onChooseItemImage|onSubmit|用户服务协议|隐私政策" miniprogram/pages/capture/index.js miniprogram/pages/capture/index.wxml
```

Expected: 11 个测试通过、0 失败；`onChooseItemImage` 和 `onSubmit` 均直接调用 `ensurePrivacyConsent`；WXML 同时包含两个协议入口。

- [x] **Step 5: 人工核对微信公众平台隐私保护指引**

打开微信公众平台的小程序隐私保护指引配置，确认声明与代码一致：包含用户主动填写的人/事/物信息、提醒信息、“选中的照片或视频信息”，处理目的为记录管理/实体关联/周复盘/提醒，存储位置为微信云开发云数据库与云存储。若后台任何一项不一致，先修正后台声明再提交审核；该检查不由代码内协议替代。

- [x] **Step 6: 仅在 Step 3、Step 4、Step 5 均通过后更新 OpenSpec 任务状态**

将 `openspec/changes/require-privacy-consent-before-capture/tasks.md` 更新为：

```markdown
## 1. 隐私授权基础能力

- [x] 1.1 以测试驱动方式新增协议版本、协议正文和本地授权状态工具模块，覆盖有效授权、版本失效和撤回。

## 2. 录入页授权闭环

- [x] 2.1 在录入页实现协议入口、可滚动协议弹层、主动勾选和提交前拦截，确保未授权时不调用业务云函数。

## 3. 验证与规格同步

- [x] 3.1 增加录入页授权边界测试，运行 `bash scripts/ci-build.sh`，并根据验证结果同步任务状态。
```

- [x] **Step 7: 提交 CI 和规格状态**

```bash
git add scripts/ci-build.sh openspec/changes/require-privacy-consent-before-capture/tasks.md
git commit -m "test: verify privacy consent workflow"
```

## 完成验收

- [x] `node --test scripts/test-privacy-consent.js scripts/test-capture-privacy-consent.js` 为 11 tests、0 fail。
- [x] `bash scripts/ci-build.sh` 最后一行是 `BUILD_OK`。
- [x] 未授权点击图片时：提示固定文案，选择次数 0、上传次数 0、loading 次数 0。
- [x] 未授权点击保存时：提示固定文案，表单校验次数 0、订阅授权次数 0、业务云函数次数 0。
- [x] 当前版本授权后，图片上传与合法保存沿用原流程且各执行 1 次。
- [x] 取消授权后本地记录被删除，下一次图片或保存操作重新被拦截。
- [x] 两份协议均可在不离开录入页、不丢失表单内容的情况下打开、滚动和关闭。
- [x] 微信公众平台后台隐私保护指引已与实际数据类型及云开发用途逐项一致。

