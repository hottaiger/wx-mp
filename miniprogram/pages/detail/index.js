// pages/detail/index.js
const cloud = require('../../utils/cloud.js');
const storage = require('../../utils/storage.js');

const ENTITY_LABELS = { person: '人', event: '事', item: '物' };

Page({
  data: {
    type: '',
    id: '',
    entity: null,
    relations: [],
    activeTab: 'detail',
    loading: true,
    isEditing: false,
    editForm: {},
    tabBar: [
      { key: 'detail', label: '详情' },
      { key: 'relation', label: '关联' },
    ],
  },

  onLoad(opts) {
    this.setData({ type: opts.type || 'event', id: opts.id });
    wx.setNavigationBarTitle({ title: ENTITY_LABELS[this.data.type] + '详情' });
    this.loadDetail();
  },

  onShow() {
    // 从关联页回来时刷新
    if (this._needRefresh) {
      this._needRefresh = false;
      this.loadDetail();
    }
  },

  onTabTap(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key });
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const fnName = this.data.type;
      const res = await cloud.call(fnName, { action: 'getDetail', id: this.data.id });
      const relations = [...(res.relationsFrom || []), ...(res.relationsTo || [])];
      this.setData({ entity: res.entity, relations });
      storage.clear(); // 列表缓存失效
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onEditTap() {
    const e = this.data.entity || {};
    const editForm = {
      ...e,
      traitsStr: Array.isArray(e.traits) ? e.traits.join(',') : '',
      tagsStr: Array.isArray(e.tags) ? e.tags.join(',') : '',
    };
    this.setData({ isEditing: true, editForm });
  },

  onCancelEdit() {
    this.setData({ isEditing: false, editForm: {} });
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`editForm.${field}`]: e.detail.value });
  },

  async onSaveEdit() {
    const { type, id } = this.data;
    const f = this.data.editForm;
    const payload = { ...f };
    // 反向拼接字符串到数组
    if (typeof payload.traitsStr === 'string') {
      payload.traits = payload.traitsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      delete payload.traitsStr;
    }
    if (typeof payload.tagsStr === 'string') {
      payload.tags = payload.tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      delete payload.tagsStr;
    }
    delete payload._id;
    delete payload._openid;
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

  async onDeleteTap() {
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
    wx.navigateTo({
      url: `/pages/relation/index?fromId=${this.data.id}&fromType=${this.data.type}`,
    });
  },
});
