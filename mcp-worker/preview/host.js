// The preview's MCP Apps host: the host side of SEP-1865 (spec 2026-01-26),
// enough to drive the aircraft map the way Claude or ChatGPT do. The view runs
// in a sandboxed iframe (scripts only, opaque origin) under the CSP the spec
// tells hosts to build from the resource's _meta.ui.csp, so a domain the
// resource forgot to declare fails here too.
import { HOST_QUIRKS, SCENARIOS, toolResult } from './scenarios.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const form = $('controls');
const frame = $('frame');
const DEVICES = {
  desktop: { inline: { width: 720 }, fullscreen: { width: 1280, height: 800 } },
  mobile: { inline: { width: 360 }, fullscreen: { width: 360, height: 740, insets: { top: 0, right: 0, bottom: 76, left: 0 } } },
};

for (const [key, sc] of Object.entries(SCENARIOS)) $('scenario').add(new Option(`${key}: ${sc.title}`, key));
for (const [key, q] of Object.entries(HOST_QUIRKS)) $('quirk').add(new Option(q.title, key));
// ?frame=700x500: an iframe of that size whatever the view asks (a host that
// doesn't honour size-changed).
const FRAME = /^(\d+)x(\d+)$/.exec(params.get('frame') || '');
for (const [k, v] of params) {
  const el = form.elements[k];
  if (!el) continue;
  if (el instanceof RadioNodeList) for (const r of el) r.checked = r.value === v;
  else el.value = v;
}
if (params.has('caps')) {
  const on = params.get('caps').split(',');
  for (const c of form.querySelectorAll('[name=cap]')) c.checked = on.includes('all') || on.includes(c.value);
}
if (params.get('oldserver') === '1') form.elements.oldserver.checked = true;
if (params.get('shot') === '1') document.body.classList.add('shot');

const state = () => ({
  scenario: form.elements.scenario.value,
  theme: form.elements.theme.value,
  locale: form.elements.locale.value,
  device: form.elements.device.value,
  mode: form.elements.mode.value,
  caps: new Set([...form.querySelectorAll('[name=cap]:checked')].map((c) => c.value)),
  quirk: form.elements.quirk.value,
  structured: !form.elements.oldserver.checked,
});
let S = state();
const status = { initialized: false, toolInput: false, toolResult: false, sizes: [], logs: [], requests: [], errors: [] };
const report = () => { $('status').textContent = JSON.stringify(status); };

function log(dir, msg) {
  const line = `${dir} ${msg.method || (msg.error ? 'error' : 'result')}${msg.id != null ? ` #${msg.id}` : ''} ${JSON.stringify(msg.params ?? msg.result ?? msg.error ?? '').slice(0, 220)}`;
  $('log').textContent = `${line}\n${$('log').textContent}`.slice(0, 20000);
}

// The CSP of the spec's "Content Security Policy Enforcement" section.
function cspFor(meta) {
  const csp = (meta && meta.ui && meta.ui.csp) || {};
  const rd = (csp.resourceDomains || []).join(' ');
  const cd = (csp.connectDomains || []).join(' ');
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' ${rd}`,
    `style-src 'self' 'unsafe-inline' ${rd}`,
    `connect-src 'self' ${cd}`,
    // ?csp=nodata: a host stricter than the spec, to see the view's fallbacks.
    `img-src 'self' ${params.get('csp') === 'nodata' ? '' : 'data: '}${rd}`,
    `font-src 'self' ${rd}`,
    `media-src 'self' data: ${rd}`,
    `frame-src ${(csp.frameDomains || []).join(' ') || "'none'"}`,
    "object-src 'none'",
    `base-uri ${(csp.baseUriDomains || []).join(' ') || "'self'"}`,
  ].join('; ');
}

function hostContext() {
  const dev = DEVICES[S.device][S.mode];
  const mobile = S.device === 'mobile';
  const sc = SCENARIOS[S.scenario];
  return {
    theme: S.theme,
    locale: S.locale === 'it' ? 'it-IT' : 'en-US',
    timeZone: 'Europe/Rome',
    displayMode: S.mode,
    availableDisplayModes: S.caps.has('fullscreen') ? ['inline', 'fullscreen'] : ['inline'],
    containerDimensions: S.mode === 'fullscreen' ? { width: dev.width, height: dev.height } : { width: dev.width, maxHeight: 640 },
    platform: mobile ? 'mobile' : 'web',
    deviceCapabilities: { touch: mobile, hover: !mobile },
    // ?sa=12,0,0,0: insets in any mode (top, right, bottom, left).
    safeAreaInsets: params.get('sa')
      ? Object.fromEntries(['top', 'right', 'bottom', 'left'].map((k, i) => [k, Number(params.get('sa').split(',')[i]) || 0]))
      : dev.insets || { top: 0, right: 0, bottom: 0, left: 0 },
    userAgent: 'fia-preview-host',
    toolInfo: { id: 1, tool: { name: sc.tool, inputSchema: { type: 'object' } } },
  };
}
function hostCapabilities() {
  const c = { logging: {}, sandbox: { csp: widget.resource._meta.ui.csp } };
  if (S.caps.has('serverTools')) c.serverTools = {};
  if (S.caps.has('message')) c.message = { text: {} };
  if (S.caps.has('openLinks')) c.openLinks = {};
  if (S.caps.has('updateModelContext')) c.updateModelContext = { text: {} };
  return c;
}

