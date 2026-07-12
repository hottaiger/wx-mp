---
change: add-content-security-checks
design-doc: docs/superpowers/specs/2026-07-12-content-security-design.md
base-ref: 77339f16cd084f5da120b794b2063d2e44428ecb
---

# Content Security Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce WeChat text and item-image content inspection before every person, event, or item create/update database write, while exposing only fixed safe client messages.

**Architecture:** A dependency-injected `contentSecurity` adapter lives in the shared cloud-function common package and is copied byte-for-byte into each independently deployable entity function. Entity handlers call it after validation and before CRUD; the item update path reads the persisted image only when a submitted image may be a replacement. The mini-program keeps presentation and upload-size validation only, while `utils/cloud.js` owns business-code-to-copy mapping.

**Tech Stack:** WeChat Mini Program JavaScript, WeChat Cloud Functions, `wx-server-sdk ~2.4.0`, `cloud.openapi.security.msgSecCheck`, `cloud.openapi.security.imgSecCheck`, Node.js built-in `node:test` and `assert`.

## Global Constraints

- All create/update enforcement MUST run inside `person`, `event`, and `item` before CRUD writes; frontend checks are not a security boundary.
- Text inspection MUST pass `version: 2`, `scene: 1`, and the authenticated current user's `openid`.
- Risky and review results MUST surface only `ERR_CONTENT_RISKY`; unavailable or malformed checks MUST surface only `ERR_CONTENT_SECURITY_UNAVAILABLE`.
- The exact risky-content client copy is `所发布内容含违规信息`; unavailable inspection uses `发布失败，请稍后重试`.
- Raw WeChat labels, strategies, suggestions, confidence, trace IDs, API messages, and responses MUST NOT be returned to the client.
- Text collection excludes `_id`, `_openid`, `fileID`, `cloudPath`, and `tempFilePath` and ignores empty/non-string values.
- Item images are checked on create and replacement only; unchanged images and removals are not checked.
- Each of `cloudfunctions/person`, `cloudfunctions/event`, and `cloudfunctions/item` MUST contain its own byte-identical `common/contentSecurity.js`.
- Existing page paths, collection names, cloud-function names, `_openid` isolation, and `wx.cloud.callFunction` publication flow remain unchanged.
- Images selected through `wx.chooseMedia` MUST request compression and reject files over the synchronous image-check limit before upload.

---

### Task 1: Content-security adapter and business errors

**Files:**
- Create: `scripts/test-content-security.js`
- Create: `cloudfunctions/common/contentSecurity.js`
- Modify: `cloudfunctions/common/errors.js`
- Modify: `cloudfunctions/common/index.js`
- Create: `cloudfunctions/person/common/contentSecurity.js`
- Create: `cloudfunctions/event/common/contentSecurity.js`
- Create: `cloudfunctions/item/common/contentSecurity.js`
- Modify: `cloudfunctions/person/common/errors.js`
- Modify: `cloudfunctions/event/common/errors.js`
- Modify: `cloudfunctions/item/common/errors.js`
- Modify: `cloudfunctions/person/common/index.js`
- Modify: `cloudfunctions/event/common/index.js`
- Modify: `cloudfunctions/item/common/index.js`

**Interfaces:**
- Consumes: a `cloud` object exposing `openapi.security.msgSecCheck`, `openapi.security.imgSecCheck`, and `downloadFile`.
- Produces: `collectText(payload): string`, `createContentSecurityError(kind): Error`, `assertTextSafe({ cloud, openid, payload }): Promise<void>`, and `assertImageSafe({ cloud, fileID, cloudPath }): Promise<void>`; new error constants `ERROR_CODES.CONTENT_RISKY` and `ERROR_CODES.CONTENT_SECURITY_UNAVAILABLE`.

- [x] **Step 1: Write failing adapter tests**

Create `scripts/test-content-security.js` with `node:test` cases that import `cloudfunctions/common/contentSecurity.js` and assert:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  collectText,
  assertTextSafe,
  assertImageSafe,
} = require('../cloudfunctions/common/contentSecurity.js');

test('collectText normalizes nested authored strings and excludes metadata', () => {
  const text = collectText({
    _id: 'record-id',
    name: '  Alice  ',
    traits: ['friend', 'friend', ''],
    attrs: { location: ' Beijing ', fileID: 'cloud://secret' },
    coverImage: { cloudPath: 'items/a.jpg', tempFilePath: '/tmp/a.jpg' },
    count: 3,
  });
  assert.equal(text, 'Alice\nfriend\nBeijing');
});

