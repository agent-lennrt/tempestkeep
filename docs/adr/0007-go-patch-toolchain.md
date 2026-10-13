# ADR 0007: Pin Go 1.27.2 for builds and qualification

## Status

Proposed in pull request #7 on 2026-10-12. This supersedes only the Go patch
version in [ADR 0001](0001-modern-go-engineering-baseline.md) and the linter pin
in [ADR 0003](0003-openssf-security-baseline.md).

## Context

The MCP Apps verification run reported standard-library vulnerabilities in the
previously pinned Go toolchain. The repository needs a consistent patch update
across local builds, required checks, CI, release qualification, and instructions.

## Decision

Pin Go 1.27.2 in the module, Makefile, CI workflows, and active documentation.
Keep the exact-version guard so local verification uses the same patch as CI.
Require the normal repository checks and vulnerability scan with that toolchain.
Record their actual results in the pull request and active change evidence.

Pin golangci-lint v2.14.0. The previous v2.13.2 fails to read Go 1.27.2 compiler
export data (version 5 exceeds its supported version 4). The updated linter
includes a newer Go tools dependency and passes the existing configuration
without disabling any checks.

Keep dated test records accurate. A past run with the previous toolchain remains
historical evidence and does not establish results for Go 1.27.2. Keep the
existing rule that missing prerequisites and failed checks do not count as passes.

## Compatibility

The minimum Go patch version increases to 1.27.2. Contributors and CI must use
that version for repository verification. The update adds no application API,
MCP schema, archive, configuration, or command change. The proposed application
version stays 0.3.0. This change does not tag or publish a release.

## Validation

Run `make verify` with Go 1.27.2, including `make vuln`. Run the frontend and
OpenSpec checks as required by the active MCP Apps change. Inspect every active
toolchain pin and record remaining historical references as historical evidence.
Do not infer a passing vulnerability scan from the version change alone.