const send = (msg) => { log('→', msg); frame.contentWindow.postMessage(msg, '*'); };
let refreshes = 0;
async function onRequest(m) {
  switch (m.method) {
    case 'ui/initialize':
      return { protocolVersion: '2026-01-26', hostInfo: { name: 'fia-preview-host', version: '1.0.0' }, hostCapabilities: hostCapabilities(), hostContext: hostContext() };
    case 'ui/request-display-mode': {
      const want = m.params && m.params.mode;
      if (want === 'fullscreen' && !S.caps.has('fullscreen')) return { mode: S.mode };
      if (want === 'inline' || want === 'fullscreen') setMode(want);
      return { mode: S.mode };
    }
    case 'tools/call':
      if (!S.caps.has('serverTools')) throw Object.assign(new Error('Tool calls are not supported'), { code: -32601 });
      await new Promise((r) => setTimeout(r, 600));
      // The host's proxy hands the view the server's whole result (ext-apps#696).
      return toolResult(S.scenario, ++refreshes, { structured: S.structured });
    case 'ui/open-link':
    case 'ui/message':
    case 'ui/update-model-context':
      status.requests.push({ method: m.method, params: m.params });
      return {};
    case 'ping':
      return {};
    default:
      throw Object.assign(new Error(`Method not found: ${m.method}`), { code: -32601 });
  }
}

window.addEventListener('message', async (e) => {
  if (e.source !== frame.contentWindow) return;
  const m = e.data;
  if (!m || m.jsonrpc !== '2.0') return;
  log('←', m);
  if (m.method && m.id != null) {
    try {
      send({ jsonrpc: '2.0', id: m.id, result: await onRequest(m) });
    } catch (err) {
      send({ jsonrpc: '2.0', id: m.id, error: { code: err.code || -32000, message: err.message } });
    }
    report();
    return;
  }
  if (m.method === 'ui/notifications/initialized') {
    status.initialized = true;
    const sc = SCENARIOS[S.scenario];
    send({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: sc.args } });
    status.toolInput = true;
    if (!sc.pending) {
      setTimeout(() => {
        const result = HOST_QUIRKS[S.quirk].apply(toolResult(S.scenario, 0, { structured: S.structured }));
        send({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result });
        status.toolResult = true;
        report();
      }, Number(params.get('latency') || 350));
    }
  } else if (m.method === 'ui/notifications/size-changed') {
    status.sizes.push(m.params);
    if (S.mode === 'inline' && !FRAME && m.params && m.params.height) frame.style.height = `${Math.min(m.params.height, 640)}px`;
  } else if (m.method === 'notifications/message') {
    status.logs.push(m.params);
    if (m.params && (m.params.level === 'error' || m.params.level === 'warning')) status.errors.push(m.params.data);
  }
  report();
});

function layout() {
  const dev = DEVICES[S.device][S.mode];
  document.body.dataset.theme = S.theme;
  document.body.dataset.mode = S.mode;
  document.body.dataset.device = S.device;
  $('chat').style.width = `${FRAME ? FRAME[1] : dev.width}px`;
  if (FRAME) frame.style.height = `${FRAME[2]}px`;
  else if (S.mode === 'fullscreen') frame.style.height = `${dev.height}px`;
  $('bubble').textContent = S.locale === 'it' ? 'Ecco gli aerei che la rete FlyItalyADSB vede adesso:' : 'Here are the aircraft the FlyItalyADSB network sees right now:';
}

function setMode(mode) {
  S.mode = mode;
  for (const r of form.elements.mode) r.checked = r.value === mode;
  layout();
  send({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { displayMode: mode, containerDimensions: hostContext().containerDimensions, safeAreaInsets: hostContext().safeAreaInsets } });
}

let widget = null;
async function load() {
  S = state();
  refreshes = 0;
  Object.assign(status, { initialized: false, toolInput: false, toolResult: false, sizes: [], logs: [], requests: [], errors: [] });
  layout();
  widget = widget || (await (await fetch('/widget.json')).json());
  const csp = cspFor(widget.resource._meta);
  status.csp = csp;
  status.mimeType = widget.resource.mimeType;
  frame.srcdoc = widget.resource.text.replace(/<head>/i, `<head><meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">`);
  report();
}

form.addEventListener('change', (e) => {
  // Theme, locale and display mode are host context: changing them doesn't
  // reload the view, the host tells it (host-context-changed), as hosts do.
  const prev = S;
  S = state();
  if (e.target.name === 'theme' || e.target.name === 'locale') {
    layout();
    send({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: S.theme, locale: hostContext().locale } });
  } else if (e.target.name === 'mode') {
    S = prev;
    setMode(e.target.value);
  } else {
    load();
  }
});
$('replay').addEventListener('click', load);
load().catch((err) => { $('log').textContent = String(err); });
