// utils/share.js
function buildSharePayload(options = {}) {
  const {
    title = '微录',
    path = '/pages/index/index',
    imageUrl,
    query = '',
  } = options;

  const payload = { title };
  if (path) payload.path = path;
  if (imageUrl) payload.imageUrl = imageUrl;
  if (query) payload.query = query;
  return payload;
}

function ensureShareMenu() {
  if (!wx.showShareMenu) return;
  wx.showShareMenu({
    menus: ['shareAppMessage', 'shareTimeline'],
  });
}

module.exports = {
  buildSharePayload,
  ensureShareMenu,
};
