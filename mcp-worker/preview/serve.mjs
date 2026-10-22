#!/usr/bin/env node
// Local preview of the in-chat aircraft map (src/lib/mcp/apps/aircraft-map.ts)
// in a small MCP Apps host that plays fake tool results (scenarios.js): both
// themes, IT/EN, inline and fullscreen, desktop and phone widths.
//
//   npm run mcp:dev        # the Worker, http://127.0.0.1:8787
//   npm run mcp:preview    # this, http://127.0.0.1:8790
//
// The page comes from the Worker itself, through MCP resources/read, so the
// preview shows exactly what Claude or ChatGPT would load, with its CSP. The
// resource needs no real key (it calls no API): any X-Api-Key gets through.
// Env: PREVIEW_PORT (8790), MCP_URL (http://127.0.0.1:8787/mcp).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PREVIEW_PORT || 8790);
const MCP_URL = process.env.MCP_URL || 'http://127.0.0.1:8787/mcp';
const URI = 'ui://flyitalyadsb/aircraft-map.html';

let nextId = 1;
async function mcp(method, params = {}) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
      'x-api-key': 'preview-no-key',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  const text = await res.text();
  const data = /^data: (.*)$/m.exec(text);
  const msg = JSON.parse(data ? data[1] : text);
  if (msg.error) throw new Error(`${method}: ${msg.error.message}`);
  return msg.result;
}

const FILES = { '/': 'index.html', '/host.js': 'host.js', '/scenarios.js': 'scenarios.js' };
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8' };

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  try {
    if (path === '/widget.json') {
      const [read, list, tools] = await Promise.all([mcp('resources/read', { uri: URI }), mcp('resources/list'), mcp('tools/list')]);
      const body = {
        resource: read.contents[0],
        listed: list.resources.find((r) => r.uri === URI) || null,
        tools: tools.tools.map((t) => ({ name: t.name, _meta: t._meta || null })),
      };
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(body));
      return;
    }
    const file = FILES[path];
    if (!file) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()], 'cache-control': 'no-store' });
    res.end(await readFile(join(HERE, file)));
  } catch (err) {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Preview error: ${err.message}\nIs the Worker running? npm run mcp:dev (MCP_URL=${MCP_URL})\n`);
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`aircraft map preview on http://127.0.0.1:${PORT}/ (widget from ${MCP_URL})`);
});
