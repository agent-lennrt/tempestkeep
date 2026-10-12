package mcpapp

import (
	"context"
	_ "embed"
	"maps"
	"slices"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	appMIMEType  = "text/html;profile=mcp-app"
	appExtension = "io.modelcontextprotocol/ui"
)

// appHTML is built from the ui sources and committed so Go builds need no Node runtime.
// The template contains no weather data, credentials, or external dependencies.
//
//go:embed ui/app.html
var appHTML string

// addAppTool keeps the normal typed handler and schemas, and adds a separate
// inspectable view resource. Callers use this only for read-only data tools.
// Registering the view alongside the tool preserves data-source capability gates.
func addAppTool[In, Out any](srv *mcp.Server, tool *mcp.Tool, handler mcp.ToolHandlerFor[In, Out]) {
	uri := "ui://tempestkeep/" + tool.Name + ".html"
	view := *tool
	view.Meta = maps.Clone(tool.Meta)
	if view.Meta == nil {
		view.Meta = mcp.Meta{}
	}
	view.Meta["ui"] = map[string]any{"resourceUri": uri}
	mcp.AddTool(srv, &view, handler)

	// Names come only from static tool registrations, never from a URI or data.
	html := strings.ReplaceAll(appHTML, "__TEMPESTKEEP_TOOL__", tool.Name)
	srv.AddResource(&mcp.Resource{
		URI: uri, Name: tool.Name + "_app", Title: tool.Title,
		Description: "Interactive view of " + tool.Name + " results.",
		MIMEType:    appMIMEType, Size: int64(len(html)), Meta: appResourceMeta(),
	}, func(_ context.Context, _ *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
		return &mcp.ReadResourceResult{Contents: []*mcp.ResourceContents{{
			URI: uri, MIMEType: appMIMEType, Text: html, Meta: appResourceMeta(),
		}}}, nil
	})
}

// appResourceMeta lets hosts audit the static security policy before loading
// the view. Tool results arrive through the host bridge; the view needs no
// outbound requests, remote assets, nested frames, or browser permissions.
func appResourceMeta() mcp.Meta {
	return mcp.Meta{"ui": map[string]any{
		"csp": map[string]any{
			"connectDomains": []string{}, "resourceDomains": []string{},
			"frameDomains": []string{}, "baseUriDomains": []string{},
		},
		"permissions": map[string]any{}, "prefersBorder": true,
	}}
}

// appToolsMiddleware negotiates presentation per request without mutating the
// shared tool definitions. Plain MCP clients retain the same tools, schemas,
// annotations, structured results, and text content without UI metadata.
// Resources stay discoverable so clients can inspect their static HTML/CSP.
func appToolsMiddleware(next mcp.MethodHandler) mcp.MethodHandler {
	return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
		result, err := next(ctx, method, req)
		if err != nil || method != "tools/list" {
			return result, err
		}
		request, ok := req.(*mcp.ListToolsRequest)
		if !ok || supportsApps(request.ClientCapabilities()) {
			return result, nil
		}
		listed, ok := result.(*mcp.ListToolsResult)
		if !ok {
			return result, nil
		}
		plain := *listed
		plain.Tools = make([]*mcp.Tool, len(listed.Tools))
		for i, tool := range listed.Tools {
			copy := *tool
			copy.Meta = maps.Clone(tool.Meta)
			delete(copy.Meta, "ui")
			plain.Tools[i] = &copy
		}
		return &plain, nil
	}
}

func supportsApps(capabilities *mcp.ClientCapabilities) bool {
	if capabilities == nil {
		return false
	}
	settings, ok := capabilities.Extensions[appExtension].(map[string]any)
	if !ok {
		return false
	}
	switch mimeTypes := settings["mimeTypes"].(type) {
	case []string:
		return slices.Contains(mimeTypes, appMIMEType)
	case []any:
		return slices.Contains(mimeTypes, any(appMIMEType))
	default:
		return false
	}
}
