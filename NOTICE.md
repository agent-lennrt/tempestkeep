# Affiliation notice

TempestKeep is an independent project. It is not affiliated with, endorsed by,
or sponsored by WeatherFlow or the Tempest weather platform.

WeatherFlow and Tempest names and marks belong to their respective owners. Use
of those names identifies compatible services and products. It does not imply
an official relationship.

## Embedded frontend dependencies

The MCP Apps HTML bundle includes third-party JavaScript. Its
[generated source](internal/mcpapp/ui/app.html) retains the bundled packages'
license and notice text in an HTML comment. The
[asset builder](scripts/build-mcp-app.mjs) collects those texts from the pinned
dependencies. Rebuilding the app updates its code and notices together.
