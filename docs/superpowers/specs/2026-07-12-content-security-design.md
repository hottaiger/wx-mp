---
comet_change: add-content-security-checks
role: technical-design
canonical_spec: openspec
---

# Content Security Technical Design

## System Boundary

The security boundary is the database-write edge inside `person`, `event`, and `item`. Every create/update handler validates input, inspects submitted content, and only then calls CRUD. The mini program remains responsible for presentation and upload ergonomics, not enforcement.

```text
capture/detail page
        |
        v
wx.cloud.callFunction
        |
        v
withAuth -> validate -> content security -> CRUD write
                           | pass             |
                           +------------------+
                           | risky/failure
                           v
                     business error
```

## Module Design

`cloudfunctions/common/contentSecurity.js` exports:

- `collectText(payload): string`: recursively collects trimmed user-authored strings, excludes system/media identifier fields, deduplicates values, and joins them for one API call.
- `assertTextSafe({ cloud, openid, payload }): Promise<void>`: calls `cloud.openapi.security.msgSecCheck` with `version: 2`, `scene: 1`, current `openid`, and normalized content. Empty content is a no-op.
- `assertImageSafe({ cloud, fileID, cloudPath }): Promise<void>`: downloads the cloud file, derives its supported MIME type, and calls `cloud.openapi.security.imgSecCheck` with `{ media: { contentType, value } }`.
- `createContentSecurityError(kind): Error`: creates either `ERR_CONTENT_RISKY` or `ERR_CONTENT_SECURITY_UNAVAILABLE` without retaining raw WeChat response data.

The file is copied byte-for-byte to `person/common/`, `event/common/`, and `item/common/`. Each local `common/index.js` exports it. CI compares hashes so independent deployment cannot omit or drift the helper.

## Text Selection

The collector accepts nested objects and arrays. It includes strings and string-array entries, while excluding keys that represent identifiers or storage metadata:

- `_id`, `_openid`
- `fileID`, `cloudPath`, `tempFilePath`

It ignores empty strings, numbers, booleans, nulls, and functions. This covers names, titles, notes, tags, traits, descriptions, and nested user-defined attributes without maintaining three fragile field allowlists.

## Handler Integration

`person` and `event`:

1. Validate required identifiers and fields.
2. Call `assertTextSafe` with the submitted payload and authenticated `ctx.openid`.
3. Call `crud.create` or `crud.update` only after inspection resolves.

`item` performs the same text sequence. When `coverImage.fileID` is present:

- Create: inspect the image.
- Update: fetch the current item through `crud.getOne`; inspect only when the submitted file ID differs from the persisted file ID.
- Removal (`coverImage: null`) or unchanged image: do not inspect.

Text collection excludes image identifiers, so media metadata is not sent to `msgSecCheck`.

## Result and Error Semantics

Text v2 behavior:

- `result.suggest === 'pass'`: continue.
- `result.suggest === 'risky'` or `'review'`: throw `ERR_CONTENT_RISKY`.
- Missing/unknown result, thrown API error, or non-zero API error: throw `ERR_CONTENT_SECURITY_UNAVAILABLE`.

Synchronous image behavior:

- Successful `imgSecCheck`: continue.
- A WeChat content-risk error code: throw `ERR_CONTENT_RISKY`.
- Transport, download, quota, or unknown errors: throw `ERR_CONTENT_SECURITY_UNAVAILABLE`.

The cloud function response wrapper returns only the business code and safe message. The client error map is authoritative:

- `ERR_CONTENT_RISKY` -> `所发布内容含违规信息`
- `ERR_CONTENT_SECURITY_UNAVAILABLE` -> `发布失败，请稍后重试`

No raw label, strategy, suggestion, confidence, trace ID, or upstream message reaches the UI.

## Image Constraints

`wx.chooseMedia` requests compressed images. Before upload, the client uses `wx.getImageInfo` and rejects files above 1 MB or dimensions above 750 x 1334 pixels, matching the synchronous API limits. The cloud function still treats any unsupported image/API response as unavailable and does not write the item.

## Test Design

Tests use Node's built-in test runner and dependency-injected fakes:

1. Pure collector tests cover nested fields, arrays, system-field exclusion, trimming, deduplication, and empty input.
2. API adapter tests cover `pass`, `risky`, `review`, malformed results, thrown calls, image pass, image risk, and download failure.
3. Handler tests prove each person/event/item create/update invokes text inspection before CRUD.
4. Item tests prove image inspection occurs for create/new file ID and does not occur for unchanged/removal cases.
5. Client mapping tests prove the exact risky message and generic unavailable message.
6. CI validates all deployable copies, JavaScript syntax, OpenSpec structure, and the project build script.

## Deployment and Rollback

Deploy all three cloud functions before submitting the new mini-program build. Validate real-account access because `msgSecCheck` requires a recently active openid. Rollback restores the previous cloud-function and mini-program versions together; there is no data migration.

## Future Migration

Move images to `security.mediaCheckAsync` v2 only with a separate design that adds pending publication, a message-push receiver, trace-ID correlation, pass/risky state transitions, timeout handling, and storage cleanup.
