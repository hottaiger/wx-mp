// app.js
const config = require('./config.js');

App({
  onLaunch() {
    this.globalData = {
      env: config.cloudEnv,
      config,
    };
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    });
    // 预热获取 openid，失败不阻塞启动
    this.fetchOpenId();
  },
  fetchOpenId() {
    return new Promise((resolve) => {
      if (this.globalData.openid) {
        resolve(this.globalData.openid);
        return;
      }
      wx.cloud
        .callFunction({ name: 'person', data: { action: 'whoami' } })
        .then((res) => {
          if (res && res.result && res.result.data && res.result.data.openid) {
            this.globalData.openid = res.result.data.openid;
            resolve(this.globalData.openid);
          } else {
            resolve(null);
          }
        })
        .catch(() => resolve(null));
    });
  },
});
