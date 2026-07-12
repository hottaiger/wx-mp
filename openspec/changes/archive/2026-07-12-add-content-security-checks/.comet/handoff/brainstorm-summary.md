# Brainstorm Summary

- Change: add-content-security-checks
- Date: 2026-07-12

## Confirmed Technical Approach

Enforce content inspection inside each business cloud function immediately before `crud.create` or `crud.update`. Normalize and inspect user-authored text with `security.msgSecCheck` v2. For a new or replacement item image, download its cloud file and use synchronous `security.imgSecCheck` with the documented `{ contentType, value }` media object so the decision is available before persistence. Map results to stable business errors and keep identical helper copies in each independently deployed function.

Alternatives considered:

1. Frontend preflight checks: rejected because callers can bypass them.
2. `security.mediaCheckAsync` v2 with a pending-review state: technically current but requires a message receiver, callback correlation, pending-publication schema, and UI states outside this review fix.
3. Server-side synchronous enforcement: selected because it is the only scoped option that guarantees no database write before an image decision.

## Key Trade-offs and Risks

- The synchronous image API is v1 and no longer updated; migrate to v2 when a review-state workflow is introduced.
- API quota or network failures block publication by design.
- Recursive text collection excludes system fields but intentionally favors over-inspection over missed user content.
- Images are compressed and checked against the documented 1 MB and 750 x 1334 limits before upload.

## Test Strategy

- Unit-test text normalization and result classification as pure functions.
- Test every create/update handler with injected WeChat and CRUD dependencies, proving inspection runs before writes.
- Test image checks only for new/replacement file IDs.
- Test risky results and API failures never call CRUD.
- Test frontend business-error mapping exposes only the fixed Chinese message.
- Verify deployable helper copies and run `bash scripts/ci-build.sh`.

## Spec Patch

None.
