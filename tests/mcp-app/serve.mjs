import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { fixtures } from './fixtures.mjs';

const root = new URL('../../', import.meta.url);
const bundle = await build({ entryPoints: [new URL('./host.js', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'warning' });
const app = await readFile(new URL('internal/mcpapp/ui/app.html', root), 'utf8');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TempestKeep · synthetic MCP Apps preview</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f5f7;font:13px system-ui;color:#596777}header{max-width:1200px;margin:auto;padding:20px 22px;display:flex;justify-content:space-between;gap:12px}header strong{color:#223645}main{max-width:1200px;margin:0 auto;padding:0 16px 24px}iframe{display:block;width:100%;height:1200px;border:1px solid #dce3e8;border-radius:16px;background:white}@media(max-width:600px){header{padding:12px}main{padding:0 6px 12px}header span{max-width:150px;text-align:right;font-size:11px}}</style><header><strong>TempestKeep / MCP Apps</strong><span>Synthetic data · local test host</span></header><main><iframe title="TempestKeep MCP App" sandbox="allow-scripts"></iframe></main><script type="module" src="/host.js"></script></html>`;
const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  } else if (url.pathname === '/host.js') {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(bundle.outputFiles[0].contents);
  } else if (url.pathname === '/fixture' && fixtures[url.searchParams.get('view')]) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(fixtures[url.searchParams.get('view')]));
  } else if (url.pathname === '/app' && Object.values(fixtures).some((f) => f.tool === url.searchParams.get('tool'))) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', csp);
    res.end(app.replaceAll('__TEMPESTKEEP_TOOL__', url.searchParams.get('tool')));
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});
server.listen(4177, '127.0.0.1', () => console.log('Synthetic MCP Apps host: http://127.0.0.1:4177'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
