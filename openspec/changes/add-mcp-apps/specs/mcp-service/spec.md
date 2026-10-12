## ADDED Requirements

### Requirement: Read-only MCP Apps discovery

For clients that advertise the `io.modelcontextprotocol/ui` extension with
`text/html;profile=mcp-app` MIME support, each registered read-only tool MUST
declare `_meta.ui.resourceUri` for its `ui://tempestkeep/<tool-name>.html` resource. The
resource MUST use
MIME type `text/html;profile=mcp-app`. UI resources MUST follow the same
capability rules as their associated tools and remain readable without host UI
support. Write tools MUST NOT declare an app.

#### Scenario: An archive opens without live access

- **WHEN** an app-capable client lists tools and resources for an archive-only server
- **THEN** archive read tools have readable UI resources and unavailable live-only tools have none

#### Scenario: A writable server lists archive collection tools

- **WHEN** backfill_archive and sync_archive are available
- **THEN** neither tool has an MCP Apps resource association

#### Scenario: A client requests an unknown app resource

- **WHEN** resources/read names an unregistered UI URI
- **THEN** the server returns an MCP error instead of arbitrary files or HTML

### Requirement: Plain MCP compatibility

MCP Apps MUST preserve tool names, input schemas, structured results, ordinary
content, annotations, and existing capability gates. Clients without app support
MUST remain able to call the same tools and read their results.

#### Scenario: A client does not support MCP Apps

- **WHEN** the client calls an available weather or archive tool
- **THEN** it receives the existing ordinary content and structured result without app tool metadata

### Requirement: Interactive data fidelity

The app MUST render supported weather series as charts and tabular results as
searchable, sortable, paginated tables. It MUST preserve units, source labels,
server truncation notices, and the distinction between missing readings and zero.
Client-side interactions MUST operate only on received results and MUST NOT
claim to search or page the entire archive. The display MUST limit each table
to 2,000 rows and 64 columns, with a visible notice when it omits data.

#### Scenario: A table contains numbers, nulls, and a valid zero

- **WHEN** a user sorts a numeric column
- **THEN** values sort numerically and missing values remain distinct from zero

#### Scenario: The server truncates a query result

- **WHEN** a user searches or pages the displayed rows
- **THEN** the view keeps a visible truncation notice and does not imply complete archive coverage

#### Scenario: A weather measurement is missing

- **WHEN** the app plots the series
- **THEN** it does not create a zero-valued observation for that missing measurement

#### Scenario: A SQL result has more than 64 columns

- **WHEN** the app displays the returned table
- **THEN** it shows at most 64 columns and a display-limit notice without changing the
  original tool result

### Requirement: Host-mediated read-only interaction

The app MUST use the MCP Apps SDK lifecycle and receive data through the host.
Refresh MUST call only the associated read-only tool with the received arguments.
The app MUST handle host theme changes, loading, empty results, and failed calls.
It MUST NOT invoke archive write tools or access credentials or the archive directly.

#### Scenario: A user refreshes a history view

- **WHEN** the host permits app tool calls
- **THEN** the app requests its associated tool through the host with the current arguments

#### Scenario: The host rejects refresh

- **WHEN** a refresh request fails or the required capability is unavailable
- **THEN** the view reports failure without a direct API request or archive write

#### Scenario: The host changes its theme

- **WHEN** the app receives the updated host context
- **THEN** its display follows that theme without another weather query

### Requirement: Self-contained untrusted-data display

The Go binary MUST embed the app HTML, styles, and scripts. Running or building
the Go application MUST NOT require Node.js or a separate frontend service.
The app MUST request no external CSP connection or resource origins and no
device permissions. It MUST render untrusted tool values as text, not executable HTML.

#### Scenario: A SQL cell contains script-like text

- **WHEN** the app displays that cell
- **THEN** the text is visible without executing code or making an external request

#### Scenario: The host reads an app resource offline

- **WHEN** the server has an existing archive and no live API credentials
- **THEN** the resource contains the assets needed to display its archive results
