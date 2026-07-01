// utils/relation-view.js
const GROUP_TITLE = {
  event: '关联的事',
  item: '关联的物',
  person: '关联的人',
};

function defaultGroupOrder(type) {
  if (type === 'person') return ['event', 'item', 'person'];
  if (type === 'event') return ['person', 'item', 'event'];
  if (type === 'item') return ['person', 'event', 'item'];
  return ['event', 'item', 'person'];
}

function groupRelationsByType(relations = [], currentType = '') {
  const map = {
    event: [],
    item: [],
    person: [],
  };

  relations.forEach((relation) => {
    const key = relation && relation.counterparty && relation.counterparty.type;
    if (map[key]) map[key].push(relation);
  });

  return defaultGroupOrder(currentType)
    .map((type) => ({
      type,
      title: GROUP_TITLE[type],
      count: map[type].length,
      items: map[type],
    }))
    .filter((group) => group.count > 0);
}

module.exports = {
  groupRelationsByType,
  GROUP_TITLE,
};
