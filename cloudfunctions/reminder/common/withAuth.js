// common/withAuth.js — 鉴权 + 错误包装
const cloud = require('wx-server-sdk');
const { ERROR_CODES, fail, ok } = require('./errors.js');

function withAuth(handler) {
  return async (event = {}, context = {}) => {
    try {
      const wxContext = cloud.getWXContext();
      const openid = wxContext.OPENID;
      if (!openid) {
        return fail(ERROR_CODES.UNAUTHORIZED, 'Missing OPENID in context');
      }
      const result = await handler(event, { openid, wxContext });
      if (result && typeof result === 'object' && 'code' in result) {
        return result;
      }
      return ok(result);
    } catch (err) {
      console.error('[withAuth] error:', err);
      const code = err && err.code ? err.code : ERROR_CODES.INTERNAL;
      return fail(code, err && err.message ? err.message : 'Internal error');
    }
  };
}

module.exports = { withAuth };
