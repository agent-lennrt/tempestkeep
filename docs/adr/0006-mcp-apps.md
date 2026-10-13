# ADR 0006: Embed read-only MCP Apps in the existing server

## Status

Proposed in the MCP Apps pull request. Version 0.3.0 is the proposed minor
release. This change does not publish a release or plugin.

## Context

TempestKeep returns structured weather and archive results over MCP. Large
tables and weather series need a visual view inside the user's MCP client.
Requiring the terminal dashboard interrupts that conversation and excludes
clients without access to the user's terminal.

The [MCP Apps extension][apps] lets a server associate an HTML resource with
a tool. The client, also called the host, renders that resource in a sandbox.
The existing typed tool results remain the source of data.

## Decision

Associate each registered read-only tool with a resource at
`ui://tempestkeep/<tool-name>.html` through `_meta.ui.resourceUri` when the client advertises
MCP Apps MIME support.
Serve the resource with MIME type `text/html;profile=mcp-app`.
Register resources according to the same live-client and archive capabilities
as their tools. Keep write tools without an app association.

Embed a self-contained HTML bundle in the Go executable. Use the official
`@modelcontextprotocol/ext-apps` SDK for initialization, tool notifications,
theme updates, and tool calls through the host. Pin development dependencies
and commit the generated bundle. Building or running Go does not require Node.js,
a local HTTP server, or a separate frontend process.

Render supported weather series as charts and tabular results as tables with
search, sorting, and pagination. Preserve labels, units, dates, missing readings,
and server truncation notices. Render untrusted result values as text. The view
must distinguish loading, empty results, failed calls, and valid zero readings.

Refresh repeats the associated read-only tool with its last supplied arguments.
The host mediates that call and can deny it. Do not expose controls for archive
backfill or sync. Keep query and result limits in the existing Go handlers.
Table search, sorting, and pagination operate on the returned rows only.

Request no external connection or resource origins in the app's content
security policy. Request no device permissions. Keep API credentials and archive
access in the Go server. The app receives tool inputs and results from the host,
so the host's handling of those data remains a privacy boundary.

Keep the active OpenSpec proposal available during review. The baseline MCP
specification also records these requirements so readers can find the complete
service contract without opening a proposal.

## Compatibility

This is an additive MCP change: supporting clients see app metadata in tool
discovery, and resource discovery gains HTML resources. Existing tool names, input schemas,
structured
result shapes, annotations, and capability rules remain unchanged. Clients
without MCP Apps support can continue to use ordinary tool results.

There is no public Go signature, archive schema, configuration, or TUI change.
Existing archives require no migration. Node.js dependencies apply only to
development checks and rebuilding the embedded frontend. The compiled Go
application remains compatible with `CGO_ENABLED=0`.

The proposed 0.3.0 version identifies a new user-facing feature. Keep the
development version, plugin manifest, and release notes consistent. Publication
still requires the separate procedure in [RELEASING.md](../../RELEASING.md).

## Validation

Use real MCP transports to test resource discovery, MIME type, tool metadata,
read-only annotations, unsupported resources, and every capability combination.
Assert that original structured results and write-tool boundaries remain intact.

Use Playwright with a local MCP Apps test host and synthetic fixtures. Exercise
the SDK lifecycle, refresh, theme updates, sorting, search, pagination, empty
states, failures, missing values, and hostile text. Capture weather and table
screenshots from the same embedded bundle. These previews do not certify a
specific third-party host.

Run documentation, strict OpenSpec, frontend build, frontend browser, and
applicable Go checks. Record exact results and unavailable prerequisites in
the pull request. Do not present screenshots as proof of server correctness.

[apps]: https://modelcontextprotocol.io/extensions/apps/overview