test('assertTextSafe sends v2 scene 1 and openid', async () => {
  let input;
  const cloud = { openapi: { security: { msgSecCheck: async (value) => {
    input = value;
    return { result: { suggest: 'pass' } };
  } } } };
  await assertTextSafe({ cloud, openid: 'openid-1', payload: { name: 'Alice' } });
  assert.deepEqual(input, { content: 'Alice', version: 2, scene: 1, openid: 'openid-1' });
});

for (const suggest of ['risky', 'review']) {
  test(`assertTextSafe classifies ${suggest} without upstream details`, async () => {
    const cloud = { openapi: { security: { msgSecCheck: async () => ({ result: { suggest, label: 20001 } }) } } };
    await assert.rejects(
      assertTextSafe({ cloud, openid: 'o', payload: { name: 'x' } }),
      (error) => error.code === 'ERR_CONTENT_RISKY' && !error.message.includes('20001'),
    );
  });
}

test('assertTextSafe fails closed for malformed and thrown calls', async () => {
  for (const msgSecCheck of [async () => ({}), async () => { throw new Error('trace secret'); }]) {
    const cloud = { openapi: { security: { msgSecCheck } } };
    await assert.rejects(
      assertTextSafe({ cloud, openid: 'o', payload: { name: 'x' } }),
      (error) => error.code === 'ERR_CONTENT_SECURITY_UNAVAILABLE' && !error.message.includes('secret'),
    );
  }
});

test('assertImageSafe downloads and checks the image buffer', async () => {
  const buffer = Buffer.from('image');
  let checked;
  const cloud = {
    downloadFile: async ({ fileID }) => { assert.equal(fileID, 'cloud://image'); return { fileContent: buffer }; },
    openapi: { security: { imgSecCheck: async ({ media }) => { checked = media; return { errCode: 0 }; } } },
  };
  await assertImageSafe({ cloud, fileID: 'cloud://image', cloudPath: 'items/image.png' });
  assert.deepEqual(checked, { contentType: 'image/png', value: buffer });
});
```

- [x] **Step 2: Run the adapter tests and verify RED**

Run: `node --test scripts/test-content-security.js`

Expected: FAIL with `Cannot find module '../cloudfunctions/common/contentSecurity.js'`.

- [x] **Step 3: Implement the adapter and error constants**

Implement `cloudfunctions/common/contentSecurity.js` with a recursive collector using `Set` insertion order, an empty-text no-op, exact text request parameters, pass-only success, risky/review classification, image download and `imgSecCheck({ media: { contentType, value: fileContent } })`, and fail-closed error conversion. Treat documented error code `87014` as risky; never copy an upstream error message into the created error.

```js
const EXCLUDED_KEYS = new Set(['_id', '_openid', 'fileID', 'cloudPath', 'tempFilePath']);

function collectText(payload) {
  const values = new Set();
  function visit(value, key) {
    if (EXCLUDED_KEYS.has(key)) return;
    if (typeof value === 'string') {
      const text = value.trim();
      if (text) values.add(text);
      return;
    }
    if (Array.isArray(value)) { value.forEach((entry) => visit(entry)); return; }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
    }
  }
  visit(payload);
  return [...values].join('\n');
}

