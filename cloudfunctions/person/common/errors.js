// common/errors.js — 统一错误码
const ERROR_CODES = {
  UNAUTHORIZED: 'ERR_UNAUTHORIZED',
  NOT_FOUND: 'ERR_NOT_FOUND',
  VALIDATION: 'ERR_VALIDATION',
  CONTENT_RISKY: 'ERR_CONTENT_RISKY',
  CONTENT_SECURITY_UNAVAILABLE: 'ERR_CONTENT_SECURITY_UNAVAILABLE',
  INTERNAL: 'ERR_INTERNAL',
};

const ERROR_HTTP = {
  ERR_UNAUTHORIZED: 401,
  ERR_NOT_FOUND: 404,
  ERR_VALIDATION: 400,
  ERR_CONTENT_RISKY: 400,
  ERR_CONTENT_SECURITY_UNAVAILABLE: 503,
  ERR_INTERNAL: 500,
};

function ok(data) {
  return { code: 'OK', data };
}

function fail(code, message, data) {
  return { code, message, data };
}

function httpStatus(code) {
  return ERROR_HTTP[code] || 200;
}

module.exports = { ERROR_CODES, ok, fail, httpStatus };
