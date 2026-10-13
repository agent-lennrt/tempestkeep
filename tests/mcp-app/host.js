import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';

const params = new URLSearchParams(location.search);
const fixture = await fetch(`/fixture?view=${encodeURIComponent(params.get('view') || 'weather')}`).then((r) => r.json());
const frame = document.querySelector('iframe');
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const bridge = new AppBridge(null, { name: 'TempestKeep synthetic test host', version: '1.0.0' },
  params.has('noTools') ? {} : { serverTools: {} },
  { hostContext: { theme, displayMode: 'inline', availableDisplayModes: ['inline'], platform: 'web' } });
const host = window.fixtureHost = {
  bridge, fixture, calls: [], initialized: false, nextError: null,
  holdNextCall: false, releaseCall: null,
  async send(data) { await bridge.sendToolResult({ content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }); },
  async error(message) { await bridge.sendToolResult({ content: [{ type: 'text', text: message }], isError: true }); },
  setTheme(value) { bridge.setHostContext({ theme: value }); },
};
bridge.oncalltool = async (request) => {
  host.calls.push(request);
  if (request.name !== fixture.tool) throw new Error('Test host allows only the mounted read tool');
  if (host.holdNextCall) {
    host.holdNextCall = false;
    await new Promise((resolve) => { host.releaseCall = resolve; });
  }
  if (host.nextError) {
    const message = host.nextError;
    host.nextError = null;
    return { content: [{ type: 'text', text: message }], isError: true };
  }
  return { content: [{ type: 'text', text: JSON.stringify(fixture.data) }], structuredContent: fixture.data };
};
bridge.onsizechange = ({ height }) => {
  if (height > 0) frame.style.height = `${Math.min(6000, Math.ceil(height))}px`;
};
bridge.oninitialized = async () => {
  host.initialized = true;
  if (!params.has('noInput')) await bridge.sendToolInput({ arguments: fixture.args });
  if (!params.has('loading')) await host.send(fixture.data);
};
await bridge.connect(new PostMessageTransport(frame.contentWindow, frame.contentWindow));
frame.src = `/app?tool=${encodeURIComponent(fixture.tool)}`;
