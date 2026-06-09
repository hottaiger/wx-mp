// event 云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { withAuth, crud, errors } = require('../common/index.js');

const _ = db.command;
const COLLECTION = 'events';

async function listEntities(event, ctx) {
  const where = {};
  if (event.keyword && typeof event.keyword === 'string') {
    const k = event.keyword.trim();
    if (k) {
      // 三实体都有 name 字段，统一模糊
      where.name = db.RegExp({ regexp: k, options: 'i' });
    }
  }
  return crud.list(COLLECTION, { where, ...event }, ctx.openid);
}

async function getDetail(event, ctx) {
  const entity = await crud.getOne(COLLECTION, event.id, ctx.openid);
  // 双向关联
  const relFrom = await db.collection('relations').where({ _openid: ctx.openid, fromId: event.id }).get();
  const relTo = await db.collection('relations').where({ _openid: ctx.openid, toId: event.id }).get();
  return { entity, relationsFrom: relFrom.data, relationsTo: relTo.data };
}

async function createEntity(event, ctx) {
  const payload = event.payload || {};
  if (!payload.name && !payload.title) {
    throw Object.assign(new Error('name/title 必填'), { code: errors.ERROR_CODES.VALIDATION });
  }
  return crud.create(COLLECTION, payload, ctx.openid);
}

async function updateEntity(event, ctx) {
  if (!event.id) {
    throw Object.assign(new Error('id required'), { code: errors.ERROR_CODES.VALIDATION });
  }
  return crud.update(COLLECTION, event.id, event.payload || {}, ctx.openid);
}

async function removeEntity(event, ctx) {
  if (!event.id) {
    throw Object.assign(new Error('id required'), { code: errors.ERROR_CODES.VALIDATION });
  }
  const result = await crud.remove(COLLECTION, event.id, ctx.openid);
  // 级联删除 relations
  await db.collection('relations').where({ _openid: ctx.openid }).and(_.or([{ fromId: event.id }, { toId: event.id }])).remove();
  // 事件/物品 还要清 reminders（事件专属）
  if (COLLECTION === 'events') {
    await db.collection('reminders').where({ _openid: ctx.openid, targetType: 'event', targetId: event.id }).remove();
  }
  return result;
}

const HANDLERS = {
  whoami: async (event, ctx) => ({ openid: ctx.openid }),
  list: listEntities,
  getDetail,
  create: createEntity,
  update: updateEntity,
  remove: removeEntity,
};

exports.main = withAuth(async (event, ctx) => {
  const action = event.action;
  const handler = HANDLERS[action];
  if (!handler) {
    throw Object.assign(new Error('unknown action: ' + action), { code: errors.ERROR_CODES.VALIDATION });
  }
  return handler(event, ctx);
});
