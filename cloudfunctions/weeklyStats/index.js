// weeklyStats 云函数
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const { withAuth, errors } = require('./common/index.js');

function getWeekRange(weekStartIso, weekEndIso) {
  const ws = new Date(weekStartIso).getTime();
  const we = new Date(weekEndIso).getTime();
  if (Number.isNaN(ws) || Number.isNaN(we) || we <= ws) {
    throw Object.assign(new Error('invalid week range'), { code: errors.ERROR_CODES.VALIDATION });
  }
  return { ws, we };
}

function getDayKey(ts, offsetMs) {
  const d = new Date(ts + offsetMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

exports.main = withAuth(async (event, ctx) => {
  const { weekStart, weekEnd } = event;
  const { ws, we } = getWeekRange(weekStart, weekEnd);

  // 1) 拉本周 events
  const evRes = await db.collection('events').where({
    _openid: ctx.openid,
    startAt: _.gte(ws).and(_.lt(we)),
  }).limit(500).get();
  const events = evRes.data;

  // 2) 聚合 meetings
  const meetings = events.filter((e) => e.type === 'meeting');
  const meetingsAgg = {
    count: meetings.length,
    totalDurationMin: meetings.reduce((s, e) => s + (e.durationMin || 0), 0),
  };

  // 3) 按天分布（本地时区）
  const eventsByDay = {};
  const tzOffset = new Date().getTimezoneOffset() * 60 * 1000;
  for (const e of events) {
    const k = getDayKey(e.startAt, -tzOffset);
    eventsByDay[k] = (eventsByDay[k] || 0) + 1;
  }
  // 补 7 天
  for (let i = 0; i < 7; i++) {
    const k = getDayKey(ws + i * 86400000, -tzOffset);
    if (!(k in eventsByDay)) eventsByDay[k] = 0;
  }

  // 4) 取本周事件关联
  const eventIds = events.map((e) => e._id);
  let rels = [];
  if (eventIds.length) {
    const relRes = await db.collection('relations').where({
      _openid: ctx.openid,
      fromId: _.in(eventIds),
    }).limit(500).get();
    rels = relRes.data;
  }

  // 5) 计数 person/item，排序取 Top 5
  const personCount = {};
  const itemCount = {};
  for (const r of rels) {
    if (r.toType === 'person') personCount[r.toId] = (personCount[r.toId] || 0) + 1;
    if (r.toType === 'item') itemCount[r.toId] = (itemCount[r.toId] || 0) + 1;
  }
  const topPersonIds = Object.entries(personCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);
  const topItemIds = Object.entries(itemCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);

  // 6) batchGet
  async function batchGetEntities(coll, ids) {
    if (!ids.length) return [];
    const res = await db.collection(coll).where({ _openid: ctx.openid, _id: _.in(ids) }).get();
    const map = new Map(res.data.map((d) => [d._id, d]));
    return ids.map((id) => map.get(id) || { _id: id, missing: true });
  }
  const [topPersons, topItems] = await Promise.all([
    batchGetEntities('persons', topPersonIds),
    batchGetEntities('items', topItemIds),
  ]);

  return {
    meetings: meetingsAgg,
    eventsByDay,
    topPersons,
    topItems,
    weekStart, weekEnd,
  };
});
