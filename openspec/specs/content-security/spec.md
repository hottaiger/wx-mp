# content-security Specification

## Purpose
TBD - created by archiving change add-content-security-checks. Update Purpose after archive.
## Requirements
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
