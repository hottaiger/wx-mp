const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

function loadEntity(entity, options = {}) {
  const calls = [];
  const collectionByEntity = { person: 'persons', event: 'events', item: 'items' };
  const fakeDb = {
    command: {
      in: (value) => value,
      and: (value) => value,
      or: (value) => value,
    },
    RegExp: (value) => value,
    collection: () => ({
      where: () => ({
        get: async () => ({ data: [] }),
        remove: async () => ({ removed: 0 }),
      }),
    }),
  };
  const fakeCloud = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    database: () => fakeDb,
  };
  const fakeCommon = {
    errors: { ERROR_CODES: { VALIDATION: 'ERR_VALIDATION' } },
    withAuth: (handler) => (event) => handler(event, { openid: 'openid-1' }),
    crud: {
      create: async (collection) => {
        calls.push(`create:${entity}`);
        assert.equal(collection, collectionByEntity[entity]);
        return { _id: 'new-id' };
      },
      update: async (collection) => {
        calls.push(`update:${entity}`);
        assert.equal(collection, collectionByEntity[entity]);
        return { _id: 'id-1' };
      },
      getOne: async (collection, id) => {
        calls.push(`getOne:${id}`);
        return options.current || {};
      },
      list: async () => ({ list: [], total: 0 }),
      remove: async () => ({ removed: 1 }),
    },
    contentSecurity: {
      assertTextSafe: async ({ openid, payload }) => {
        calls.push(`text:${payload.name || payload.note}:${openid}`);
        if (options.textError) throw options.textError;
      },
      assertImageSafe: async ({ fileID }) => {
        calls.push(`image:${fileID}`);
        if (options.imageError) throw options.imageError;
      },
    },
  };

  const entryPath = path.resolve(__dirname, `../cloudfunctions/${entity}/index.js`);
  delete require.cache[entryPath];
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'wx-server-sdk') return fakeCloud;
    if (request === './common/index.js' && parent && parent.filename === entryPath) return fakeCommon;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return { main: require(entryPath).main, calls };
  } finally {
    Module._load = originalLoad;
  }
}

for (const entity of ['person', 'event', 'item']) {
  test(`${entity} create inspects text before create`, async () => {
    const { main, calls } = loadEntity(entity);
    await main({ action: 'create', payload: { name: 'safe' } });
    assert.deepEqual(calls.slice(0, 2), ['text:safe:openid-1', `create:${entity}`]);
  });

  test(`${entity} update inspects text before update`, async () => {
    const { main, calls } = loadEntity(entity);
    await main({ action: 'update', id: 'id-1', payload: { note: 'safe' } });
    assert.deepEqual(calls.slice(-2), ['text:safe:openid-1', `update:${entity}`]);
  });

  test(`${entity} blocks writes when text inspection fails`, async () => {
    const { main, calls } = loadEntity(entity, { textError: new Error('blocked') });
    await assert.rejects(main({ action: 'create', payload: { name: 'unsafe' } }), /blocked/);
    assert.equal(calls.some((call) => call.startsWith('create:')), false);
  });
}
