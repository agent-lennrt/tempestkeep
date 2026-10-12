package mcpapp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/lennrt/tempestkeep/pkg/tempest/api"
	"github.com/lennrt/tempestkeep/pkg/tempest/store"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func appsClientCapabilities() *mcp.ClientCapabilities {
	return &mcp.ClientCapabilities{Extensions: map[string]any{
		appExtension: map[string]any{"mimeTypes": []string{appMIMEType}},
	}}
}

func connectAppsClient(t *testing.T, ctx context.Context, srv *mcp.Server, capabilities *mcp.ClientCapabilities) *mcp.ClientSession {
	t.Helper()
	clientTransport, serverTransport := mcp.NewInMemoryTransports()
	serverSession, err := srv.Connect(ctx, serverTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	closeOnCleanup(t, serverSession)
	client := mcp.NewClient(&mcp.Implementation{Name: "apps-test", Version: "0"}, &mcp.ClientOptions{Capabilities: capabilities})
	session, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	closeOnCleanup(t, session)
	return session
}

// Exercise every source configuration through the wire, including capabilities
// negotiated at initialization and copied into the current protocol's requests.
func TestAppsRegistrationAndResources(t *testing.T) {
	t.Parallel()
	var requests atomic.Int32
	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(apiServer.Close)
	client, err := api.New("synthetic-test-token", api.WithBaseURL(apiServer.URL))
	if err != nil {
		t.Fatal(err)
	}

	for _, source := range []struct {
		name                    string
		live, archive, writable bool
		readTools               int
	}{
		{name: "live", live: true, readTools: 4},
		{name: "archive", archive: true, readTools: 24},
		{name: "live and read-only archive", live: true, archive: true, readTools: 27},
		{name: "live and writable archive", live: true, archive: true, writable: true, readTools: 27},
	} {
		t.Run(source.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
			defer cancel()
			srv := mcp.NewServer(&mcp.Implementation{Name: "tempestkeep-test", Version: "0"}, nil)
			var live *liveSource
			if source.live {
				live = &liveSource{client: client}
			}
			var st *store.Store
			var writer *store.Writer
			if source.archive {
				path := filepath.Join(t.TempDir(), "archive.sqlite")
				writer, err = store.OpenWriter(ctx, path)
				if err != nil {
					t.Fatal(err)
				}
				closeOnCleanup(t, writer)
				st, err = store.Open(ctx, path)
				if err != nil {
					t.Fatal(err)
				}
				closeOnCleanup(t, st)
			}
			registerTools(srv, live, st)
			if source.writable {
				registerArchiveTools(srv, live, writer)
			}
			cs := connectAppsClient(t, ctx, srv, appsClientCapabilities())
			listed, err := cs.ListTools(ctx, nil)
			if err != nil {
				t.Fatal(err)
			}
			resources, err := cs.ListResources(ctx, nil)
			if err != nil {
				t.Fatal(err)
			}
			views := make(map[string]*mcp.Resource)
			for _, resource := range resources.Resources {
				if strings.HasPrefix(resource.URI, "ui://") {
					views[resource.URI] = resource
				}
			}
			if len(views) != source.readTools {
				t.Fatalf("UI resources = %d, want %d", len(views), source.readTools)
			}
			readTools, writeTools := 0, 0
			for _, tool := range listed.Tools {
				ui, hasUI := tool.Meta["ui"].(map[string]any)
				if tool.Name == "sync_archive" || tool.Name == "backfill_archive" {
					writeTools++
					if hasUI || tool.Annotations.ReadOnlyHint {
						t.Errorf("write tool %s gained a UI or read-only annotation", tool.Name)
					}
					continue
				}
				readTools++
				uri := "ui://tempestkeep/" + tool.Name + ".html"
				if !hasUI || ui["resourceUri"] != uri {
					t.Errorf("tool %s UI = %#v, want %s", tool.Name, tool.Meta, uri)
				}
				if tool.Annotations == nil || !tool.Annotations.ReadOnlyHint || tool.InputSchema == nil || tool.OutputSchema == nil {
					t.Errorf("tool %s lost annotations or typed schemas", tool.Name)
				}
				resource := views[uri]
				if resource == nil {
					t.Fatalf("tool %s references an unlisted resource", tool.Name)
				}
				if resource.MIMEType != appMIMEType {
					t.Errorf("resource %s MIME = %q", uri, resource.MIMEType)
				}
				checkAppResourceMeta(t, resource.Meta)
				read, err := cs.ReadResource(ctx, &mcp.ReadResourceParams{URI: uri})
				if err != nil || len(read.Contents) != 1 {
					t.Fatalf("read %s = %#v, %v", uri, read, err)
				}
				content := read.Contents[0]
				if content.URI != uri || content.MIMEType != appMIMEType || int64(len(content.Text)) != resource.Size {
					t.Errorf("resource %s contents disagree with its listing", uri)
				}
				if !strings.Contains(strings.ToLower(content.Text), "<!doctype html>") || !strings.Contains(content.Text, `data-tool="`+tool.Name+`"`) || strings.Contains(content.Text, "__TEMPESTKEEP_TOOL__") {
					t.Errorf("resource %s is not a specialized HTML document", uri)
				}
				checkAppResourceMeta(t, content.Meta)
			}
			if readTools != source.readTools || (writeTools == 2) != source.writable {
				t.Errorf("got %d read and %d write tools", readTools, writeTools)
			}
			for _, uri := range []string{"ui://tempestkeep/missing.html", "ui://tempestkeep/../app.html", "ui://tempestkeep/sync_archive.html"} {
				if _, err := cs.ReadResource(ctx, &mcp.ReadResourceParams{URI: uri}); err == nil {
					t.Errorf("read accepted unregistered resource %s", uri)
				}
			}
			if !source.live {
				if _, err := cs.ReadResource(ctx, &mcp.ReadResourceParams{URI: "ui://tempestkeep/forecast.html"}); err == nil {
					t.Error("archive-only server exposed a live view")
				}
			}
			if !source.archive {
				if _, err := cs.ReadResource(ctx, &mcp.ReadResourceParams{URI: "ui://tempestkeep/archive_status.html"}); err == nil {
					t.Error("live-only server exposed an archive view")
				}
			}
		})
	}
	if requests.Load() != 0 {
		t.Error("UI registration or resource reads contacted the weather API")
	}
}

