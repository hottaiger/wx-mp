## Context

The `person`, `event`, and `item` cloud functions currently call `crud.create` and `crud.update` directly after parameter validation. An item image is uploaded to cloud storage first, then its `coverImage.fileID` is persisted by the `item` function. No publishing path currently invokes WeChat content-security APIs.

WeChat's current text API is `security.msgSecCheck` v2. The v2 multimedia API, `security.mediaCheckAsync`, produces its decision through a later message push. This release requires a decision before the database write and explicitly excludes a pending-review schema and callback server, so image inspection uses the still-callable synchronous `security.imgSecCheck`. A future review-state implementation can migrate images to the asynchronous v2 API.

## Goals / Non-Goals

**Goals:**

- Cover every person, event, and item create/update text publishing path.
- Cover new and replacement item images.
- Enforce inspection at the server-side write boundary.
- Return a fixed risky-content message without leaking detection details.
- Fail closed when WeChat inspection is unavailable.
- Keep every cloud-function deployment package self-contained.

**Non-Goals:**

- No pending-review state, asynchronous result callback, or message receiver.
- No database schema, collection, page-path, or cloud-function rename.
- No inspection for reads, deletes, statistics, or relation queries.

## Decisions

### 1. Enforce inspection inside each business cloud function

`createEntity` and `updateEntity` inspect content after parameter validation and before calling `crud`. Frontend-only checks are not a security boundary and are not relied upon.

### 2. Normalize text and call `msgSecCheck`

A pure helper recursively collects user-authored strings and string arrays while excluding system fields such as `_id`, `_openid`, `fileID`, and `cloudPath`. It trims and deduplicates values, then calls `msgSecCheck` with `version: 2`, `scene: 1`, and the current `openid`. Only `suggest: pass` proceeds; `risky` and `review` are blocked.

### 3. Use synchronous image inspection at the write boundary

For a new or changed `coverImage.fileID`, the `item` function downloads the image Buffer with `cloud.downloadFile`, derives the MIME type from `coverImage.cloudPath`, and calls `cloud.openapi.security.imgSecCheck({ media: { contentType, value: buffer } })`. An unchanged image is not rechecked.

The asynchronous v2 API was considered but cannot provide a pre-write decision without introducing a callback endpoint and pending publication state, both outside the approved scope.

### 4. Separate risky content from service failure

Add `ERR_CONTENT_RISKY` and `ERR_CONTENT_SECURITY_UNAVAILABLE`. The former maps to `所发布内容含违规信息`; the latter maps to a generic publish-failure message. Raw WeChat `detail`, `label`, `suggest`, and exceptions never reach the client.

### 5. Preserve independent deployment packages

Implement `cloudfunctions/common/contentSecurity.js`, then keep identical copies under `person/common/`, `event/common/`, and `item/common/`. CI verifies presence and equality. No function imports from a parent directory.

## Risks / Trade-offs

- [The synchronous image API is v1 and no longer receives updates] -> Use it for the approved pre-write guarantee now; migrate to v2 when the product has a review-state callback flow.
- [Recursive collection may inspect non-visible strings] -> Exclude system fields and prefer over-inspection to missing user-authored content.
- [Quota or network failure prevents publication] -> Fail closed and show a generic publish-failure message.
- [Images may exceed the synchronous API limits] -> Request compressed selection and reject files above 1 MB or 750 x 1334 pixels before upload.

## Migration Plan

1. Deploy the updated `person`, `event`, and `item` functions with their local dependencies.
2. Upload the mini-program build and verify every create/edit entry point.
3. Exercise the real cloud environment before resubmitting for review.
4. Roll back cloud functions and mini-program code together if needed; no data migration is required.

## Open Questions

None for this release.
