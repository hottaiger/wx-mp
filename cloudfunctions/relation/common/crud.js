// common/crud.js — CRUD 基类，强制 _openid 过滤
const cloud = require('wx-server-sdk');
const db = cloud.database();
const _ = db.command;
const { ERROR_CODES, fail } = require('./errors.js');

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function normalizeWhere(where = {}, openid) {
  const merged = { _openid: openid, ...where };
  // 禁止 _openid 覆盖
  merged._openid = openid;
  return merged;
}

async function create(collection, data, openid) {
  if (!data || typeof data !== 'object') {
    throw Object.assign(new Error('payload must be object'), { code: ERROR_CODES.VALIDATION });
  }
  const now = Date.now();
  const doc = {
    ...data,
    _openid: openid,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };
  const res = await db.collection(collection).add({ data: doc });
  return { _id: res._id, ...doc };
}

async function update(collection, id, data, openid) {
  if (!id) {
    throw Object.assign(new Error('id required'), { code: ERROR_CODES.VALIDATION });
  }
  const patch = { ...data, updatedAt: Date.now() };
  delete patch._openid;
  delete patch._id;
  delete patch.createdAt;
  await db.collection(collection).where({ _id: id, _openid: openid }).update({ data: patch });
  return { _id: id, ...patch };
}

async function list(collection, opts, openid) {
  const {
    where = {},
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    orderBy = 'updatedAt',
    order = 'desc',
    field,
  } = opts || {};
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const safePage = Math.max(1, page);
  const mergedWhere = normalizeWhere(where, openid);
  const query = db.collection(collection).where(mergedWhere);
  const countRes = await query.count();
  const skip = (safePage - 1) * safePageSize;
  let getQuery = query.skip(skip).limit(safePageSize);
  if (field && typeof field === 'object') {
    getQuery = getQuery.field(field);
  }
  getQuery = getQuery.orderBy(orderBy, order);
  const listRes = await getQuery.get();
  return { total: countRes.total, list: listRes.data };
}

async function remove(collection, id, openid) {
  if (!id) {
    throw Object.assign(new Error('id required'), { code: ERROR_CODES.VALIDATION });
  }
  const res = await db.collection(collection).where({ _id: id, _openid: openid }).remove();
  return { removed: res.removed || 0 };
}

async function getOne(collection, id, openid) {
  if (!id) {
    throw Object.assign(new Error('id required'), { code: ERROR_CODES.NOT_FOUND });
  }
  const res = await db.collection(collection).where({ _id: id, _openid: openid }).limit(1).get();
  if (!res.data.length) {
    throw Object.assign(new Error('not found'), { code: ERROR_CODES.NOT_FOUND });
  }
  return res.data[0];
}

module.exports = { create, update, list, remove, getOne, MAX_PAGE_SIZE };
