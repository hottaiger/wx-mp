#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

const pageFile = path.resolve(__dirname, '../miniprogram/pages/capture/index.js');
const pageTemplateFile = path.resolve(__dirname, '../miniprogram/pages/capture/index.wxml');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPage({ consentValid = false, grantResult = true, revokeResult = true } = {}) {
  const calls = {
    choose: 0,
    upload: 0,
    cloud: 0,
    grant: 0,
    revoke: 0,
    subscribe: 0,
    loading: 0,
    toasts: [],
  };
  let valid = consentValid;
  const consent = {
    isConsentValid: () => valid,
    grantConsent: () => {
      calls.grant += 1;
      if (grantResult) valid = true;
      return grantResult;
    },
    revokeConsent: () => {
      calls.revoke += 1;
      valid = false;
      return revokeResult;
    },
    getAgreement: (type) => ({
      title: type === 'service' ? '用户服务协议' : '隐私政策',
      sections: [{ title: '正文', paragraphs: ['内容'] }],
    }),
  };
  const itemImage = {
    chooseOneImage: async () => {
      calls.choose += 1;
      return { tempFilePath: '/tmp/a.png' };
    },
    uploadImage: async () => {
      calls.upload += 1;
      return { fileID: 'cloud://a', cloudPath: 'items/a.png' };
    },
  };
  const cloud = {
    call: async () => {
      calls.cloud += 1;
      return { _id: 'created-id' };
    },
  };
  const originalLoad = Module._load;
  const originalPage = global.Page;
  const originalWx = global.wx;
  const originalGetApp = global.getApp;
  const originalSetTimeout = global.setTimeout;
  let definition;

  Module._load = function load(request, parent, isMain) {
    if (request === '../../utils/privacy-consent.js') return consent;
    if (request === '../../utils/item-image.js') return itemImage;
    if (request === '../../utils/cloud.js') return cloud;
    if (request === '../../utils/time-parser.js') {
      return { parseRelativeTime: () => Date.now() + 60000 };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  global.Page = (config) => { definition = config; };
  global.wx = {
    showToast: (payload) => calls.toasts.push(payload),
    showLoading: () => { calls.loading += 1; },
    hideLoading() {},
    navigateBack() {},
    requestSubscribeMessage: async () => {
      calls.subscribe += 1;
      return {};
    },
    showModal({ success }) {
      if (success) success({ confirm: false });
    },
    redirectTo() {},
    switchTab() {},
  };
  global.getApp = () => ({ globalData: { config: {} } });
  global.setTimeout = (callback) => {
    callback();
    return 0;
  };

  delete require.cache[pageFile];
  try {
    require(pageFile);
  } catch (error) {
    global.wx = originalWx;
    global.getApp = originalGetApp;
    global.setTimeout = originalSetTimeout;
    delete require.cache[pageFile];
    throw error;
  } finally {
    Module._load = originalLoad;
    global.Page = originalPage;
  }

  const page = {
    ...definition,
    data: clone(definition.data),
    setData(patch) {
      Object.entries(patch).forEach(([key, value]) => {
        const parts = key.split('.');
        let target = this.data;
        parts.slice(0, -1).forEach((part) => { target = target[part]; });
        target[parts[parts.length - 1]] = value;
      });
    },
  };

  return {
    page,
    calls,
    restore() {
      global.wx = originalWx;
      global.getApp = originalGetApp;
      global.setTimeout = originalSetTimeout;
      delete require.cache[pageFile];
    },
  };
}

test('onLoad 仅恢复当前版本有效授权', () => {
  const fixture = loadPage({ consentValid: true });
  try {
    fixture.page.onLoad({ type: 'item' });
    assert.equal(fixture.page.data.activeTab, 'item');
    assert.equal(fixture.page.data.privacyAgreed, true);
  } finally {
    fixture.restore();
  }
});

test('未授权图片入口不选择、不上传且不显示 loading', async () => {
  const fixture = loadPage();
  try {
    await fixture.page.onChooseItemImage();
    assert.equal(fixture.calls.choose, 0);
    assert.equal(fixture.calls.upload, 0);
    assert.equal(fixture.calls.loading, 0);
    assert.equal(fixture.calls.toasts[fixture.calls.toasts.length - 1].title, '请先阅读并同意用户服务协议和隐私政策');
  } finally {
    fixture.restore();
  }
});

test('未授权提交不校验表单、不请求订阅、不调用业务云函数', async () => {
  const fixture = loadPage();
  try {
    let validateCount = 0;
    fixture.page.validateAndBuild = () => {
      validateCount += 1;
      return { type: 'event', payload: { title: 'A' }, reminder: null };
    };
    await fixture.page.onSubmit();
    assert.equal(validateCount, 0);
    assert.equal(fixture.calls.subscribe, 0);
    assert.equal(fixture.calls.cloud, 0);
    assert.equal(fixture.page.data.submitting, false);
  } finally {
    fixture.restore();
  }
});

test('有效授权继续原有图片和保存流程', async () => {
  const fixture = loadPage({ consentValid: true });
  try {
    fixture.page.data.privacyAgreed = true;
    await fixture.page.onChooseItemImage();
    assert.equal(fixture.calls.choose, 1);
    assert.equal(fixture.calls.upload, 1);
    fixture.page.validateAndBuild = () => ({
      type: 'event',
      payload: { title: 'A' },
      reminder: null,
    });
    await fixture.page.onSubmit();
    assert.equal(fixture.calls.cloud, 1);
  } finally {
    fixture.restore();
  }
});

test('主动勾选、写入失败和取消授权同步更新页面状态', () => {
  const granted = loadPage();
  try {
    granted.page.onPrivacyConsentChange({ detail: { value: ['agreed'] } });
    assert.equal(granted.calls.grant, 1);
    assert.equal(granted.page.data.privacyAgreed, true);
    granted.page.onPrivacyConsentChange({ detail: { value: [] } });
    assert.equal(granted.calls.revoke, 1);
    assert.equal(granted.page.data.privacyAgreed, false);
  } finally {
    granted.restore();
  }

  const failed = loadPage({ grantResult: false });
  try {
    failed.page.onPrivacyConsentChange({ detail: { value: ['agreed'] } });
    assert.equal(failed.page.data.privacyAgreed, false);
    assert.equal(failed.calls.toasts[failed.calls.toasts.length - 1].title, '授权保存失败，请稍后重试');
  } finally {
    failed.restore();
  }

  const revokeFailed = loadPage({ consentValid: true, revokeResult: false });
  try {
    revokeFailed.page.data.privacyAgreed = true;
    revokeFailed.page.onPrivacyConsentChange({ detail: { value: [] } });
    assert.equal(revokeFailed.page.data.privacyAgreed, false);
    assert.equal(revokeFailed.calls.toasts[revokeFailed.calls.toasts.length - 1].title, '授权撤回失败，请稍后重试');
  } finally {
    revokeFailed.restore();
  }
});

test('协议弹层按类型展示并可关闭', () => {
  const fixture = loadPage();
  try {
    fixture.page.onOpenAgreement({ currentTarget: { dataset: { type: 'privacy' } } });
    assert.equal(fixture.page.data.privacyDialogVisible, true);
    assert.equal(fixture.page.data.privacyDialogTitle, '隐私政策');
    assert.equal(fixture.page.data.privacyDialogSections.length, 1);
    fixture.page.onClosePrivacyDialog();
    assert.equal(fixture.page.data.privacyDialogVisible, false);
  } finally {
    fixture.restore();
  }
});

test('隐私授权确认区消费点击事件，避免穿透到底部保存按钮', () => {
  const template = fs.readFileSync(pageTemplateFile, 'utf8');
  assert.match(template, /<checkbox-group class="privacy-consent" catchtap="noop" bindchange="onPrivacyConsentChange">/);
});
