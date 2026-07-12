#!/bin/bash
set -e
node --check miniprogram/utils/*.js
node --check miniprogram/app.js
for p in miniprogram/pages/*/index.js; do node --check "$p"; done
node --check miniprogram/config.js
for d in cloudfunctions/common cloudfunctions/*/common; do
  [ -d "$d" ] || continue
  for f in "$d"/*.js; do node --check "$f"; done
done
for d in cloudfunctions/*/; do
  [ -f "$d/index.js" ] && node --check "$d/index.js"
done
node -e "JSON.parse(require('fs').readFileSync('miniprogram/app.json'))"
node scripts/test-relation-view.js
node scripts/test-relation-rules.js
node scripts/test-relation-refresh.js
node scripts/test-delete-query.js
node --test scripts/test-content-security.js
node --test scripts/test-content-security-handlers.js
node --test scripts/test-content-security-client.js
node --test scripts/test-content-security-config.js
for fn in person event item; do
  cmp -s cloudfunctions/common/contentSecurity.js "cloudfunctions/$fn/common/contentSecurity.js" || {
    echo "CONTENT_SECURITY_COPY_MISMATCH: $fn" >&2
    exit 1
  }
done
echo BUILD_OK
