const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectText,
  assertTextSafe,
  assertImageSafe,
} = require('../cloudfunctions/common/contentSecurity.js');

test('collectText normalizes nested authored strings and excludes metadata', () => {
  const text = collectText({
    _id: 'record-id',
    name: '  Alice  ',
    traits: ['friend', 'friend', ''],
    attrs: { location: ' Beijing ', fileID: 'cloud://secret' },
    coverImage: { cloudPath: 'items/a.jpg', tempFilePath: '/tmp/a.jpg' },
    count: 3,
  });
  assert.equal(text, 'Alice\nfriend\nBeijing');
});

test('assertTextSafe sends v2 scene 1 and openid', async () => {
  let input;
  const cloud = { openapi: { security: { msgSecCheck: async (value) => {
    input = value;
    return { result: { suggest: 'pass' } };
  } } } };
  await assertTextSafe({ cloud, openid: 'openid-1', payload: { name: 'Alice' } });
  assert.deepEqual(input, { content: 'Alice', version: 2, scene: 1, openid: 'openid-1' });
});

for (const suggest of ['risky', 'review']) {
  test(`assertTextSafe classifies ${suggest} without upstream details`, async () => {
    const cloud = { openapi: { security: { msgSecCheck: async () => ({ result: { suggest, label: 20001 } }) } } };
    await assert.rejects(
      assertTextSafe({ cloud, openid: 'o', payload: { name: 'x' } }),
      (error) => error.code === 'ERR_CONTENT_RISKY' && !error.message.includes('20001'),
    );
  });
}

test('assertTextSafe skips empty authored text', async () => {
  let called = false;
  const cloud = { openapi: { security: { msgSecCheck: async () => { called = true; } } } };
  await assertTextSafe({ cloud, openid: 'o', payload: { count: 1, note: ' ' } });
  assert.equal(called, false);
});

test('assertTextSafe fails closed for malformed and thrown calls', async () => {
  for (const msgSecCheck of [async () => ({}), async () => { throw new Error('trace secret'); }]) {
    const cloud = { openapi: { security: { msgSecCheck } } };
    await assert.rejects(
      assertTextSafe({ cloud, openid: 'o', payload: { name: 'x' } }),
      (error) => error.code === 'ERR_CONTENT_SECURITY_UNAVAILABLE' && !error.message.includes('secret'),
    );
  }
});

test('assertImageSafe downloads and checks the documented media object', async () => {
  const buffer = Buffer.from('image');
  let checked;
  const cloud = {
    downloadFile: async ({ fileID }) => {
      assert.equal(fileID, 'cloud://image');
      return { fileContent: buffer };
    },
    openapi: { security: { imgSecCheck: async ({ media }) => {
      checked = media;
      return { errCode: 0 };
    } } },
  };
  await assertImageSafe({ cloud, fileID: 'cloud://image', cloudPath: 'items/image.png' });
  assert.deepEqual(checked, { contentType: 'image/png', value: buffer });
});

test('assertImageSafe classifies documented risk code', async () => {
  const cloud = {
    downloadFile: async () => ({ fileContent: Buffer.from('image') }),
    openapi: { security: { imgSecCheck: async () => {
      throw Object.assign(new Error('risky content'), { errCode: 87014 });
    } } },
  };
  await assert.rejects(
    assertImageSafe({ cloud, fileID: 'cloud://image', cloudPath: 'items/image.jpg' }),
    (error) => error.code === 'ERR_CONTENT_RISKY' && !error.message.includes('risky content'),
  );
});

test('assertImageSafe fails closed for download and API failures', async () => {
  const cases = [
    { downloadFile: async () => { throw new Error('download secret'); } },
    {
      downloadFile: async () => ({ fileContent: Buffer.from('image') }),
      openapi: { security: { imgSecCheck: async () => { throw new Error('api secret'); } } },
    },
  ];
  for (const cloud of cases) {
    await assert.rejects(
      assertImageSafe({ cloud, fileID: 'cloud://image', cloudPath: 'items/image.jpg' }),
      (error) => error.code === 'ERR_CONTENT_SECURITY_UNAVAILABLE' && !error.message.includes('secret'),
    );
  }
});
