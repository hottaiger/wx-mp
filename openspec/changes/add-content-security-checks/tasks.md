## 1. Content-security core

- [x] 1.1 Add failing tests for text collection, WeChat result classification, and business-error mapping.
- [x] 1.2 Implement text and image inspection helpers and synchronize the three deployable copies.

## 2. Publishing-path integration

- [x] 2.1 Use TDD to integrate text inspection into person, event, and item create/update paths.
- [x] 2.2 Use TDD to integrate image inspection into new and replacement item-image paths.

## 3. Mini-program behavior

- [x] 3.1 Add content-security business errors and map risky content only to `所发布内容含违规信息`.
- [x] 3.2 Add image compression and size validation before upload.

## 4. Verification

- [ ] 4.1 Extend CI to verify helper presence and equality in all three cloud-function packages.
- [ ] 4.2 Run focused tests and `bash scripts/ci-build.sh`, then audit every change-spec scenario.
