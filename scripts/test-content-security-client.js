const test = require('node:test');
const assert = require('node:assert/strict');
const cloudUtils = require('../miniprogram/utils/cloud.js');

function loadItemImage(wxStub) {
  global.wx = wxStub;
  const modulePath = require.resolve('../miniprogram/utils/item-image.js');
  delete require.cache[modulePath];
  return require(modulePath);
}

test('content-security codes map to fixed safe copy', () => {
  assert.equal(cloudUtils.errorMessage('ERR_CONTENT_RISKY'), '所发布内容含违规信息');
  assert.equal(cloudUtils.errorMessage('ERR_CONTENT_SECURITY_UNAVAILABLE'), '发布失败，请稍后重试');
});

test('mapped risky copy overrides server details', async () => {
  global.wx = {
    cloud: {
      callFunction: async () => ({
        result: { code: 'ERR_CONTENT_RISKY', message: 'label=20001 risky detail' },
      }),
    },
  };
  await assert.rejects(
    cloudUtils.call('item', { action: 'create' }),
    (error) => error.message === '所发布内容含违规信息' && !error.message.includes('20001'),
  );
});

test('chooseOneImage requests compressed media and accepts supported image', async () => {
  let options;
  const itemImage = loadItemImage({
    chooseMedia(value) {
      options = value;
      value.success({ tempFiles: [{ tempFilePath: '/tmp/a.jpg', size: 1000 }] });
    },
    getImageInfo({ success }) {
      success({ width: 750, height: 1334 });
    },
  });
  const file = await itemImage.chooseOneImage();
  assert.deepEqual(options.sizeType, ['compressed']);
  assert.equal(file.tempFilePath, '/tmp/a.jpg');
});

test('chooseOneImage rejects files above 1 MB', async () => {
  const itemImage = loadItemImage({
    chooseMedia({ success }) {
      success({ tempFiles: [{ tempFilePath: '/tmp/a.jpg', size: 1024 * 1024 + 1 }] });
    },
    getImageInfo() {
      throw new Error('must not inspect oversized file');
    },
  });
  await assert.rejects(itemImage.chooseOneImage(), /图片过大/);
});

test('chooseOneImage rejects dimensions outside portrait and landscape limits', async () => {
  for (const dimensions of [{ width: 751, height: 1334 }, { width: 1335, height: 750 }]) {
    const itemImage = loadItemImage({
      chooseMedia({ success }) {
        success({ tempFiles: [{ tempFilePath: '/tmp/a.jpg', size: 1000 }] });
      },
      getImageInfo({ success }) {
        success(dimensions);
      },
    });
    await assert.rejects(itemImage.chooseOneImage(), /图片尺寸过大/);
  }
});
