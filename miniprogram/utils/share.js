// utils/share.js
function buildSharePayload(options) {
  var opts = options || {};
  var title = opts.title || '微录';
  var path = typeof opts.path === 'string' ? opts.path : '/pages/index/index';
  var imageUrl = opts.imageUrl;
  var query = opts.query || '';
  var payload = { title: title };
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
