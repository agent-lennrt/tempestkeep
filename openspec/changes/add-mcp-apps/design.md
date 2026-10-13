# Design

## Context

The server already exposes typed live-weather and archive tools over stdio.
The existing tool handlers own data access, units, limits, and cancellation.
The frontend renders those results and does not gain direct access to SQLite
or the WeatherFlow API.

## Decisions

Use the MCP Apps resource association, `_meta.ui.resourceUri`, on registered
read-only tools when the client advertises the `io.modelcontextprotocol/ui`
extension with `text/html;profile=mcp-app` in its supported MIME types.
Give each association a fixed `ui://tempestkeep/<tool-name>.html`
resource with MIME type `text/html;profile=mcp-app`. Reuse one embedded frontend
bundle with a fixed tool identity for each resource. Serve only known registered
resources. Existing resource discovery for archive schema and dictionary remains.

Bundle the official `@modelcontextprotocol/ext-apps` SDK with the frontend.
Connect to the host through the SDK before accepting tool notifications. Receive
tool inputs and results, react to host theme changes, and send refresh requests
through that connection. If the host denies tool calls, report the unavailable
action without attempting another transport.

Refresh only the associated read-only tool using its current arguments. Exclude
archive write tools from app associations and app controls. Disable overlapping
refreshes and retain explicit loading and failure states. Ordinary MCP callers
still receive the original content and structured result.

Use charts for supported weather series and generic tables or detail views for
other structured results. Search, sort, and page only the received rows. Preserve
numeric sorting, missing values, server truncation, source, and units. Limit
each table display to 2,000 rows and 64 columns and show a notice when this
omits data. An absent measurement must not become zero or a fabricated chart point. Use semantic
controls, visible focus, responsive layouts, and host-compatible light/dark themes.

Treat labels, SQL cells, API values, and errors as untrusted text. Do not parse
them as HTML. Ship scripts, styles, and visual assets in the same HTML resource.
Declare no external CSP connection or resource origins and request no device
permissions. The host owns iframe sandboxing and permission decisions.

Commit the generated bundle and the lockfile. Add reproducible build and browser
test commands with Node.js development tooling. Continue to build the production
Go binary directly, including with `CGO_ENABLED=0`, without frontend build tools.

## Ownership and failure behavior

The Go server owns its embedded resource bytes and the existing API/database
handles. The host owns the app's sandbox and routes requests to the server.
The app owns only transient display state. Refresh sends no credentials.
No app action creates an archive, collects history, or installs a background job.

Unknown resources fail through MCP. Missing or malformed results, empty datasets,
failed refreshes, and unavailable host capabilities have visible states. Keep
server query, row, byte, and time limits unchanged. Surface truncation so users
do not mistake a filtered page for the full archive.

## Compatibility and migration

Clients that do not advertise the extension retain their ordinary tool metadata
and results. Resources remain discoverable for inspection.
Tool names, schemas, annotations, and structured payloads stay stable. Configured
capabilities still decide which tools and associated UI resources exist. No
archive or configuration migration is required. The terminal UI stays available.

Propose 0.3.0 as a minor feature version, with no tag or release publication.
Retain this proposal during review even though the baseline MCP specification
also records the full app contract. Archive only after acceptance and completion.
Since the baseline already contains these added requirements, use
`npm run openspec -- archive add-mcp-apps --skip-specs` to avoid applying them
twice. Then run strict validation again.

## Toolchain qualification

Pin Go 1.27.2 across the module, repository checks, CI, release qualification,
and current instructions. Keep historical test results tied to their original
run instead of attributing them to the new patch. Run the normal checks and
vulnerability scan with Go 1.27.2 and record the actual result. See
[ADR 0007](../../../docs/adr/0007-go-patch-toolchain.md).
Use golangci-lint v2.14.0 to read the patched compiler's export data while
retaining the existing enabled checks.

## Validation

Protocol tests cover discovery and resources over real MCP transports, capability
combinations, unknown URIs, unchanged structured results, and write-tool exclusion.
Browser tests use the SDK bridge, deterministic fixtures, and finite timeouts.
They cover interactive tables, charts, themes, refresh, hostile text, missing
data, failures, and narrow viewports. Screenshot generation uses the same bundle
and synthetic test host, without a live token or personal station data.

Run `npm run app:build`, `npm run app:test`, `npm run spec:check`, and the
applicable repository Go and documentation checks. Record unavailable checks
as limitations. Actual third-party harness compatibility requires a separate
session in that host and is not implied by synthetic screenshots.
