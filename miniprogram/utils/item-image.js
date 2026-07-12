// utils/item-image.js
const MAX_SECURITY_IMAGE_BYTES = 1024 * 1024;
const MAX_SECURITY_IMAGE_WIDTH = 750;
const MAX_SECURITY_IMAGE_HEIGHT = 1334;

function imageDimensionsSupported(width, height) {
  return (
    (width <= MAX_SECURITY_IMAGE_WIDTH && height <= MAX_SECURITY_IMAGE_HEIGHT)
    || (width <= MAX_SECURITY_IMAGE_HEIGHT && height <= MAX_SECURITY_IMAGE_WIDTH)
  );
}

function getImageInfo(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({ src, success: resolve, fail: reject });
  });
}
function buildCloudPath(filePath = '') {
  const ext = (filePath.match(/\.[^.]+$/) || ['.jpg'])[0];
  const random = Math.random().toString(36).slice(2, 8);
  return `items/${Date.now()}-${random}${ext}`;
}

function chooseOneImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file || !file.tempFilePath) {
          reject(new Error('未选择图片'));
          return;
        }
        if (Number(file.size) > MAX_SECURITY_IMAGE_BYTES) {
          reject(new Error('图片过大，请压缩后重试'));
          return;
        }
        try {
          const info = await getImageInfo(file.tempFilePath);
          if (!imageDimensionsSupported(Number(info.width), Number(info.height))) {
            reject(new Error('图片尺寸过大，请压缩后重试'));
            return;
          }
          resolve(file);
        } catch (error) {
          reject(error);
        }
      },
      fail: reject,
    });
  });
}

function uploadImage(file) {
  const cloudPath = buildCloudPath(file.tempFilePath || '');
  return wx.cloud.uploadFile({
    cloudPath,
    filePath: file.tempFilePath,
  }).then((res) => ({
    fileID: res.fileID,
    cloudPath,
    tempFilePath: file.tempFilePath,
  }));
}

module.exports = {
  chooseOneImage,
  uploadImage,
  buildCloudPath,
  MAX_SECURITY_IMAGE_BYTES,
  MAX_SECURITY_IMAGE_WIDTH,
  MAX_SECURITY_IMAGE_HEIGHT,
  imageDimensionsSupported,
};