function createContentSecurityError(kind) {
  const risky = kind === 'risky';
  return Object.assign(new Error(risky ? 'Content rejected' : 'Content inspection unavailable'), {
    code: risky ? 'ERR_CONTENT_RISKY' : 'ERR_CONTENT_SECURITY_UNAVAILABLE',
  });
}
```

Add to every deployable `common/errors.js`:

```js
CONTENT_RISKY: 'ERR_CONTENT_RISKY',
CONTENT_SECURITY_UNAVAILABLE: 'ERR_CONTENT_SECURITY_UNAVAILABLE',
```

Export from every deployable `common/index.js`:

```js
contentSecurity: require('./contentSecurity.js'),
```

Copy `cloudfunctions/common/contentSecurity.js` byte-for-byte into the three entity packages after the root helper passes tests.

- [x] **Step 4: Complete classification tests and verify GREEN**

Add tests for empty payload no-op, explicit text `pass`, image risk conversion using a documented risk code, and download/API failures becoming `ERR_CONTENT_SECURITY_UNAVAILABLE`. Run: `node --test scripts/test-content-security.js`

Expected: all content-security adapter tests PASS.

- [x] **Step 5: Commit the adapter**

```bash
git add scripts/test-content-security.js cloudfunctions/common cloudfunctions/person/common cloudfunctions/event/common cloudfunctions/item/common
git commit -m "feat: add content security adapter"
```

### Task 2: Enforce text inspection in all entity write paths

**Files:**
- Create: `scripts/test-content-security-handlers.js`
- Modify: `cloudfunctions/person/index.js`
- Modify: `cloudfunctions/event/index.js`
- Modify: `cloudfunctions/item/index.js`

**Interfaces:**
- Consumes: `contentSecurity.assertTextSafe({ cloud, openid, payload })` from Task 1.
- Produces: person/event/item create and update handlers that await text inspection before `crud.create` or `crud.update`.

- [x] **Step 1: Write failing source-contract and ordering tests**

Create `scripts/test-content-security-handlers.js` using `node:test`. Load each handler with a fake `wx-server-sdk` and fake `./common/index.js` via a temporary `Module._load` override; record calls from `assertTextSafe`, `crud.create`, and `crud.update`. Invoke the exported wrapped `main` with create and update events and assert exact ordering:

```js
for (const entity of ['person', 'event', 'item']) {
  test(`${entity} create inspects text before create`, async () => {
    const { main, calls } = loadEntity(entity);
    await main({ action: 'create', payload: { name: 'safe' } });
    assert.deepEqual(calls.slice(0, 2), ['text:safe:openid-1', `create:${entity}`]);
  });

  test(`${entity} update inspects text before update`, async () => {
    const { main, calls } = loadEntity(entity);
    await main({ action: 'update', id: 'id-1', payload: { note: 'safe' } });
    assert.deepEqual(calls.slice(-2), ['text:safe:openid-1', `update:${entity}`]);
  });
}
```

The test loader's fake `withAuth` must invoke handlers with `{ openid: 'openid-1' }`; the fake database must provide `command`, `collection`, and `RegExp` members required during module initialization.

- [x] **Step 2: Run handler tests and verify RED**

Run: `node --test scripts/test-content-security-handlers.js`

Expected: FAIL because CRUD is called without a preceding `text:*` call.

- [x] **Step 3: Add text inspection to create and update handlers**

In all three entity entry files, import the adapter:

```js
const { withAuth, crud, errors, contentSecurity } = require('./common/index.js');
```

After existing payload/id validation and immediately before CRUD, add:

```js
await contentSecurity.assertTextSafe({ cloud, openid: ctx.openid, payload });
return crud.create(COLLECTION, payload, ctx.openid);
```

and:

```js
const payload = event.payload || {};
await contentSecurity.assertTextSafe({ cloud, openid: ctx.openid, payload });
return crud.update(COLLECTION, event.id, payload, ctx.openid);
```

- [x] **Step 4: Verify text enforcement and failure short-circuiting**

Extend the tests so `assertTextSafe` throws and assert neither create nor update appears in `calls`. Run: `node --test scripts/test-content-security-handlers.js`

Expected: all six ordering tests and all short-circuit tests PASS.

- [x] **Step 5: Commit text enforcement**

```bash
git add scripts/test-content-security-handlers.js cloudfunctions/person/index.js cloudfunctions/event/index.js cloudfunctions/item/index.js
git commit -m "feat: inspect entity text before writes"
```

### Task 3: Enforce item-image inspection only for new images

**Files:**
- Modify: `scripts/test-content-security-handlers.js`
- Modify: `cloudfunctions/item/index.js`

**Interfaces:**
- Consumes: `contentSecurity.assertImageSafe({ cloud, fileID, cloudPath })` and `crud.getOne(collection, id, openid)`.
- Produces: create/new-image and update/replacement-image checks, with no check for unchanged image, image removal, or no image field.

- [x] **Step 1: Write failing item image path tests**

Extend the fake loader to record `image:<fileID>`, return a configurable persisted record from `crud.getOne`, and cover these exact cases:

```js
test('item create checks a submitted image before create', async () => {
  const { main, calls } = loadEntity('item');
  await main({ action: 'create', payload: { name: 'item', coverImage: { fileID: 'cloud://new' } } });
  assert.deepEqual(calls.slice(-2), ['image:cloud://new', 'create:item']);
});

