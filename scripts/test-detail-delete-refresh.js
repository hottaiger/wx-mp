#!/usr/bin/env node
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const pageFile = path.resolve(__dirname, '../miniprogram/pages/detail/index.js');

function loadPage() {
  const calls = { remove: 0, navigateBack: 0 };
  const previousPage = {};
  const originalLoad = Module._load;
  const originalPage = global.Page;
  const originalWx = global.wx;
  const originalPages = global.getCurrentPages;
  const originalSetTimeout = global.setTimeout;
  let definition;

  Module._load = function load(request, parent, isMain) {
    if (request === '../../utils/cloud.js') {
      return { call: async (name, payload) => {
        assert.equal(name, 'item');
        assert.deepEqual(payload, { action: 'remove', id: 'item-1' });
        calls.remove += 1;
      } };
    }
    if (request === '../../utils/storage.js') return { clear() {} };
    if (request === '../../utils/share.js') return { ensureShareMenu() {}, buildSharePayload() {} };
    if (request === '../../utils/item-image.js') return {};
    if (request === '../../utils/relation-view.js') return { groupRelationsByType() { return []; } };
    return originalLoad.call(this, request, parent, isMain);
  };
  global.Page = (config) => { definition = config; };
  global.wx = {
    showModal({ success }) { success({ confirm: true }); },
    showToast() {},
    navigateBack() { calls.navigateBack += 1; },
  };
  global.getCurrentPages = () => [previousPage, page];
  global.setTimeout = (callback) => { callback(); return 0; };

  delete require.cache[pageFile];
  try {
    require(pageFile);
  } finally {
    Module._load = originalLoad;
    global.Page = originalPage;
  }

  const page = Object.assign({}, definition, { data: Object.assign({}, definition.data, { type: 'item', id: 'item-1' }) });
  return {
    page,
    previousPage,
    calls,
    restore() {
      global.wx = originalWx;
      global.getCurrentPages = originalPages;
      global.setTimeout = originalSetTimeout;
      delete require.cache[pageFile];
    },
  };
}

test('删除详情记录后标记前一页刷新并返回', async () => {
  const fixture = loadPage();
  try {
    fixture.page.onDeleteTap();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.calls.remove, 1);
    assert.equal(fixture.previousPage._needRefresh, true);
    assert.equal(fixture.calls.navigateBack, 1);
  } finally {
    fixture.restore();
  }
});
