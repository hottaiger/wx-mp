// reminder 云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const { withAuth, errors } = require('../common/index.js');

const VALID_TARGETS = new Set(['event', 'person', 'item']);

async function createReminder(event, ctx) {
  const { targetType, targetId, triggerAt, message, subscribed } = event.payload || {};
  if (!targetId || !triggerAt) {
    throw Object.assign(new Error('targetId/triggerAt 必填'), { code: errors.ERROR_CODES.VALIDATION });
  }
  if (!VALID_TARGETS.has(targetType)) {
    throw Object.assign(new Error('invalid targetType: ' + targetType), { code: errors.ERROR_CODES.VALIDATION });
  }
  const now = Date.now();
  const doc = {
    targetType, targetId, triggerAt, message: message || '',
    subscribed: !!subscribed,
    status: 'pending',
    createdAt: now,
  };
  const res = await db.collection('reminders').add({ data: { ...doc, _openid: ctx.openid } });
  return { _id: res._id, ...doc };
}

async function cancelReminder(event, ctx) {
  if (!event.id) {
    throw Object.assign(new Error('id required'), { code: errors.ERROR_CODES.VALIDATION });
  }
  const found = await db.collection('reminders').where({ _id: event.id, _openid: ctx.openid }).limit(1).get();
  if (!found.data.length) {
    throw Object.assign(new Error('not found'), { code: errors.ERROR_CODES.NOT_FOUND });
  }
  if (found.data[0].status === 'sent') {
    throw Object.assign(new Error('已发送不可取消'), { code: errors.ERROR_CODES.VALIDATION });
  }
  await db.collection('reminders').where({ _id: event.id, _openid: ctx.openid }).remove();
  return { removed: 1 };
}

async function listReminders(event, ctx) {
  const where = { _openid: ctx.openid };
  if (event.status) where.status = event.status;
  const res = await db.collection('reminders').where(where).orderBy('triggerAt', 'asc').limit(100).get();
  return res.data;
}

const HANDLERS = { create: createReminder, cancel: cancelReminder, list: listReminders };

exports.main = withAuth(async (event, ctx) => {
  const handler = HANDLERS[event.action];
  if (!handler) {
    throw Object.assign(new Error('unknown action: ' + event.action), { code: errors.ERROR_CODES.VALIDATION });
  }
  return handler(event, ctx);
});
