// person 云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { withAuth, crud, errors } = require('./common/index.js');

const _ = db.command;
const COLLECTION = 'persons';
const ENTITY_COLLECTION = { person: 'persons', event: 'events', item: 'items' };
const EVENT_TYPE_LABEL = { meeting: '会议', todo: '待办', reminder: '提醒', generic: '其他' };

function entityTitle(entity = {}) {
  return entity.name || entity.title || '未命名记录';
}

function entitySubtitle(type, entity = {}) {
  if (type === 'person') {
    return Array.isArray(entity.traits) && entity.traits.length ? entity.traits.slice(0, 2).join(' · ') : '';
  }
  if (type === 'item') {
    if (Array.isArray(entity.tags) && entity.tags.length) return entity.tags.slice(0, 2).join(' · ');
    if (entity.boughtAt) return `购于 ${new Date(entity.boughtAt).toISOString().slice(0, 10)}`;
    return '';
  }
  if (type === 'event') {
    const parts = [];
    if (entity.type) parts.push(EVENT_TYPE_LABEL[entity.type] || entity.type);
    if (entity.startAt) parts.push(new Date(entity.startAt).toISOString().slice(5, 16).replace('T', ' '));
    return parts.join(' · ');
  }
  return '';
}

async function enrichRelations(relations, currentId, openid) {
  if (!relations.length) return [];
  const idsByType = { person: [], event: [], item: [] };
  const normalized = relations.map((relation) => {
    const isFrom = relation.fromId === currentId;
    const counterpartyId = isFrom ? relation.toId : relation.fromId;
    const counterpartyType = isFrom ? relation.toType : relation.fromType;
    if (idsByType[counterpartyType] && !idsByType[counterpartyType].includes(counterpartyId)) {
      idsByType[counterpartyType].push(counterpartyId);
    }
    return { ...relation, counterpartyId, counterpartyType };
  });

  const entityMap = { person: new Map(), event: new Map(), item: new Map() };
  for (const type of Object.keys(idsByType)) {
    const ids = idsByType[type];
    if (!ids.length) continue;
    const res = await db.collection(ENTITY_COLLECTION[type]).where({ _openid: openid, _id: _.in(ids) }).get();
    res.data.forEach((entity) => entityMap[type].set(entity._id, entity));
  }

  return normalized.map((relation) => {
    const entity = entityMap[relation.counterpartyType].get(relation.counterpartyId) || {};
    return {
      ...relation,
      counterparty: {
        id: relation.counterpartyId,
        type: relation.counterpartyType,
        title: entityTitle(entity),
        subtitle: entitySubtitle(relation.counterpartyType, entity),
      },
    };
  });
}

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
  const relations = await enrichRelations([...relFrom.data, ...relTo.data], event.id, ctx.openid);
  return { entity, relationsFrom: relFrom.data, relationsTo: relTo.data, relations };
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
  await db.collection('relations').where(_.and([
    { _openid: ctx.openid },
    _.or([{ fromId: event.id }, { toId: event.id }]),
  ])).remove();
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
