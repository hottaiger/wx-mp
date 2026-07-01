// pages/detail/index.js
const cloud = require('../../utils/cloud.js');
const storage = require('../../utils/storage.js');
const share = require('../../utils/share.js');
const itemImage = require('../../utils/item-image.js');
const relationView = require('../../utils/relation-view.js');

const TYPE_LABEL = { person: '人', event: '事', item: '物' };
const TYPE_MAP = { person: '人物', event: '事件', item: '物品' };
const EVENT_TYPE = { meeting: '会议', todo: '待办', reminder: '提醒', generic: '其他' };
const REL_LABEL = {
  'event-involves-person': '事件涉及',
  'event-involves-item': '事件涉及',
  'person-owns-item': '拥有',
  'person-knows-person': '认识',
  'item-pairs-with-item': '搭配',
  'generic': '关联',
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function decorate(e, type) {
  if (!e) return e;
  const out = { ...e };
  if (type === 'event' && e.startAt) out.startAtText = formatTime(e.startAt);
  if (type === 'item' && e.boughtAt) out.boughtAtText = formatDate(e.boughtAt);
  if (type === 'item' && e.attrs) {
    out.attrEntries = Object.keys(e.attrs).map((key) => ({ key, value: e.attrs[key] }));
  } else {
    out.attrEntries = [];
  }
  return out;
}

function getShareText(type, entity) {
  const name = entity.name || entity.title || '一条记录';
  if (type === 'person') return `微录 · 认识一下 ${name}`;
  if (type === 'item') return `微录 · 记录了物品 ${name}`;
  return `微录 · 记录了一件事：${name}`;
}

Page({
  data: {
    type: '',
    typeLabel: '',
    typeMap: TYPE_MAP,
    relLabel: REL_LABEL,
    eventTypeLabel: EVENT_TYPE,
    id: '',
    entity: null,
    relations: [],
    groupedRelations: [],
    activeTab2: 'detail',
    loading: true,
    isEditing: false,
    editForm: {},
    tabBar: [
      { key: 'detail', label: '详情' },
      { key: 'relation', label: '关联' },
    ],
  },

  onLoad(opts) {
    share.ensureShareMenu();
    this.setData({ type: opts.type || 'event', id: opts.id, typeLabel: TYPE_LABEL[opts.type] || '' });
    wx.setNavigationBarTitle({ title: (TYPE_LABEL[this.data.type] || '') + '详情' });
    this.loadDetail();
  },

  onShow() {
    if (this._needRefresh) { this._needRefresh = false; this.loadDetail(); }
  },

  onTabTap(e) {
    this.setData({ activeTab2: e.currentTarget.dataset.key });
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const res = await cloud.call(this.data.type, { action: 'getDetail', id: this.data.id });
      const entity = decorate(res.entity, this.data.type);
      const relations = res.relations || [...(res.relationsFrom || []), ...(res.relationsTo || [])];
      const groupedRelations = relationView.groupRelationsByType(relations, this.data.type);
      this.setData({ entity, relations, groupedRelations });
      storage.clear();
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onEditTap() {
    const e = this.data.entity || {};
    this.setData({
      isEditing: true,
      editForm: {
        ...e,
        traitsStr: Array.isArray(e.traits) ? e.traits.join(',') : '',
        tagsStr: Array.isArray(e.tags) ? e.tags.join(',') : '',
      },
    });
  },

  onCancelEdit() { this.setData({ isEditing: false, editForm: {} }); },

  onFieldInput(e) {
    this.setData({ [`editForm.${e.currentTarget.dataset.field}`]: e.detail.value });
  },

  async onChooseItemImage() {
    try {
      wx.showLoading({ title: '上传中...' });
      const file = await itemImage.chooseOneImage();
      const uploaded = await itemImage.uploadImage(file);
      this.setData({ 'editForm.coverImage': uploaded });
      wx.hideLoading();
      wx.showToast({ title: '图片已更新', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      if (err && err.errMsg && err.errMsg.includes('cancel')) return;
      wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' });
    }
  },

  onRemoveItemImage() {
    this.setData({ 'editForm.coverImage': null });
  },

  async onSaveEdit() {
    const { type, id } = this.data;
    const f = this.data.editForm;
    const payload = { ...f };
    if (typeof payload.traitsStr === 'string') {
      payload.traits = payload.traitsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      delete payload.traitsStr;
    }
    if (typeof payload.tagsStr === 'string') {
      payload.tags = payload.tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      delete payload.tagsStr;
    }
    if (type === 'item') {
      if (payload.coverImage && payload.coverImage.fileID) {
        payload.coverImage = {
          fileID: payload.coverImage.fileID,
          cloudPath: payload.coverImage.cloudPath,
        };
      } else {
        payload.coverImage = null;
      }
    }
    delete payload._id; delete payload._openid;
    try {
      await cloud.call(type, { action: 'update', id, payload });
      this.setData({ isEditing: false });
      wx.showToast({ title: '已保存', icon: 'success' });
      this._needRefresh = true;
      this.loadDetail();
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  onDeleteTap() {
    const that = this;
    wx.showModal({
      title: '确认删除？',
      content: '删除后不可恢复，关联也会一并删除',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await cloud.call(that.data.type, { action: 'remove', id: that.data.id });
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 600);
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      },
    });
  },

  onRelationTap(e) {
    const { id, type } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/detail/index?type=${type}&id=${id}` });
  },

  onAddRelation() {
    wx.navigateTo({ url: `/pages/relation/index?fromId=${this.data.id}&fromType=${this.data.type}` });
  },

  onShareAppMessage() {
    return share.buildSharePayload({
      title: getShareText(this.data.type, this.data.entity || {}),
      path: `/pages/detail/index?type=${this.data.type}&id=${this.data.id}`,
    });
  },

  onShareTimeline() {
    return share.buildSharePayload({
      title: getShareText(this.data.type, this.data.entity || {}),
      query: `type=${this.data.type}&id=${this.data.id}`,
    });
  },
});
