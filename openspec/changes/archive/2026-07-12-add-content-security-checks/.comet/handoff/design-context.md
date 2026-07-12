# Comet Design Handoff

- Change: add-content-security-checks
- Phase: design
- Mode: compact
- Context hash: f8fece667d5241e4cf7816cdbef37450b1da064a009d8e278eb9d980107b7395

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/add-content-security-checks/proposal.md

- Source: openspec/changes/add-content-security-checks/proposal.md
- Lines: 1-28
- SHA256: eae79d801a8fcdfd41d4bc425ff0f3ed474923d092255d55bdc529f84a7966b2

```md
## Why

The person, event, and item publishing paths do not call WeChat content-security APIs. The item-image capability failed review because unsafe user-generated content can currently be persisted without server-side inspection.

## What Changes

- Check user-authored text with WeChat content-security APIs before person, event, or item create/update writes.
- Check a new or replacement item cover image before the item write.
- Return a dedicated business error for risky content and show only `所发布内容含违规信息` to the user.
- Fail closed when a security API is unavailable or returns an invalid response.
- Package the security helper inside each independently deployed cloud function and add automated coverage.

## Capabilities

### New Capabilities

- `content-security`: Server-side inspection, failure behavior, and user-facing disclosure rules for entity text and item images in every publishing path.

### Modified Capabilities

None.

## Impact

- Cloud functions: `person`, `event`, `item`, and their local `common/` copies.
- Mini program: create/edit error handling and image upload constraints.
- External APIs: WeChat `security.msgSecCheck` and image security inspection.
- Database schemas, collection names, page paths, and cloud-function names remain unchanged.

```

## openspec/changes/add-content-security-checks/design.md

- Source: openspec/changes/add-content-security-checks/design.md
- Lines: 1-64
- SHA256: d76338b79c106a2abb67f8029d3a09f646cfe29ba5d005f8ea82c4f9b3fd9493

```md
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

```

## openspec/changes/add-content-security-checks/tasks.md

- Source: openspec/changes/add-content-security-checks/tasks.md
- Lines: 1-19
- SHA256: 401792aacc73259e8d9365f70feea806cecd80809acdc43f7c24128e2769eec9

```md
## 1. Content-security core

- [ ] 1.1 Add failing tests for text collection, WeChat result classification, and business-error mapping.
- [ ] 1.2 Implement text and image inspection helpers and synchronize the three deployable copies.

## 2. Publishing-path integration

- [ ] 2.1 Use TDD to integrate text inspection into person, event, and item create/update paths.
- [ ] 2.2 Use TDD to integrate image inspection into new and replacement item-image paths.

## 3. Mini-program behavior

- [ ] 3.1 Add content-security business errors and map risky content only to `所发布内容含违规信息`.
- [ ] 3.2 Add image compression and size validation before upload.

## 4. Verification

- [ ] 4.1 Extend CI to verify helper presence and equality in all three cloud-function packages.
- [ ] 4.2 Run focused tests and `bash scripts/ci-build.sh`, then audit every change-spec scenario.

```

## openspec/changes/add-content-security-checks/specs/content-security/spec.md

- Source: openspec/changes/add-content-security-checks/specs/content-security/spec.md
- Lines: 1-57
- SHA256: e3d7c593296ee79eb7e6dc4df4e4ca83b9fb6a518c0709de7615f31c359c5b5e

```md
## ADDED Requirements

### Requirement: Inspect entity text before every publication
The system SHALL inspect all user-authored text submitted by `person`, `event`, and `item` create/update operations with WeChat `security.msgSecCheck` before a database write, using the current user's openid, `version: 2`, and the configured publishing scene.

#### Scenario: Create text passes inspection
- **WHEN** a user creates a person, event, or item and WeChat returns `suggest: pass`
- **THEN** the system writes the entity and returns success

#### Scenario: Update text passes inspection
- **WHEN** a user updates a person, event, or item and WeChat returns `suggest: pass` for the submitted text
- **THEN** the system updates the entity and returns success

#### Scenario: Text is risky or requires review
- **WHEN** WeChat returns `suggest: risky` or `suggest: review`
- **THEN** the system SHALL block the database write and return the risky-content business error

#### Scenario: Text inspection is unavailable
- **WHEN** the WeChat text API fails or returns an invalid response
- **THEN** the system SHALL block the database write and return a generic publication-failure business error

### Requirement: Inspect item images before publication
The system SHALL inspect an item image server-side before persisting a new or replacement `coverImage.fileID`; an update that does not add or replace the image SHALL NOT recheck the existing image.

#### Scenario: New item image passes inspection
- **WHEN** a user creates an item with a cover image and image inspection passes
- **THEN** the system persists the item with `coverImage`

#### Scenario: Replacement item image passes inspection
- **WHEN** a user updates an item with a new `coverImage.fileID` and image inspection passes
- **THEN** the system updates the item image

#### Scenario: Item image is risky
- **WHEN** WeChat image inspection identifies risky content
- **THEN** the system SHALL block the database write and return the risky-content business error

#### Scenario: Image inspection is unavailable
- **WHEN** the WeChat image API fails or returns an invalid response
- **THEN** the system SHALL block the database write and return a generic publication-failure business error

### Requirement: Do not disclose content-security details
The system MUST map every risky-content result to the fixed user message `所发布内容含违规信息` and MUST NOT return or display labels, risk levels, strategies, suggestions, or raw WeChat results.

#### Scenario: Client receives a risky-content error
- **WHEN** any publishing entry point receives the risky-content business error
- **THEN** the mini program displays only `所发布内容含违规信息`

### Requirement: Make inspection non-bypassable and deployable
The system SHALL enforce inspection in the business cloud-function write paths and keep frontend writes behind `wx.cloud.callFunction`; every deployed cloud-function package MUST contain its content-security dependency.

#### Scenario: Any create or edit entry point publishes content
- **WHEN** the capture page or detail edit page submits person, event, or item content
- **THEN** the request reaches the corresponding cloud function's common pre-write inspection path

#### Scenario: Deploy a cloud function independently
- **WHEN** `person`, `event`, or `item` is deployed from its own directory
- **THEN** the package contains every `common` module required for content-security inspection

```
