#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTITY_FUNCTIONS = ['person', 'event', 'item'];

for (const name of ENTITY_FUNCTIONS) {
  const file = path.join(ROOT, 'cloudfunctions', name, 'index.js');
  const source = fs.readFileSync(file, 'utf8');

  if (source.includes(".where({ _openid: ctx.openid }).and(")) {
    throw new Error(name + ': delete relation cleanup must not call collection query .and()');
  }

  if (!source.includes("_openid: ctx.openid") || !source.includes("_.or([{ fromId: event.id }, { toId: event.id }])")) {
    throw new Error(name + ': delete relation cleanup must constrain _openid and fromId/toId in where()');
  }
}

console.log('DELETE_QUERY_OK');
