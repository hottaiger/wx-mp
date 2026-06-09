// pages/relation/index.js
const cloud = require('../../utils/cloud.js');

const TYPES = [
  { value: 'event', label: '事' },
  { value: 'person', label: '人' },
  { value: 'item', label: '物' },
];

// relType 候选 + 适用 (fromType, toType) 组合
const REL_CANDIDATES = [
  { value: 'event-involves-person', label: '事件涉及人', from: 'event', to: 'person' },
  { value: 'event-involves-item', label: '事件涉及物', from: 'event', to: 'item' },
  { value: 'person-owns-item', label: '人拥有物', from: 'person', to: 'item' },
  { value: 'person-knows-person', label: '人认识人', from: 'person', to: 'person' },
  { value: 'item-pairs-with-item', label: '物搭配物', from: 'item', to: 'item' },
  { value: 'generic', label: '通用关联', from: '*', to: '*' },
];

const FN_BY_TYPE = { event: 'event', person: 'person', item: 'item' };

Page({
  data: {
    types: TYPES,
    relCandidates: REL_CANDIDATES,
    fromId: '',
    fromType: '',
    toType: 'event',
    toList: [],
    relType: '',
    selectedToId: '',
    selectedToEntity: null,
    loading: false,
  },

  onLoad(opts) {
    this.setData({ fromId: opts.fromId, fromType: opts.fromType });
    this.fetchToList();
  },

  onToTypeSelect(e) {
    this.setData({ toType: e.currentTarget.dataset.value, selectedToId: '', selectedToEntity: null });
    this.fetchToList();
  },

  onRelTypeSelect(e) {
    this.setData({ relType: e.currentTarget.dataset.value });
  },

  onEntitySelect(e) {
    const idx = e.currentTarget.dataset.index;
    const item = this.data.toList[idx];
    this.setData({ selectedToId: item._id, selectedToEntity: item });
  },

  async fetchToList() {
    this.setData({ loading: true });
    try {
      const res = await cloud.call(FN_BY_TYPE[this.data.toType], { action: 'list' });
      this.setData({ toList: res || [] });
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
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
          fromId: this.data.fromId,
          fromType: this.data.fromType,
          toId: this.data.selectedToId,
          toType: this.data.toType,
          relType: this.data.relType,
        },
      });
      wx.showToast({ title: '已关联', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (err) {
      wx.showToast({ title: err.message || '关联失败', icon: 'none' });
    }
  },
});
