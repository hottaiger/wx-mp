// relation 云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { withAuth, errors } = require('./common/index.js');

const VALID_TYPES = new Set(['person', 'event', 'item']);
const VALID_REL_TYPES = new Set([
  'event-involves-person',
  'event-involves-item',
  'person-owns-item',
  'person-knows-person',
  'item-pairs-with-item',
  'generic',
]);

function validateEntityType(t) {
  if (!VALID_TYPES.has(t)) {
    throw Object.assign(new Error('invalid entity type: ' + t), { code: errors.ERROR_CODES.VALIDATION });
  }
}

async function createRelation(event, ctx) {
  const { fromId, fromType, toId, toType, relType } = event.payload || {};
  if (!fromId || !toId || !relType) {
    throw Object.assign(new Error('fromId/toId/relType 必填'), { code: errors.ERROR_CODES.VALIDATION });
  }
  validateEntityType(fromType);
  validateEntityType(toType);
  if (!VALID_REL_TYPES.has(relType)) {
    throw Object.assign(new Error('invalid relType: ' + relType), { code: errors.ERROR_CODES.VALIDATION });
  }
  if (fromId === toId) {
    throw Object.assign(new Error('不能关联自身'), { code: errors.ERROR_CODES.VALIDATION });
  }
  // 去重
  const existing = await db.collection('relations').where({
    _openid: ctx.openid,
    fromId, toId, relType,
  }).limit(1).get();
  if (existing.data.length) {
    return { _id: existing.data[0]._id, deduplicated: true };
  }
  const now = Date.now();
  const doc = { fromId, fromType, toId, toType, relType, createdAt: now };
  const res = await db.collection('relations').add({ data: { ...doc, _openid: ctx.openid } });
  return { _id: res._id, ...doc };
}

async function listRelations(event, ctx) {
  const where = { _openid: ctx.openid };
  if (event.byFrom) {
    where.fromId = event.byFrom.id;
    if (event.byFrom.type) where.fromType = event.byFrom.type;
  }
  if (event.byTo) {
    where.toId = event.byTo.id;
    if (event.byTo.type) where.toType = event.byTo.type;
  }
  const res = await db.collection('relations').where(where).orderBy('createdAt', 'desc').limit(200).get();
  return res.data;
}

async function removeRelation(event, ctx) {
  if (!event.id) {
    throw Object.assign(new Error('id required'), { code: errors.ERROR_CODES.VALIDATION });
  }
  const res = await db.collection('relations').where({ _id: event.id, _openid: ctx.openid }).remove();
  if (!res.removed) {
    throw Object.assign(new Error('not found'), { code: errors.ERROR_CODES.NOT_FOUND });
  }
  return { removed: res.removed };
}

const HANDLERS = { create: createRelation, list: listRelations, remove: removeRelation };

exports.main = withAuth(async (event, ctx) => {
  const handler = HANDLERS[event.action];
  if (!handler) {
    throw Object.assign(new Error('unknown action: ' + event.action), { code: errors.ERROR_CODES.VALIDATION });
  }
  return handler(event, ctx);
});
