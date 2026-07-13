const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const required = {
  person: ['security.msgSecCheck'],
  event: ['security.msgSecCheck'],
  item: ['security.msgSecCheck', 'security.imgSecCheck'],
};

for (const [name, permissions] of Object.entries(required)) {
  test(`${name} deployment declares content-security OpenAPI permissions`, () => {
    const configPath = path.resolve(__dirname, `../cloudfunctions/${name}/config.json`);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const openapi = config.permissions && config.permissions.openapi;
    assert.ok(Array.isArray(openapi));
    for (const permission of permissions) assert.ok(openapi.includes(permission), permission);
  });
}
