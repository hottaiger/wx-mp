const REL_CANDIDATES = [
  { value: 'event-involves-person', label: '事件涉及人', from: 'event', to: 'person' },
  { value: 'event-involves-item', label: '事件涉及物', from: 'event', to: 'item' },
  { value: 'person-owns-item', label: '人拥有物', from: 'person', to: 'item' },
  { value: 'person-knows-person', label: '人认识人', from: 'person', to: 'person' },
  { value: 'item-pairs-with-item', label: '物搭配物', from: 'item', to: 'item' },
  { value: 'generic', label: '通用关联', from: '*', to: '*' },
];

function relationMatches(candidate, fromType, toType) {
  if (!candidate) return false;
  if (candidate.from === '*' && candidate.to === '*') return true;
  return (
    (candidate.from === fromType && candidate.to === toType) ||
    (candidate.from === toType && candidate.to === fromType)
  );
}

function decorateRelationCandidates(fromType, toType) {
  return REL_CANDIDATES.map((candidate) => ({
    value: candidate.value,
    label: candidate.label,
    from: candidate.from,
    to: candidate.to,
    disabled: !relationMatches(candidate, fromType, toType),
  }));
}

function normalizeRelationPayload(input) {
  const payload = input || {};
  const candidate = REL_CANDIDATES.find((item) => item.value === payload.relType);
  if (!candidate || candidate.from === '*') {
    return payload;
  }
  if (candidate.from === payload.fromType && candidate.to === payload.toType) {
    return payload;
  }
  if (candidate.from === payload.toType && candidate.to === payload.fromType) {
    return {
      fromId: payload.toId,
      fromType: payload.toType,
      toId: payload.fromId,
      toType: payload.fromType,
      relType: payload.relType,
    };
  }
  return payload;
}

module.exports = {
  REL_CANDIDATES,
  decorateRelationCandidates,
  normalizeRelationPayload,
};
