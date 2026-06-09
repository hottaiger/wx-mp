// pages/index/index.js — 三 Tab + 悬浮 FAB
const cloud = require('../../utils/cloud.js');
const storage = require('../../utils/storage.js');

const TABS = [
  { key: 'event', label: '事' },
  { key: 'person', label: '人' },
  { key: 'item', label: '物' },
];

const COLLECTION_BY_TAB = {
  event: 'event',
  person: 'person',
  item: 'item',
};

const FN_BY_TAB = {
  event: 'event',
  person: 'person',
  item: 'item',
};

Page({
  data: {
    tabs: TABS,
    activeTab: 'event',
    list: [],
    keyword: '',
    loading: false,
  },

  onLoad() {
    this.loadList();
  },

  onShow() {
    // 切回首页时若有新录入，刷新一次
    if (this._needRefresh) {
      this._needRefresh = false;
      this.loadList();
    }
  },

  onPullDownRefresh() {
    this.loadList().then(() => wx.stopPullDownRefresh());
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key, keyword: '', list: [] });
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

  loadList() {
    const tab = this.data.activeTab;
    const cacheKey = `list:${tab}:${this.data.keyword}`;
    const cached = storage.get(cacheKey);
    if (cached) {
      this.setData({ list: cached });
    }
    this.setData({ loading: true });
    return cloud
      .call(FN_BY_TAB[tab], { action: 'list', keyword: this.data.keyword })
      .then((rows) => {
        this.setData({ list: rows });
        storage.set(cacheKey, rows);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .then(() => this.setData({ loading: false }));
  },
});
