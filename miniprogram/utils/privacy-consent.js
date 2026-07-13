const CONSENT_VERSION = '2026-07-13';
const CONSENT_STORAGE_KEY = 'privacy-consent';

const AGREEMENTS = {
  service: {
    title: '用户服务协议',
    sections: [
      {
        title: '生效日期与服务提供者',
        paragraphs: [
          '本协议自 2026 年 7 月 13 日起生效。服务提供者为“微录WL”的微信认证主体，具体认证信息以微信小程序“关于”页面公示为准。',
          '如需咨询、投诉或行使数据权利，可通过微信客户端内本小程序的“反馈与投诉”入口联系我们。',
        ],
      },
      {
        title: '一、服务内容',
        paragraphs: [
          '微录用于记录和管理用户主动填写的人、事、物信息，建立实体关联并生成周复盘；提醒仅在用户主动开启时提供。',
        ],
      },
      {
        title: '二、用户责任',
        paragraphs: [
          '用户应确保录入内容合法，并对录入内容拥有相应权利；不得利用本服务侵害他人合法权益。',
        ],
      },
      {
        title: '三、账号与数据安全',
        paragraphs: [
          '记录按当前微信用户身份隔离。用户应妥善保护微信账号，不应授权他人以自己的身份使用本服务。',
        ],
      },
      {
        title: '四、数据与控制',
        paragraphs: [
          '用户可查看、编辑或删除记录，也可随时取消本机授权。取消授权后停止新增数据上传，已保存记录仍可使用现有删除功能处理。',
        ],
      },
      {
        title: '五、协议更新',
        paragraphs: [
          '服务内容或数据处理规则发生变化时，我们将更新协议版本；旧版本授权会自动失效，用户需重新阅读并同意。',
        ],
      },
      {
        title: '六、责任边界',
        paragraphs: [
          '我们将采取合理措施维护服务和数据安全，但不对因不可抗力、微信平台或云服务故障、用户自身原因造成的服务中断承担超出法律规定的责任。',
        ],
      },
      {
        title: '七、服务终止',
        paragraphs: [
          '用户可以停止使用本服务并删除记录。用户严重违反法律法规或本协议时，我们可以依法限制或终止相关服务。',
        ],
      },
      {
        title: '八、争议处理',
        paragraphs: [
          '本协议的订立、履行与解释适用中华人民共和国法律。发生争议时，双方应先友好协商；协商不成的，依法向有管辖权的人民法院解决。',
        ],
      },
    ],
  },
  privacy: {
    title: '隐私政策',
    sections: [
      {
        title: '生效日期与运营主体',
        paragraphs: [
          '本政策自 2026 年 7 月 13 日起生效。运营主体为“微录WL”的微信认证主体，具体认证信息以微信小程序“关于”页面公示为准。',
        ],
      },
      {
        title: '一、收集的数据',
        paragraphs: [
          '我们处理用户主动填写的姓名、事项、物品、标签、备注、时间、属性、可选图片和提醒信息。',
        ],
      },
      {
        title: '二、使用目的',
        paragraphs: [
          '这些数据仅用于记录管理、实体关联、周复盘和用户主动开启的提醒。',
        ],
      },
      {
        title: '三、处理与存储',
        paragraphs: [
          '数据通过微信云开发云函数或云存储传输，并保存在微信云开发的云数据库或云存储中。',
          '业务数据按当前微信用户的 _openid 隔离，其他普通用户不能读取你的记录。',
        ],
      },
      {
        title: '四、使用范围',
        paragraphs: [
          '数据仅用于向当前微信用户提供上述功能；我们不出售用户数据，也不用于广告营销。',
        ],
      },
      {
        title: '五、保存期限',
        paragraphs: [
          '记录在用户主动删除前持续保存，以便提供记录、关联和复盘功能；用户删除记录后，系统按现有删除功能处理。',
        ],
      },
      {
        title: '六、用户控制',
        paragraphs: [
          '用户可以查询、更正或删除记录，也可以取消授权。取消授权后停止新增数据上传，已保存记录仍可按现有删除功能处理。',
          '如需行使其他个人信息权利，可通过微信客户端内本小程序的“反馈与投诉”入口提交请求。',
        ],
      },
      {
        title: '七、政策更新',
        paragraphs: [
          '本政策更新后将使用新的协议版本，原授权自动失效；再次上传数据前需要重新阅读并同意。',
        ],
      },
    ],
  },
};

function defaultStorage() {
  return wx;
}

function getAgreement(type) {
  return AGREEMENTS[type] || null;
}

function isConsentValid(storage = defaultStorage()) {
  try {
    const record = storage.getStorageSync(CONSENT_STORAGE_KEY);
    return Boolean(
      record
      && typeof record === 'object'
      && record.version === CONSENT_VERSION
      && Number.isFinite(record.agreedAt)
      && record.agreedAt > 0
    );
  } catch (err) {
    return false;
  }
}

function grantConsent(storage = defaultStorage(), now = Date.now()) {
  try {
    storage.setStorageSync(CONSENT_STORAGE_KEY, {
      version: CONSENT_VERSION,
      agreedAt: now,
    });
    return true;
  } catch (err) {
    return false;
  }
}

function revokeConsent(storage = defaultStorage()) {
  try {
    storage.removeStorageSync(CONSENT_STORAGE_KEY);
    return true;
  } catch (err) {
    try {
      storage.setStorageSync(CONSENT_STORAGE_KEY, {
        version: `revoked:${CONSENT_VERSION}`,
        agreedAt: 0,
      });
      return true;
    } catch (fallbackError) {
      return false;
    }
  }
}

module.exports = {
  CONSENT_VERSION,
  CONSENT_STORAGE_KEY,
  getAgreement,
  isConsentValid,
  grantConsent,
  revokeConsent,
};
