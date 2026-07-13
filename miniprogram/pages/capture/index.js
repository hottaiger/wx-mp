// pages/capture/index.js
const cloud = require('../../utils/cloud.js');
const timeParser = require('../../utils/time-parser.js');
const itemImage = require('../../utils/item-image.js');
const privacyConsent = require('../../utils/privacy-consent.js');

const PRIVACY_PROMPT = '请先阅读并同意用户服务协议和隐私政策';

const TABS = [
  { key: 'event', label: '事' },
  { key: 'person', label: '人' },
  { key: 'item', label: '物' },
];

const EVENT_TYPES = [
  { value: 'meeting', label: '会议' },
  { value: 'todo', label: '待办' },
  { value: 'reminder', label: '提醒' },
  { value: 'generic', label: '其他' },
];



Page({
  data: {
    tabs: TABS,
    activeTab: 'event',
    eventTypes: EVENT_TYPES,
    form: {
      name: '', title: '', type: 'meeting',
      startDate: '', startTime: '',
      durationMin: 60,
      description: '', note: '',
      traitsStr: '', tagsStr: '',
      boughtDate: '',
      coverImage: null,
      attrs: [], // [{key,value}]
      newAttrKey: '', newAttrValue: '',
    },
    reminderEnabled: false,
    reminderPreset: '',
    reminderCustom: '',
    reminderPresets: ['5 分钟后', '20 分钟后', '1 小时后', '明早 9 点', '明晚 9 点'],
    submitting: false,
    privacyAgreed: false,
    privacyDialogVisible: false,
    privacyDialogTitle: '',
    privacyDialogSections: [],
  },

  onBack() { wx.navigateBack(); },

  onLoad(opts) {
    const tab = TABS.find((t) => t.key === opts.type) ? opts.type : 'event';
    this.setData({
      activeTab: tab,
      privacyAgreed: privacyConsent.isConsentValid(),
    });
  },

  ensurePrivacyConsent() {
    const valid = this.data.privacyAgreed && privacyConsent.isConsentValid();
    if (valid) return true;
    this.setData({ privacyAgreed: false });
    wx.showToast({ title: PRIVACY_PROMPT, icon: 'none' });
    return false;
  },

  onPrivacyConsentChange(e) {
    const values = e && e.detail && e.detail.value;
    const agreed = Array.isArray(values) && values.includes('agreed');
    if (!agreed) {
      const revoked = privacyConsent.revokeConsent();
      this.setData({ privacyAgreed: false });
      if (!revoked) {
        wx.showToast({ title: '授权撤回失败，请稍后重试', icon: 'none' });
      }
      return;
    }
    const saved = privacyConsent.grantConsent();
    this.setData({ privacyAgreed: saved });
    if (!saved) {
      wx.showToast({ title: '授权保存失败，请稍后重试', icon: 'none' });
    }
  },

  onOpenAgreement(e) {
    const agreement = privacyConsent.getAgreement(e.currentTarget.dataset.type);
    if (!agreement) return;
    this.setData({
      privacyDialogVisible: true,
      privacyDialogTitle: agreement.title,
      privacyDialogSections: agreement.sections,
    });
  },

  onClosePrivacyDialog() {
    this.setData({ privacyDialogVisible: false });
  },

  noop() {},

  onTabTap(e) {
    this.setData({ activeTab: e.currentTarget.dataset.key });
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch['form.' + field] = e.detail.value;
    this.setData(patch);
  },

  onEventTypeSelect(e) {
    this.setData({ 'form.type': e.currentTarget.dataset.value });
  },

  onStartDateChange(e) {
    this.setData({ 'form.startDate': e.detail.value });
  },
  onStartTimeChange(e) {
    this.setData({ 'form.startTime': e.detail.value });
  },
  onBoughtDateChange(e) {
    this.setData({ 'form.boughtDate': e.detail.value });
  },

  async onChooseItemImage() {
    if (!this.ensurePrivacyConsent()) return;
    try {
      wx.showLoading({ title: '上传中...' });
      const file = await itemImage.chooseOneImage();
      const uploaded = await itemImage.uploadImage(file);
      this.setData({ 'form.coverImage': uploaded });
      wx.hideLoading();
      wx.showToast({ title: '图片已添加', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      if (err && err.errMsg && err.errMsg.includes('cancel')) return;
      wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' });
    }
  },

  onRemoveItemImage() {
    this.setData({ 'form.coverImage': null });
  },

  onAttrKeyInput(e) { this.setData({ 'form.newAttrKey': e.detail.value }); },
  onAttrValueInput(e) { this.setData({ 'form.newAttrValue': e.detail.value }); },
  onAddAttr() {
    const { newAttrKey: k, newAttrValue: v, attrs } = this.data.form;
    if (!k) { wx.showToast({ title: '请输入属性名', icon: 'none' }); return; }
    const nextAttrs = attrs.slice();
    nextAttrs.push({ key: k, value: v });
    this.setData({
      'form.attrs': nextAttrs,
      'form.newAttrKey': '',
      'form.newAttrValue': '',
    });
  },
  onRemoveAttr(e) {
    const idx = e.currentTarget.dataset.index;
    const attrs = this.data.form.attrs.filter((_, i) => i !== idx);
    this.setData({ 'form.attrs': attrs });
  },

  onReminderToggle(e) {
    this.setData({ reminderEnabled: e.detail.value });
  },
  onReminderPresetSelect(e) {
    this.setData({ reminderPreset: e.currentTarget.dataset.value, reminderCustom: '' });
  },
  onReminderCustomInput(e) {
    this.setData({ reminderCustom: e.detail.value, reminderPreset: '' });
  },

  validateAndBuild() {
    const { activeTab, form, reminderEnabled, reminderPreset, reminderCustom } = this.data;
    const payload = {};
    if (activeTab === 'event') {
      if (!form.title.trim()) return { error: '请填写标题' };
      payload.title = form.title.trim();
      payload.type = form.type;
      if (form.startDate && form.startTime) {
        payload.startAt = new Date(`${form.startDate} ${form.startTime}`).getTime();
        if (Number.isNaN(payload.startAt)) return { error: '开始时间格式错误' };
      } else {
        payload.startAt = Date.now();
      }
      if (form.durationMin) payload.durationMin = Number(form.durationMin);
      if (form.description) payload.description = form.description;
    } else if (activeTab === 'person') {
      if (!form.name.trim()) return { error: '请填写姓名' };
      payload.name = form.name.trim();
      if (form.traitsStr.trim()) payload.traits = form.traitsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (form.tagsStr.trim()) payload.tags = form.tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (form.note) payload.note = form.note;
    } else if (activeTab === 'item') {
      if (!form.name.trim()) return { error: '请填写物品名' };
      payload.name = form.name.trim();
      if (form.boughtDate) {
        payload.boughtAt = new Date(`${form.boughtDate} 00:00`).getTime();
        if (Number.isNaN(payload.boughtAt)) return { error: '购买时间格式错误' };
      }
      if (form.attrs.length) {
        payload.attrs = {};
        form.attrs.forEach((a) => { payload.attrs[a.key] = a.value; });
      }
      if (form.coverImage && form.coverImage.fileID) {
        payload.coverImage = {
          fileID: form.coverImage.fileID,
          cloudPath: form.coverImage.cloudPath,
        };
      }
      if (form.tagsStr.trim()) payload.tags = form.tagsStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (form.note) payload.note = form.note;
    }
    let reminder = null;
    if (reminderEnabled) {
      const expr = reminderPreset || reminderCustom;
      if (!expr) return { error: '请选择或输入提醒时间' };
      const triggerAt = timeParser.parseRelativeTime(expr);
      if (!triggerAt) return { error: '无法解析时间，请改为具体时刻' };
      reminder = { triggerAt, message: payload.title || payload.name };
    }
    return { payload, reminder, type: activeTab };
  },

  async onSubmit() {
    if (this.data.submitting) return;
    if (!this.ensurePrivacyConsent()) return;
    const r = this.validateAndBuild();
    if (r.error) {
      wx.showToast({ title: r.error, icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({ title: '保存中...' });
    try {
      // 1) 订阅消息授权（若有提醒）
      let subscribed = false;
      if (r.reminder) {
        try {
          const app = getApp();
          const tmpl = (app && app.globalData && app.globalData.config && app.globalData.config.subscribeMessageTemplateId) || '';
          if (tmpl && tmpl !== 'your-template-id') {
            const subRes = await wx.requestSubscribeMessage({ tmplIds: [tmpl] });
            subscribed = subRes && subRes[tmpl] === 'accept';
          }
        } catch (e) { /* ignore */ }
      }
      // 2) 提交实体
      const created = await cloud.call(r.type, { action: 'create', payload: r.payload });
      // 3) 创建提醒
      if (r.reminder) {
        await cloud.call('reminder', {
          action: 'create',
          payload: {
            targetType: r.type,
            targetId: created._id,
            triggerAt: r.reminder.triggerAt,
            message: r.reminder.message,
            subscribed,
          },
        });
      }
      wx.hideLoading();
      wx.showToast({ title: '已记录', icon: 'success' });
      // 4) 弹窗「去关联 / 跳过」
      setTimeout(() => {
        wx.showModal({
          title: '立即建立关联？',
          content: '把这条记录关联到现有的人、事、物',
          confirmText: '去关联',
          cancelText: '跳过',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.redirectTo({ url: `/pages/relation/index?fromId=${created._id}&fromType=${r.type}` });
            } else {
              wx.switchTab({ url: '/pages/index/index' });
            }
          },
        });
      }, 600);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  },
});
