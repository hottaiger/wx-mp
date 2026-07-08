// pages/relation/index.js
const cloud = require('../../utils/cloud.js');
const relationRules = require('../../utils/relation-rules.js');

const TYPES = [
  { value: 'event', label: '事' },
  { value: 'person', label: '人' },
  { value: 'item', label: '物' },
];

const REL_LABEL = {
  'event-involves-person': '涉及', 'event-involves-item': '涉及',
  'person-owns-item': '拥有', 'person-knows-person': '认识',
  'item-pairs-with-item': '搭配', 'generic': '关联',
};

const FN_BY_TYPE = { event: 'event', person: 'person', item: 'item' };
const TYPE_LABEL = { event: '事', person: '人', item: '物' };

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    types: TYPES,
    relCandidates: relationRules.decorateRelationCandidates('', 'event'),
    visibleRelCandidates: [],
    relLabel: REL_LABEL,
    fromId: '',
    fromType: '',
    fromSnippet: '',
    fromTypeLabel: '',
    toType: 'event',
    toTypeLabel: '事',
    toList: [],
    relType: '',
    selectedToId: '',
    selectedToEntity: null,
    step: 1,
    loading: false,
  },

  onLoad(opts) {
    this.setData({
      fromId: opts.fromId,
      fromType: opts.fromType,
      fromTypeLabel: TYPE_LABEL[opts.fromType] || '',
      relCandidates: relationRules.decorateRelationCandidates(opts.fromType, this.data.toType),
    });
    this.refreshVisibleRelCandidates();
    this.fetchFromSnippet();
    this.fetchToList();
  },

  onBack() { wx.navigateBack(); },

  async fetchFromSnippet() {
    try {
      const e = await cloud.call(this.data.fromType, { action: 'getDetail', id: this.data.fromId });
      const en = e.entity || {};
      this.setData({ fromSnippet: en.name || en.title || ('#' + this.data.fromId) });
    } catch (err) {
      this.setData({ fromSnippet: '#' + this.data.fromId });
    }
  },

  onToTypeSelect(e) {
    const v = e.currentTarget.dataset.value;
    this.setData({
      toType: v, toTypeLabel: TYPE_LABEL[v],
      relType: '', selectedToId: '', selectedToEntity: null, step: 1,
      relCandidates: relationRules.decorateRelationCandidates(this.data.fromType, v),
    });
    this.refreshVisibleRelCandidates();
    this.fetchToList();
  },

  refreshVisibleRelCandidates() {
    this.setData({
      visibleRelCandidates: this.data.relCandidates.filter((item) => !item.disabled),
    });
  },

  onRelTypeSelect(e) {
    const value = e.currentTarget.dataset.value;
    const candidate = this.data.relCandidates.find((item) => item.value === value);
    if (candidate && candidate.disabled) return;
    this.setData({ relType: value, step: 3 });
  },

  onEntitySelect(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.toList[idx];
    this.setData({ selectedToId: item._id, selectedToEntity: item });
  },

  markPreviousPageForRefresh() {
    const pages = getCurrentPages();
    const prev = pages[pages.length - 2];
    if (prev) prev._needRefresh = true;
  },

  fetchToList() {
    this.setData({ loading: true });
    return cloud.call(FN_BY_TYPE[this.data.toType], { action: 'list', pageSize: 100 })
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res && res.list) || [];
        // 排除自身
        const filtered = rows.filter((r) => !(r._id === this.data.fromId && this.data.toType === this.data.fromType));
        // 装饰时间
        const decorated = filtered.map((it) => {
          const out = Object.assign({}, it);
          if (this.data.toType === 'event' && it.startAt) out.startAtText = formatTime(it.startAt);
          if (this.data.toType === 'item' && it.boughtAt) out.boughtAtText = (new Date(it.boughtAt).toISOString().slice(0, 10));
          return out;
        });
        this.setData({ toList: decorated, step: 2 });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .then(() => this.setData({ loading: false }));
  },

  async onSubmit() {
    if (!this.data.selectedToId || !this.data.relType) {
      wx.showToast({ title: '请选择对端和关联类型', icon: 'none' });
      return;
    }
    try {
      await cloud.call('relation', {
        action: 'create',
        payload: {
          ...relationRules.normalizeRelationPayload({
            fromId: this.data.fromId, fromType: this.data.fromType,
            toId: this.data.selectedToId, toType: this.data.toType,
            relType: this.data.relType,
          }),
        },
      });
      wx.showToast({ title: '已关联', icon: 'success' });
      this.markPreviousPageForRefresh();
      setTimeout(() => wx.navigateBack(), 600);
    } catch (err) {
      wx.showToast({ title: err.message || '关联失败', icon: 'none' });
    }
  },
});
