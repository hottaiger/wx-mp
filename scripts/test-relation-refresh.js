#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'miniprogram', 'pages', 'relation', 'index.js');
const source = fs.readFileSync(file, 'utf8');

if (!source.includes('markPreviousPageForRefresh()')) {
  throw new Error('relation page must define markPreviousPageForRefresh');
}

if (!source.includes('prev._needRefresh = true')) {
  throw new Error('relation page must mark previous detail page for refresh');
}

if (!source.includes('this.markPreviousPageForRefresh();') || !source.includes('wx.navigateBack()')) {
  throw new Error('relation page must mark refresh before navigating back');
}

console.log('RELATION_REFRESH_OK');
