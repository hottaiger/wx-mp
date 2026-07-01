#!/usr/bin/env node
const assert = require('assert');
const { groupRelationsByType } = require('../miniprogram/utils/relation-view.js');

const sample = [
  { _id: 'r1', counterparty: { id: 'e1', type: 'event', title: '买鼠标' } },
  { _id: 'r2', counterparty: { id: 'i1', type: 'item', title: '鼠标' } },
  { _id: 'r3', counterparty: { id: 'p2', type: 'person', title: '李四' } },
  { _id: 'r4', counterparty: { id: 'e2', type: 'event', title: '明天开会' } },
];

const groupedForPerson = groupRelationsByType(sample, 'person');
assert.deepStrictEqual(
  groupedForPerson.map((group) => group.type),
  ['event', 'item', 'person'],
  'person 详情页应优先展示 事 -> 物 -> 人'
);
assert.strictEqual(groupedForPerson[0].count, 2, '事件分组计数应正确');
assert.strictEqual(groupedForPerson[1].items[0].counterparty.title, '鼠标', '物品标题应保留');

const groupedForItem = groupRelationsByType(sample, 'item');
assert.deepStrictEqual(
  groupedForItem.map((group) => group.type),
  ['person', 'event', 'item'],
  'item 详情页应优先展示 人 -> 事 -> 物'
);

const empty = groupRelationsByType([], 'person');
assert.deepStrictEqual(empty, [], '空关联不应生成空分组');

console.log('RELATION_VIEW_OK');
