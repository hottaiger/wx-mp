// pages/weekly-review/index.js
const cloud = require('../../utils/cloud.js');

function getWeekRange() {
  const d = new Date();
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diffToMon);
  mon.setHours(0, 0, 0, 0);
  const nextMon = new Date(mon);
  nextMon.setDate(mon.getDate() + 7);
  return { weekStart: mon.toISOString(), weekEnd: nextMon.toISOString(), mon };
}

function dayLabel(d) {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}/${d.getDate()} · ${labels[d.getDay()]}`;
}

Page({
  data: {
    loading: true,
    weekLabel: '',
    meetings: { count: 0, totalDurationMin: 0 },
    eventsByDay: [],
    totalEvents: 0,
    topPersons: [],
    topItems: [],
  },

  onLoad() { this.load(); },

  onPullDownRefresh() { this.load().then(() => wx.stopPullDownRefresh()); },

  async load() {
    this.setData({ loading: true });
    try {
      const range = getWeekRange();
      const end = new Date(range.weekEnd);
      this.setData({ weekLabel: `${range.mon.getMonth() + 1}.${range.mon.getDate()} - ${end.getMonth() + 1}.${end.getDate() - 1}` });

      const res = await cloud.call('weeklyStats', { weekStart: range.weekStart, weekEnd: range.weekEnd });

      // eventsByDay 转换 + 柱高
      const entries = Object.entries(res.eventsByDay || {});
      const maxCount = Math.max(1, ...entries.map(([, v]) => v));
      const eventsByDay = entries
        .map(([k, count]) => {
          const d = new Date(k);
          return { day: k, count, dayLabel: dayLabel(d), barHeight: Math.round((count / maxCount) * 200) };
        })
        .sort((a, b) => (a.day > b.day ? 1 : -1));

      const totalEvents = eventsByDay.reduce((s, x) => s + x.count, 0);

      this.setData({
        meetings: res.meetings || { count: 0, totalDurationMin: 0 },
        eventsByDay,
        totalEvents,
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
});
