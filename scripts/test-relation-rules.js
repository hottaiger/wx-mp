#!/usr/bin/env node
const assert = require('assert');
const {
  decorateRelationCandidates,
  normalizeRelationPayload,
} = require('../miniprogram/utils/relation-rules.js');

const itemToPerson = decorateRelationCandidates('item', 'person');
const visibleForItemToPerson = itemToPerson.filter((item) => !item.disabled).map((item) => item.value);
assert.deepStrictEqual(
  visibleForItemToPerson,
  ['person-owns-item', 'generic'],
  '物连到人时只展示人拥有物和通用关联'
);
assert.strictEqual(
  itemToPerson.find((item) => item.value === 'person-owns-item').disabled,
  false,
  '物连到人时，人拥有物应可选'
);

const itemToEvent = decorateRelationCandidates('item', 'event');
assert.strictEqual(
  itemToEvent.find((item) => item.value === 'event-involves-item').disabled,
  false,
  '物连到事时，事件涉及物应可选'
);

const itemToPersonPayload = normalizeRelationPayload({
  fromId: 'item1',
  fromType: 'item',
  toId: 'person1',
  toType: 'person',
  relType: 'person-owns-item',
});
assert.deepStrictEqual(
  itemToPersonPayload,
  {
    fromId: 'person1',
    fromType: 'person',
    toId: 'item1',
    toType: 'item',
    relType: 'person-owns-item',
  },
  '反向发起的人拥有物应按 person -> item 存储'
);

const itemToEventPayload = normalizeRelationPayload({
  fromId: 'item1',
  fromType: 'item',
  toId: 'event1',
  toType: 'event',
  relType: 'event-involves-item',
});
assert.deepStrictEqual(
  itemToEventPayload,
  {
    fromId: 'event1',
    fromType: 'event',
    toId: 'item1',
    toType: 'item',
    relType: 'event-involves-item',
  },
  '反向发起的事件涉及物应按 event -> item 存储'
);

console.log('RELATION_RULES_OK');
