# Tasks

## 1. Protocol and resources

- [x] 1.1 Add read-only app associations and capability-matched resources, then pass MCP
  discovery and resource tests.
- [x] 1.2 Preserve original results, annotations, and write-tool boundaries, then pass MCP
  compatibility tests.
- [x] 1.3 Embed the self-contained bundle and restrictive resource metadata, then pass
  resource and pure-Go build checks.

## 2. Interactive views

- [x] 2.1 Add SDK initialization, result handling, refresh, and themes, then pass `npm run
  app:test` lifecycle tests.
- [x] 2.2 Add charts and searchable, sortable, paginated tables, then pass `npm run app:test`
  interaction tests.
- [x] 2.3 Cover empty, null, error, truncation, hostile-text, and narrow-view cases with `npm
  run app:test`.
- [x] 2.4 Rebuild the committed bundle with `npm run app:build` and confirm that no asset
  drift remains.

## 3. Documentation and version

- [x] 3.1 Update the README, MCP guide, architecture, and threat model, then pass `make docs-check`.
- [x] 3.2 Add the proposed ADR and baseline/change scenarios, then pass `npm run spec:check`.
- [x] 3.3 Propose 0.3.0 consistently in version metadata and release notes, then pass version tests.
- [x] 3.4 Capture Playwright weather and table screenshots with synthetic fixtures and inspect
  both images.

## 4. Review evidence

- [x] 4.1 Run applicable Go, browser, dependency, and repository checks and record exact
  results and limitations.
- [x] 4.2 Review compatibility, security, generated assets, and the complete diff, then
  resolve confirmed findings.
- [x] 4.3 Open the pull request with screenshot links, the proposed version, and verification
  evidence: [pull request #7](https://github.com/lennrt/tempestkeep/pull/7).

## 5. Go security patch

- [x] 5.1 Pin Go 1.27.2 in the module, Makefile, and every Go-based workflow.
- [x] 5.2 Align contributor and release guidance, validate the specifications, and
  pass `make verify` with the patched toolchain, including `make vuln`.
- [x] 5.3 Update golangci-lint to v2.14.0 for the patched compiler's export data
  and pass the existing lint configuration without disabling checks.

## Verification evidence

- On 2026-10-12, full `make verify` passed with Go 1.27.2 and golangci-lint
  v2.14.0, including `make vuln` with no vulnerabilities found. All eight
  workflow Go pins match the module and Makefile. `make check-go` also rejected
  the older locally installed toolchain when automatic selection was disabled.
- `npm run spec:check` passed all six baseline/change items after the toolchain
  requirements were added.
- Initial checks with the then-pinned Go toolchain: module verification,
  formatting, docs, tidy, vet, standard tests, race tests, all four fuzz targets,
  lint, workflow syntax, and public API checks passed.
- `make licenses sbom secrets build-pure build-arm64` passed.
- `make demo-smoke integration e2e docs-check` passed after updating the demo's
  discovery count to include the 27 new UI resources.
- `npm run app:check` passed; `npm run app:test` passed all 21 browser checks.
- `npm run app:screenshots` passed. Weather and table images were visually reviewed;
  narrow weather, table, and wind views were also inspected at 390 pixels.
- `npm run spec:check` passed all six baseline/change items.
- Initial `make verify` stopped at `make vuln`: nine reachable Go standard-library advisories
  in the repository's previous toolchain. A pristine `origin/main` scan produced
  byte-identical findings. All nine reported Go 1.27.2 as fixed. The remaining
  verification targets were run separately as recorded above. The full patched
  run now passes, as recorded at the start of this section.
- `npm audit` reports the existing OpenSpec / fast-glob / micromatch / braces chain
  for [GHSA-vfj7-8cjw-p6xm][braces]. No added frontend dependency is flagged.
- Browser checks use the official AppBridge with synthetic data in a sandbox.
  They do not certify a specific third-party harness or use real station credentials.

[braces]: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
