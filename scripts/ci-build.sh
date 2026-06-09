#!/bin/bash
set -e
node --check miniprogram/utils/*.js
node --check miniprogram/app.js
for p in miniprogram/pages/*/index.js; do node --check "$p"; done
node --check miniprogram/config.js
for f in cloudfunctions/common/*.js; do node --check "$f"; done
for d in cloudfunctions/*/; do
  [ -f "$d/index.js" ] && node --check "$d/index.js"
done
node -e "JSON.parse(require('fs').readFileSync('miniprogram/app.json'))"
echo BUILD_OK
