// pages/weekly-review/index.js
const cloud = require('../../utils/cloud.js');

function getWeekRange() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diffToMon = (day + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diffToMon);
  mon.setHours(0, 0, 0, 0);
  const nextMon = new Date(mon);
  nextMon.setDate(mon.getDate() + 7);
  return { weekStart: mon.toISOString(), weekEnd: nextMon.toISOString() };
}

function formatDate(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

Page({
  data: {
    loading: true,
    weekLabel: '',
    meetings: { count: 0, totalDurationMin: 0 },
    eventsByDay: [],
    topPersons: [],
    topItems: [],
  },

  onLoad() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ loading: true });
    try {
      const range = getWeekRange();
      const start = new Date(range.weekStart);
      const end = new Date(range.weekEnd);
      this.setData({ weekLabel: `${formatDate(start)} ~ ${formatDate(new Date(end.getTime() - 86400000))}` });

      const res = await cloud.call('weeklyStats', { weekStart: range.weekStart, weekEnd: range.weekEnd });
      // eventsByDay 转数组
      const eventsByDay = Object.keys(res.eventsByDay || {}).map((k) => ({ day: k, count: res.eventsByDay[k] }));
      eventsByDay.sort();
      this.setData({
        meetings: res.meetings || { count: 0, totalDurationMin: 0 },
        eventsByDay,
        topPersons: res.topPersons || [],
        topItems: res.topItems || [],
      });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onEntityTap(e) {
    const { id, type } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/detail/index?type=${type}&id=${id}` });
  },

  hoursAndMinutes() {
    const min = this.data.meetings.totalDurationMin || 0;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}小时${m}分`;
  },
});