test('item update checks only a replacement image', async () => {
  const { main, calls } = loadEntity('item', { coverImage: { fileID: 'cloud://old' } });
  await main({ action: 'update', id: 'id-1', payload: { coverImage: { fileID: 'cloud://new' } } });
  assert.ok(calls.indexOf('getOne:id-1') < calls.indexOf('image:cloud://new'));
  assert.ok(calls.indexOf('image:cloud://new') < calls.indexOf('update:item'));
});
```

Also assert no `image:*` call for unchanged `cloud://old`, `coverImage: null`, and a payload without `coverImage`.

- [x] **Step 2: Run item-image tests and verify RED**

Run: `node --test scripts/test-content-security-handlers.js --test-name-pattern='item.*image|replacement|unchanged|removal'`

Expected: FAIL because item writes do not call `assertImageSafe`.

- [x] **Step 3: Implement image create/replacement checks**

In `createEntity`, after text inspection and before create:

```js
if (payload.coverImage && payload.coverImage.fileID) {
  await contentSecurity.assertImageSafe({ cloud, fileID: payload.coverImage.fileID, cloudPath: payload.coverImage.cloudPath });
}
```

In `updateEntity`, inspect only when the payload contains a non-null image, fetching current state before checking:

```js
if (payload.coverImage && payload.coverImage.fileID) {
  const current = await crud.getOne(COLLECTION, event.id, ctx.openid);
  const currentFileID = current.coverImage && current.coverImage.fileID;
  if (payload.coverImage.fileID !== currentFileID) {
    await contentSecurity.assertImageSafe({ cloud, fileID: payload.coverImage.fileID, cloudPath: payload.coverImage.cloudPath });
  }
}
```

- [x] **Step 4: Verify all image branches and failed-check write blocking**

Add a case where `assertImageSafe` throws and assert `update:item` is absent. Run: `node --test scripts/test-content-security-handlers.js`

Expected: all handler tests PASS, including new, replacement, unchanged, removal, absent-image, and failure branches.

- [x] **Step 5: Commit image enforcement**

```bash
git add scripts/test-content-security-handlers.js cloudfunctions/item/index.js
git commit -m "feat: inspect new item images before writes"
```

### Task 4: Safe client messages and pre-upload image constraints

**Files:**
- Create: `scripts/test-content-security-client.js`
- Modify: `miniprogram/utils/cloud.js`
- Modify: `miniprogram/utils/item-image.js`

**Interfaces:**
- Consumes: cloud-function business codes `ERR_CONTENT_RISKY` and `ERR_CONTENT_SECURITY_UNAVAILABLE`, plus `wx.chooseMedia` temp-file metadata.
- Produces: `errorMessage(code): string` for deterministic testing, fixed publication copy, compressed selection, and synchronous size/dimension rejection before upload.

- [x] **Step 1: Write failing client mapping and image-selection tests**

Create `scripts/test-content-security-client.js` and assert exact messages plus `sizeType: ['compressed']`. Stub `global.wx.chooseMedia` and `wx.getImageInfo`, test files above 1 MB and images above 750 x 1334 pixels, and assert rejection before `wx.cloud.uploadFile` can run.

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const cloud = require('../miniprogram/utils/cloud.js');

test('content-security codes map to fixed safe copy', () => {
  assert.equal(cloud.errorMessage('ERR_CONTENT_RISKY'), '所发布内容含违规信息');
  assert.equal(cloud.errorMessage('ERR_CONTENT_SECURITY_UNAVAILABLE'), '发布失败，请稍后重试');
});
```

- [x] **Step 2: Run client tests and verify RED**

Run: `node --test scripts/test-content-security-client.js`

Expected: FAIL because `errorMessage` and the image size constraint are not implemented.

- [x] **Step 3: Implement authoritative safe error mapping**

Add the two entries to `ERROR_MAP`, export a pure resolver, and ensure server-provided `result.message` cannot override a mapped business code:

```js
ERR_CONTENT_RISKY: '所发布内容含违规信息',
ERR_CONTENT_SECURITY_UNAVAILABLE: '发布失败，请稍后重试',

