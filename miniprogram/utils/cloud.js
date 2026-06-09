// utils/cloud.js — wx.cloud.callFunction 统一封装
const ERROR_MAP = {
  ERR_UNAUTHORIZED: '未登录或登录已过期',
  ERR_NOT_FOUND: '记录不存在',
  ERR_VALIDATION: '参数校验失败',
  ERR_INTERNAL: '服务异常，请稍后重试',
};

function call(name, data) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({ name, data })
      .then((res) => {
        const result = res && res.result;
        if (!result) {
          reject(new Error('Empty response'));
          return;
        }
        if (result.code && result.code !== 'OK') {
          const message = result.message || ERROR_MAP[result.code] || '请求失败';
          reject(Object.assign(new Error(message), { code: result.code, raw: result }));
          return;
        }
        resolve(result.data === undefined ? result : result.data);
      })
      .catch((err) => {
        if (err && err.code && ERROR_MAP[err.code]) {
          reject(err);
          return;
        }
        if (err && err.errMsg) {
          if (err.errMsg.includes('FunctionName parameter could not be found')) {
            reject(new Error('云函数未部署，请先在 cloudfunctions/ 目录上传'));
            return;
          }
          if (err.errMsg.includes('Environment not found')) {
            reject(new Error('云开发环境未找到，请在 config.js 配置 env'));
            return;
          }
        }
        reject(err || new Error('网络异常'));
      });
  });
}

module.exports = { call };
