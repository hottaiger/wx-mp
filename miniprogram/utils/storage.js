// utils/storage.js — 简易 TTL 缓存（基于 wx.setStorageSync）
function get(key) {
  try {
    const raw = wx.getStorageSync(`cache:${key}`);
    if (!raw) return null;
    const { value, expireAt } = raw;
    if (expireAt && Date.now() > expireAt) {
      wx.removeStorageSync(`cache:${key}`);
      return null;
    }
    return value;
  } catch (e) {
    return null;
  }
}

function set(key, value, ttlSeconds = 30) {
  try {
    wx.setStorageSync(`cache:${key}`, {
      value,
      expireAt: Date.now() + ttlSeconds * 1000,
    });
  } catch (e) {
    // 存储满则忽略
  }
}

function clear(key) {
  if (key) {
    wx.removeStorageSync(`cache:${key}`);
  } else {
    try {
      const info = wx.getStorageInfoSync();
      info.keys
        .filter((k) => k.startsWith('cache:list:'))
        .forEach((k) => wx.removeStorageSync(k));
    } catch (e) {}
  }
}

module.exports = { get, set, clear };
