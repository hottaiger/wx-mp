// reminderDispatcher — 定时触发器，每分钟扫表发送订阅消息
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const TEMPLATE_ID = process.env.SUBSCRIBE_TEMPLATE_ID || ''; // 在云函数配置里设环境变量

exports.main = async () => {
  const now = Date.now();
  const dueList = await db.collection('reminders').where({
    status: 'pending',
    triggerAt: _.lte(now),
  }).limit(50).get();

  const results = { sent: 0, in_app: 0, failed: 0 };

  for (const r of dueList.data) {
    try {
      if (r.subscribed && TEMPLATE_ID) {
        await cloud.openapi.subscribeMessage.send({
          touser: r._openid,
          templateId: TEMPLATE_ID,
          data: {
            // 模板字段名需在 MP 平台申请时确定，这里给最常见的 thing1/thing2/time
            thing1: { value: (r.message || '提醒').slice(0, 20) },
            time2: { value: new Date(r.triggerAt).toLocaleString('zh-CN') },
          },
        });
        await db.collection('reminders').doc(r._id).update({ data: { status: 'sent', sentAt: Date.now() } });
        results.sent++;
      } else {
        // 降级：未订阅 或 模板缺失 → in_app
        const reason = !TEMPLATE_ID ? 'template_missing' : 'unsub';
        console.log('[reminderDispatcher] in_app', { id: r._id, reason });
        await db.collection('reminders').doc(r._id).update({ data: { status: 'in_app' } });
        results.in_app++;
      }
    } catch (err) {
      console.error('[reminderDispatcher] failed', r._id, err);
      await db.collection('reminders').doc(r._id).update({ data: { status: 'failed_unsub' } });
      results.failed++;
    }
  }
  return results;
};
