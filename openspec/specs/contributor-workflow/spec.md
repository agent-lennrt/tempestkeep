# Contributor workflow

## Purpose

Keep implementation changes reviewable through deterministic checks, explicit
compatibility decisions, and instructions that contributors can reproduce.

## Requirements

### Requirement: Pure-Go production build

The application MUST build with CGO_ENABLED=0 without requiring a Node.js runtime.

#### Scenario: A contributor builds the command

- **WHEN** the contributor runs the documented Go build with CGO disabled
- **THEN** the command builds without installing JavaScript packages

### Requirement: Deterministic default tests

Default tests MUST use synthetic data and MUST NOT require a WeatherFlow token.

#### Scenario: Tests run without network credentials

- **WHEN** a contributor runs the standard test command without a token
- **THEN** API tests use local fixtures and return within the test timeout

### Requirement: Compatibility records

Changes to public APIs, wire fields, storage, security boundaries, or configuration
meaning MUST include an ADR and relevant regression tests.

#### Scenario: A change affects archive metadata semantics

- **WHEN** a contributor changes the meaning of a stored cursor
- **THEN** the review includes compatibility guidance and restart regressions

### Requirement: Consistent Go patch toolchain

The module, repository verification, CI, release qualification, and active build
instructions MUST use Go 1.27.2. Repository verification MUST reject a different
Go patch version. Historical evidence MUST NOT attribute older test runs to the
newly pinned toolchain.

#### Scenario: A contributor verifies with the required patch

- **WHEN** the selected Go toolchain reports go1.27.2
- **THEN** the version guard permits repository verification to continue

#### Scenario: A contributor verifies with a different patch

- **WHEN** the selected Go toolchain reports a version other than go1.27.2
- **THEN** the version guard fails before running the verification suite

#### Scenario: A maintainer updates the active toolchain pin

- **WHEN** a dated test record predates the patch upgrade
- **THEN** the record identifies its results as historical rather than results for the new patch
