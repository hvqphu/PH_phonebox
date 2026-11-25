import express from 'express';
import path from 'node:path';
import { AGENT, PAGES, WWW, landingHtml, panelHtml, settingsHtml } from './scripts/site.mjs';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const app = express();
app.disable('x-powered-by');

// SSE webhook relay state (mirrors tools/demo-server.py)
const EVENTS = [];
const sseClients = new Set();

function relay(kind, data) {
  const seq = (EVENTS.length ? EVENTS[EVENTS.length - 1].seq : 0) + 1;
  const event = { seq, kind, data };
  EVENTS.push(event);
  if (EVENTS.length > 100) {
    EVENTS.splice(0, EVENTS.length - 100);
  }
  const payload = `id: ${event.seq}\nevent: ${event.kind}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
      client.lastSeq = event.seq;
    } catch {
      sseClients.delete(client);
    }
  }
  return seq;
}

function parseBody(buf) {
  const raw = (buf ? Buffer.from(buf).toString('utf8') : '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function handleWebhook(method, reqPath, body) {
  if (method !== 'POST' && method !== 'PUT') return null;
  if (reqPath.startsWith('/api/push/')) {
    return { ok: true, seq: relay('push', { key: decodeURIComponent(reqPath.slice(10)), value: parseBody(body) }) };
  }
  if (reqPath === '/api/notify') {
    const d = parseBody(body);
    return { ok: true, seq: relay('notify', isPlainObject(d) ? d : { text: d == null ? '' : String(d) }) };
  }
  if (reqPath.startsWith('/api/goto/')) {
    return { ok: true, seq: relay('goto', { page: decodeURIComponent(reqPath.slice(10)) }) };
  }
  if (reqPath === '/api/refresh') {
    return { ok: true, seq: relay('refresh', null) };
  }
  if (reqPath === '/api/ask') {
    const d = parseBody(body);
    return { ok: true, seq: relay('ask', isPlainObject(d) ? d : null) };
  }
  return null;
}

app.use(express.raw({ type: '*/*', limit: '2mb' }));

// Redirect directory paths without trailing slash so relative ../demo.js and main.js resolve properly
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/panel' || req.path === '/settings' || req.path === '/pair')) {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return res.redirect(301, `${req.path}/${qs}`);
  }
  next();
});

app.get('/demo/events', (req, res) => {
  const headerLast = Number(req.get('Last-Event-ID') || 0);
  const latest = EVENTS.length ? EVENTS[EVENTS.length - 1].seq : 0;
  let lastSeq = headerLast || latest;

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  for (const event of EVENTS) {
    if (event.seq > lastSeq) {
      res.write(`id: ${event.seq}\nevent: ${event.kind}\ndata: ${JSON.stringify(event.data)}\n\n`);
      lastSeq = event.seq;
    }
  }

  const client = { res, lastSeq };
  sseClients.add(client);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(client);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(client);
  });
});

// Webhook relay endpoints
app.use((req, res, next) => {
  const apiPath = req.path.startsWith('/agent/api/') ? req.path.slice('/agent'.length) : req.path;
  const reply = handleWebhook(req.method, apiPath, req.body);
  if (reply !== null) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(reply);
  }
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).json({ error: 'the demo answers this in the browser (tools/pages/demo.js)' });
  }
  next();
});

const noStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};
app.use(noStore);

app.get(['/', '/index.html'], (_req, res) => {
  res.type('html').send(landingHtml());
});

app.get('/demo.js', (_req, res) => {
  res.sendFile(path.join(PAGES, 'demo.js'));
});

app.get('/widgets.json', (_req, res) => {
  res.sendFile(path.join(AGENT, 'widgets.json'));
});

app.get('/templates.json', (_req, res) => {
  res.sendFile(path.join(AGENT, 'templates.json'));
});

app.get('/favicon.ico', (_req, res) => {
  res.sendFile(path.join(AGENT, 'phonebox.ico'));
});

app.get(['/panel/', '/panel/index.html'], (_req, res) => {
  res.type('html').send(panelHtml({ relay: true }));
});

app.use('/panel', express.static(WWW, { index: false }));

app.get(['/settings/', '/settings/index.html'], (_req, res) => {
  res.type('html').send(settingsHtml({ relay: true }));
});

app.get(['/pair/', '/pair/index.html'], (_req, res) => {
  res.sendFile(path.join(PAGES, 'pair.html'));
});

app.use((_req, res) => {
  res.status(404).type('text/plain').send('not found');
});

app.listen(PORT, HOST, () => {
  console.log(`PhoneBox web demo listening on http://${HOST}:${PORT}`);
});
