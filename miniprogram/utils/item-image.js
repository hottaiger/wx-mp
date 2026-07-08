// utils/item-image.js
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
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file || !file.tempFilePath) {
          reject(new Error('未选择图片'));
          return;
        }
        resolve(file);
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
};
