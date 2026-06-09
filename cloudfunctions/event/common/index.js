// common/index.js — 统一导出
module.exports = {
  errors: require('./errors.js'),
  withAuth: require('./withAuth.js').withAuth,
  crud: require('./crud.js'),
};
