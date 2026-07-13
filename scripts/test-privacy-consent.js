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

test('撤回删除授权记录，删除失败时写入失效标记', () => {
  const storage = createStorage({ version: privacyConsent.CONSENT_VERSION, agreedAt: 1720857600000 });
  assert.equal(privacyConsent.revokeConsent(storage), true);
  assert.equal(storage.readValue(), undefined);
  const fallbackStorage = createStorage(
    { version: privacyConsent.CONSENT_VERSION, agreedAt: 1720857600000 },
    { remove: true },
  );
  assert.equal(privacyConsent.revokeConsent(fallbackStorage), true);
  assert.equal(privacyConsent.isConsentValid(fallbackStorage), false);
  assert.equal(privacyConsent.revokeConsent(createStorage(undefined, { remove: true, write: true })), false);
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
    '不出售', '广告营销', '删除记录', '取消授权', '认证主体', '反馈与投诉',
    '生效日期', '责任边界', '终止', '争议处理', '查询', '更正'].forEach((word) => {
    assert.match(text, new RegExp(word));
  });
});
