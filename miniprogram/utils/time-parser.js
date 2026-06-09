// utils/time-parser.js — 相对时间解析
function pad(n) { return String(n).padStart(2, '0'); }

function parseRelativeTime(input, now = Date.now()) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  // 「N 分钟后」「N 分钟后」「N min 后」
  let m = s.match(/^(\d+)\s*(分钟|分|min|m)\s*(后|之后)?$/i);
  if (m) {
    const minutes = Number(m[1]);
    if (minutes <= 0 || minutes > 60 * 24 * 30) return null;
    return now + minutes * 60 * 1000;
  }
  // 「N 小时后」
  m = s.match(/^(\d+)\s*(小时|hour|h)\s*(后|之后)?$/i);
  if (m) {
    const hours = Number(m[1]);
    if (hours <= 0 || hours > 24 * 30) return null;
    return now + hours * 3600 * 1000;
  }
  // 「明天 HH:mm」/ 「明早 9 点」/ 「明晚 9 点」
  m = s.match(/^明(天|早|晚)\s*(\d{1,2})\s*[:点]\s*(\d{1,2})?$/);
  if (m) {
    const when = m[1];
    const hour = Number(m[2]);
    const minute = m[3] ? Number(m[3]) : 0;
    const finalHour = when === '晚' && hour < 12 ? hour + 12 : hour;
    if (finalHour > 23 || minute > 59) return null;
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(finalHour, minute, 0, 0);
    return d.getTime();
  }
  // 「下周一」默认 09:00
  if (/^下?周[一二三四五六日天]$/.test(s)) {
    const target = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }[s.match(/[一二三四五六日天]/)[0]];
    const d = new Date(now);
    const cur = d.getDay();
    let diff = (target - cur + 7) % 7;
    if (diff === 0) diff = 7; // 「下周一」永远下周
    d.setDate(d.getDate() + diff);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  // 「YYYY-MM-DD HH:mm」/ 「MM-DD HH:mm」
  m = s.match(/^(\d{4}-)?(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})$/);
  if (m) {
    const y = m[1] ? Number(m[1].slice(0, -1)) : new Date(now).getFullYear();
    const mo = Number(m[2]); const d = Number(m[3]);
    const h = Number(m[4]); const mi = Number(m[5]);
    const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
    if (dt.getTime() < now) return null;
    return dt.getTime();
  }
  return null;
}

module.exports = { parseRelativeTime };
