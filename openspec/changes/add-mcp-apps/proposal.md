# Add MCP Apps

## Why

Weather series and large tables are difficult to explore as chat text alone.
Users need interactive results in their MCP client without opening the separate
terminal dashboard or running another service.

## What Changes

- Associate registered read-only tools with embedded MCP Apps HTML resources.
- Show weather charts and searchable, sortable, paginated tables inside supporting hosts.
- Refresh a view through its existing read-only tool and the host's MCP Apps bridge.
- Preserve tool payloads, annotations, capability gating, archive limits, and plain MCP use.
- Document setup, host compatibility, privacy, and reproducible synthetic previews.
- Propose version 0.3.0 and update development and plugin version metadata.
- Pin Go 1.27.2 across builds, verification, CI, and active instructions.

## Capabilities

### New Capabilities

None. MCP Apps extends the existing MCP service.

### Modified Capabilities

- `mcp-service`: app discovery, embedded resources, interactive read-only views,
  host-mediated refresh, result fidelity, and the browser security boundary.
- `contributor-workflow`: use one Go patch version for builds and qualification.

## Impact

MCP tool discovery gains app metadata and resource discovery gains HTML resources.
Original tool schemas and results remain stable. Existing MCP clients can ignore
the extension. Archive storage, configuration, and terminal operation do not change.

The frontend uses pinned Node.js development dependencies. Its committed bundle
is embedded in Go, so the application needs no Node.js runtime or local web server.
The [ADR](../../../docs/adr/0006-mcp-apps.md) records the protocol and security
decisions. The baseline service specification also includes the new requirements.
The [toolchain ADR](../../../docs/adr/0007-go-patch-toolchain.md) records the
Go 1.27.2 upgrade. Keep this proposal active while the pull request is under review.