func checkAppResourceMeta(t *testing.T, meta mcp.Meta) {
	t.Helper()
	// Pin the security boundary independently of the metadata builder.
	want := mcp.Meta{"ui": map[string]any{
		"csp": map[string]any{
			"connectDomains": []any{}, "resourceDomains": []any{},
			"frameDomains": []any{}, "baseUriDomains": []any{},
		},
		"permissions": map[string]any{}, "prefersBorder": true,
	}}
	if !reflect.DeepEqual(meta, want) {
		t.Errorf("resource security metadata = %#v, want %#v", meta, want)
	}
}

func TestAppsCapabilityFallbackKeepsToolResults(t *testing.T) {
	t.Parallel()
	ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
	defer cancel()
	st, err := store.Open(ctx, makeTestArchive(t))
	if err != nil {
		t.Fatal(err)
	}
	closeOnCleanup(t, st)
	srv := mcp.NewServer(&mcp.Implementation{Name: "tempestkeep-test", Version: "0"}, nil)
	registerTools(srv, nil, st)
	appClient := connectAppsClient(t, ctx, srv, appsClientCapabilities())
	appTools, err := appClient.ListTools(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	args := &mcp.CallToolParams{Name: "query_sql", Arguments: map[string]any{
		"sql": "SELECT epoch, air_temp_c, wind_avg FROM obs_st ORDER BY epoch",
	}}
	appResult, err := appClient.CallTool(ctx, args)
	if err != nil || appResult.IsError {
		t.Fatalf("app tool result = %#v, %v", appResult, err)
	}
	if len(appResult.Content) == 0 || appResult.StructuredContent == nil {
		t.Fatal("app result must keep meaningful text and structured content")
	}
	text, ok := appResult.Content[0].(*mcp.TextContent)
	if !ok || !strings.Contains(text.Text, "air_temp_c") {
		t.Fatal("text fallback lost query data")
	}
	for _, capabilities := range []*mcp.ClientCapabilities{
		nil, {},
		{Extensions: map[string]any{appExtension: map[string]any{}}},
		{Extensions: map[string]any{appExtension: map[string]any{"mimeTypes": []string{"text/html"}}}},
		{Extensions: map[string]any{appExtension: map[string]any{"mimeTypes": "text/html;profile=mcp-app"}}},
		{Experimental: map[string]any{appExtension: map[string]any{"mimeTypes": []string{appMIMEType}}}},
	} {
		cs := connectAppsClient(t, ctx, srv, capabilities)
		plainTools, err := cs.ListTools(ctx, nil)
		if err != nil {
			t.Fatal(err)
		}
		if len(plainTools.Tools) != len(appTools.Tools) {
			t.Fatal("text fallback changed tool availability")
		}
		for i, plain := range plainTools.Tools {
			if _, ok := plain.Meta["ui"]; ok {
				t.Errorf("UI metadata advertised without compatible capability: %#v", capabilities)
			}
			app := *appTools.Tools[i]
			app.Meta = nil
			if !reflect.DeepEqual(plain, &app) {
				t.Errorf("text fallback changed definition of %s", plain.Name)
			}
		}
		result, err := cs.CallTool(ctx, args)
		if err != nil || !reflect.DeepEqual(result, appResult) {
			t.Errorf("text fallback changed tool result: %#v, %v", result, err)
		}
		// Parallel listings must never strip the shared registered metadata.
		var wg sync.WaitGroup
		for _, session := range []*mcp.ClientSession{cs, appClient} {
			wg.Go(func() {
				listed, err := session.ListTools(ctx, nil)
				if err != nil {
					t.Error(err)
					return
				}
				for _, tool := range listed.Tools {
					_, hasUI := tool.Meta["ui"]
					if hasUI != (session == appClient) {
						t.Errorf("concurrent listing leaked capabilities for %s", tool.Name)
					}
				}
			})
		}
		wg.Wait()
	}
}

func TestSupportsApps(t *testing.T) {
	for _, settings := range []any{nil, "bad", true, map[string]any{"mimeTypes": nil}, map[string]any{"mimeTypes": []any{42, map[string]any{}, "text/html"}}} {
		if supportsApps(&mcp.ClientCapabilities{Extensions: map[string]any{appExtension: settings}}) {
			t.Errorf("accepted malformed/unsupported UI capability %#v", settings)
		}
	}
	if supportsApps(nil) || !supportsApps(appsClientCapabilities()) || !supportsApps(&mcp.ClientCapabilities{Extensions: map[string]any{
		appExtension: map[string]any{"mimeTypes": []any{"other", appMIMEType}},
	}}) {
		t.Fatal("UI capability negotiation did not recognize supported MIME types")
	}
}
