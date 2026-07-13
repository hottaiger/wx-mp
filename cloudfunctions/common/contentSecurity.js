const EXCLUDED_KEYS = new Set(['_id', '_openid', 'fileID', 'cloudPath', 'tempFilePath']);
const CONTENT_RISKY = 'ERR_CONTENT_RISKY';
const CONTENT_SECURITY_UNAVAILABLE = 'ERR_CONTENT_SECURITY_UNAVAILABLE';
const IMAGE_RISK_CODE = 87014;

function collectText(payload) {
  const values = new Set();

  function visit(value, key) {
    if (EXCLUDED_KEYS.has(key)) return;
    if (typeof value === 'string') {
      const text = value.trim();
      if (text) values.add(text);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry));
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    }
  }

  visit(payload);
  return [...values].join('\n');
}

function createContentSecurityError(kind) {
  const risky = kind === 'risky';
  return Object.assign(
    new Error(risky ? '所发布内容含违规信息' : '发布失败，请稍后重试'),
    { code: risky ? CONTENT_RISKY : CONTENT_SECURITY_UNAVAILABLE },
  );
}

function responseErrorCode(response) {
  if (!response || typeof response !== 'object') return null;
  const value = response.errCode === undefined ? response.errcode : response.errCode;
  if (value === undefined || value === null || value === '') return null;
  const code = Number(value);
  return Number.isFinite(code) ? code : null;
}

async function assertTextSafe({ cloud, openid, payload }) {
  const content = collectText(payload);
  if (!content) return;

  let response;
  try {
    response = await cloud.openapi.security.msgSecCheck({
      content,
      version: 2,
      scene: 1,
      openid,
    });
  } catch (error) {
    throw createContentSecurityError('unavailable');
  }

  const apiCode = responseErrorCode(response);
  if (apiCode !== null && apiCode !== 0) {
    throw createContentSecurityError('unavailable');
  }
  const suggest = response && response.result && response.result.suggest;
  if (suggest === 'pass') return;
  if (suggest === 'risky' || suggest === 'review') {
    throw createContentSecurityError('risky');
  }
  throw createContentSecurityError('unavailable');
}

function imageContentType(path = '') {
  const normalized = String(path).toLowerCase().split(/[?#]/)[0];
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.gif')) return 'image/gif';
  if (normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.jpg')) return 'image/jpeg';
  return null;
}

async function assertImageSafe({ cloud, fileID, cloudPath }) {
  const contentType = imageContentType(cloudPath || fileID);
  if (!contentType) throw createContentSecurityError('unavailable');

  try {
    const downloaded = await cloud.downloadFile({ fileID });
    if (!downloaded || !Buffer.isBuffer(downloaded.fileContent)) {
      throw createContentSecurityError('unavailable');
    }
    const response = await cloud.openapi.security.imgSecCheck({
      media: { contentType, value: downloaded.fileContent },
    });
    const apiCode = responseErrorCode(response);
    if (apiCode === IMAGE_RISK_CODE) {
      throw createContentSecurityError('risky');
    }
    if (apiCode !== 0) {
      throw createContentSecurityError('unavailable');
    }
  } catch (error) {
    if (error && (error.errCode === IMAGE_RISK_CODE || error.errcode === IMAGE_RISK_CODE)) {
      throw createContentSecurityError('risky');
    }
    if (error && (error.code === CONTENT_RISKY || error.code === CONTENT_SECURITY_UNAVAILABLE)) {
      throw error;
    }
    throw createContentSecurityError('unavailable');
  }
}

module.exports = {
  collectText,
  createContentSecurityError,
  assertTextSafe,
  assertImageSafe,
  imageContentType,
  responseErrorCode,
};
