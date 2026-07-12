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
