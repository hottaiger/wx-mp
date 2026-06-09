## 1. 项目脚手架与基础配置

- [x] 1.1 在 `miniprogram/app.json` 替换 pages 列表为 `[pages/index/index, pages/capture/index, pages/detail/index, pages/weekly-review/index, pages/relation/index]`，更新 `navigationBarTitleText: "微录"`
- [x] 1.2 在 `project.config.json` 调整 `miniprogramRoot`、appid 占位，配置云开发环境 id
- [x] 1.3 删除 quickstart 示例：`pages/example/index`、示例云函数逻辑、README 中 quickstart 描述
- [x] 1.4 在云开发控制台创建集合 `persons / events / items / relations / reminders`，并为 `events.startAt`、`relations.fromId`、`relations.toId`、`reminders.sendAt` 建索引

## 2. 数据层云函数（cloud-data-layer）

- [ ] 2.1 在 `cloudfunctions/quickstartFunctions` 下按域拆分子函数目录 `person / event / item / relation / reminder / weeklyStats`，每目录一个 `index.js` + `package.json`
- [ ] 2.2 实现统一 `withAuth` 工具：注入 OPENID、捕获错误并返回标准错误码
- [ ] 2.3 实现统一 `crud` 基类：`create / update / list / remove`，list 支持 `where/page/pageSize/field/orderBy`
- [ ] 2.4 在 `cloudfunctions/quickstartFunctions/index.js` 注册 router，把不同 action 派发到对应域

## 3. 人物实体（person-entity）

- [ ] 3.1 实现 `createPerson / updatePerson / listPersons / deletePerson` 云函数
- [ ] 3.2 在 `pages/index` 渲染人物 Tab 列表，调用 `listPersons`，支持搜索与下拉刷新
- [ ] 3.3 在 `pages/detail` 渲染 person 详情，支持编辑（弹出底部 sheet 复用 entity-card）
- [ ] 3.4 实现删除时的级联 relation 删除

## 4. 事件实体（event-entity）

- [ ] 4.1 实现 `createEvent / updateEvent / listEvents / deleteEvent` 云函数，含 type 与 startAtRange 筛选
- [ ] 4.2 在 `pages/index` 事件 Tab 渲染列表，按 startAt 倒序
- [ ] 4.3 在 `pages/detail` event 详情展示时间、时长、描述、标签
- [ ] 4.4 实现删除时级联 relation/reminder 删除

## 5. 物品实体（item-entity）

- [ ] 5.1 实现 `createItem / updateItem / listItems / deleteItem` 云函数，attrs 深合并
- [ ] 5.2 在 `pages/index` 物品 Tab 渲染，按 boughtAt 倒序
- [ ] 5.3 物品详情页支持编辑自由 attrs（key/value 输入对）

## 6. 实体关联（entity-relation）

- [ ] 6.1 实现 `createRelation / listRelations / deleteRelation` 云函数，含 relType 白名单与幂等去重
- [ ] 6.2 在 `pages/relation` 实现关联选择器：选 from → 选 to（按类型筛）→ 选 relType → 提交
- [ ] 6.3 在 `pages/detail` 加「关联 Tab」，展示当前实体作为端点的所有关联，点击跳转对端
- [ ] 6.4 列表卡片显示对方实体摘要（名字/标题/图）

## 7. 快速录入（quick-capture）

- [ ] 7.1 在 `pages/index` 加右下角悬浮按钮（自定义 Tab Bar + 按钮），点击 `navigateTo pages/capture`
- [ ] 7.2 `pages/capture` 实现顶部三 Tab（人/事/物）切换表单
- [ ] 7.3 表单字段按 spec/cloud-data-layer 列出渲染，必填校验
- [ ] 7.4 提交成功后弹窗「去关联 / 跳过」二选一
- [ ] 7.5 失败/网络错误显示 toast 并保留输入

## 8. 时间提醒（time-reminder）

- [ ] 8.1 客户端实现相对时间解析工具：`parseRelativeTime('20 分钟后' | '明天 9 点' | '下周一')`
- [ ] 8.2 录入页加「提醒我」开关，开启后弹时间输入（带相对时间快捷选项）
- [ ] 8.3 实现 `createReminder` 云函数，触发时调 `wx.requestSubscribeMessage` 写 subscribed 字段
- [ ] 8.4 部署定时触发器云函数 `reminderDispatcher`，每分钟扫表发送订阅消息，状态机：`pending → sent | failed_unsub`
- [ ] 8.5 在 MP 平台申请一次性订阅消息模板（待办提醒类），上传模板 id 到配置

## 9. 周复盘（weekly-review）

- [ ] 9.1 实现 `weeklyStats` 云函数，含会议总时长、按天分布、Top 5 关联实体
- [ ] 9.2 `pages/weekly-review` 实现：标题区显示本周日期范围、会议总时长大字
- [ ] 9.3 渲染 7 天柱状图（简易 view 实现，无图表库）
- [ ] 9.4 渲染 Top 5 列表，跳转详情

## 10. 联调与发布

- [ ] 10.1 真机自测：录入一条「明早 9 点开会 + 关联自己 + 关联电脑」流程
- [ ] 10.2 验证提醒到点能收到订阅消息
- [ ] 10.3 验证周复盘周一切换时数据正确
- [ ] 10.4 上传体验版（`uploadCloudFunction.sh` 改造 + miniprogram 上传）
- [ ] 10.5 写 `README.md` 介绍微录能力、部署步骤、订阅消息模板申请指引