function errorMessage(code) {
  return ERROR_MAP[code] || '请求失败';
}
```

Change rejection to:

```js
const message = ERROR_MAP[result.code] || result.message || '请求失败';
```

Export `{ call, errorMessage }`. This keeps existing capture/detail `err.message` rendering unchanged while guaranteeing safe copy at every publishing entry point.

- [x] **Step 4: Implement compressed selection and size rejection**

In `chooseOneImage`, add `sizeType: ['compressed']`. Define `MAX_SECURITY_IMAGE_BYTES = 1024 * 1024`, `MAX_SECURITY_IMAGE_WIDTH = 750`, and `MAX_SECURITY_IMAGE_HEIGHT = 1334`; after selecting the file, reject oversized input, call `wx.getImageInfo`, and reject dimensions that fit neither portrait nor landscape orientation:

```js
if (Number(file.size) > MAX_SECURITY_IMAGE_BYTES) {
  reject(new Error('图片过大，请压缩后重试'));
  return;
}
```

Export the constants for tests. Do not add content-safety interpretation to capture/detail pages.

- [x] **Step 5: Verify client behavior and commit**

Run: `node --test scripts/test-content-security-client.js`

Expected: all mapping, compression-option, boundary-size, and oversized-file tests PASS.

```bash
git add scripts/test-content-security-client.js miniprogram/utils/cloud.js miniprogram/utils/item-image.js
git commit -m "feat: add safe content rejection UX"
```

### Task 5: Deployment-copy guard, CI integration, and requirement audit

**Files:**
- Modify: `scripts/ci-build.sh`
- Modify: `openspec/changes/add-content-security-checks/tasks.md`

**Interfaces:**
- Consumes: the three focused Node test scripts and four content-security helper copies.
- Produces: a CI gate that proves syntax, behavior, and independently deployable copy equality.

- [x] **Step 1: Add a failing copy-drift check to CI**

Add focused tests and a hash/equality loop to `scripts/ci-build.sh`:

```bash
node --test scripts/test-content-security.js
node --test scripts/test-content-security-handlers.js
node --test scripts/test-content-security-client.js
for fn in person event item; do
  cmp -s cloudfunctions/common/contentSecurity.js "cloudfunctions/$fn/common/contentSecurity.js" || {
    echo "CONTENT_SECURITY_COPY_MISMATCH: $fn" >&2
    exit 1
  }
done
```

Before synchronizing copies, alter one local copy temporarily and run `bash scripts/ci-build.sh`.

Expected: FAIL with `CONTENT_SECURITY_COPY_MISMATCH` for that package; restore it from the root helper immediately afterward.

- [x] **Step 2: Extend syntax checking to deployable common modules**

Replace the root-only common syntax loop with:

```bash
for d in cloudfunctions/common cloudfunctions/*/common; do
  [ -d "$d" ] || continue
  for f in "$d"/*.js; do node --check "$f"; done
done
```

- [x] **Step 3: Run focused and full verification**

Run:

```bash
node --test scripts/test-content-security.js
node --test scripts/test-content-security-handlers.js
node --test scripts/test-content-security-client.js
bash scripts/ci-build.sh
```

Expected: all focused tests PASS and the final line is `BUILD_OK`.

- [x] **Step 4: Audit every OpenSpec scenario against evidence**

Read `openspec/changes/add-content-security-checks/specs/content-security/spec.md` and verify each scenario has direct evidence:

- person/event/item create and update text pass and write-order tests;
- risky, review, malformed, and thrown text adapter tests;
- new/replacement/unchanged/removal image handler tests;
- risky/unavailable image adapter tests;
- exact client copy tests with server-message override protection;
- capture/detail use `utils/cloud.call` and do not directly write entity collections;
- all three deployable packages pass `cmp` against the canonical helper.

Mark Tasks 1.1 through 4.2 complete in `openspec/changes/add-content-security-checks/tasks.md` only after the corresponding command/evidence passes.

- [x] **Step 5: Commit verification wiring**

```bash
git add scripts/ci-build.sh openspec/changes/add-content-security-checks/tasks.md
git commit -m "test: verify content security publication paths"
```

Plan complete and saved to `docs/superpowers/plans/2026-07-12-content-security.md`. The selected Comet build mode determines whether implementation uses subagent-driven development or inline executing-plans.
