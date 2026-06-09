// pages/index/index.js
const cloud = require('../../utils/cloud.js');
const storage = require('../../utils/storage.js');

const TABS = [
  { key: 'event', label: '事' },
  { key: 'person', label: '人' },
  { key: 'item', label: '物' },
];

const TYPE_LABEL = {
  meeting: '会议',
  todo: '待办',
  reminder: '提醒',
  generic: '其他',
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = (n) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) return `今天 ${hm}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return sameYear ? `${md} ${hm}` : `${d.getFullYear()}/${md} ${hm}`;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function decorate(list, type) {
  if (!Array.isArray(list)) return [];
  return list.map((it) => {
    const out = { ...it };
    if (type === 'event' && it.startAt) out.startAtText = formatTime(it.startAt);
    if (type === 'item' && it.boughtAt) out.boughtAtText = formatDate(it.boughtAt);
    return out;
  });
}

Page({
  data: {
    tabs: TABS,
    tabIndex: 0,
    activeTab: 'event',
    typeLabel: TYPE_LABEL,
    list: [],
    counts: { event: 0, person: 0, item: 0 },
    keyword: '',
    loading: false,
    heroTitle: '今天，\n记录一笔。',
    heroSub: '人 · 事 · 物，三者互联',
  },

  onLoad() {
    this.refreshAllCounts();
    this.loadList();
  },

  onShow() {
    if (this._needRefresh) {
      this._needRefresh = false;
      this.refreshAllCounts();
      this.loadList();
    }
  },

  onPullDownRefresh() {
    this.loadList().then(() => {
      this.refreshAllCounts();
      wx.stopPullDownRefresh();
    });
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    const tabIndex = TABS.findIndex((t) => t.key === key);
    this.setData({ activeTab: key, tabIndex, keyword: '', list: [] });
    this.loadList();
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadList(), 300);
  },

  onFabTap() {
    wx.navigateTo({ url: `/pages/capture/index?type=${this.data.activeTab}` });
  },

  onItemTap(e) {
    const { id, type } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/detail/index?type=${type}&id=${id}` });
  },

  gotoWeekly() {
    wx.navigateTo({ url: '/pages/weekly-review/index' });
  },

  refreshAllCounts() {
    TABS.forEach((t) => {
      cloud
        .call(t.key, { action: 'list', pageSize: 1 })
        .then((res) => {
          const total = (res && (res.total != null ? res.total : (Array.isArray(res) ? res.length : 0))) || 0;
          this.setData({ [`counts.${t.key}`]: total });
        })
        .catch(() => {});
    });
  },

  loadList() {
    const tab = this.data.activeTab;
    const cacheKey = `list:${tab}:${this.data.keyword}`;
    const cached = storage.get(cacheKey);
    if (cached) this.setData({ list: cached });
    this.setData({ loading: true });
    return cloud
      .call(tab, { action: 'list', keyword: this.data.keyword, pageSize: 50 })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res && res.list) || [];
        const decorated = decorate(rows, tab);
        this.setData({ list: decorated });
        storage.set(cacheKey, decorated);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .then(() => this.setData({ loading: false }));
  },
});
