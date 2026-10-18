const http = require('http');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const APP_VERSION = 'v4';
const APP_MESSAGE = 'Cuarta versión con contador global';
const POD = os.hostname();
const COUNTER_URL = process.env.COUNTER_URL || 'http://counter-service:4000';

let localCounter = 0; // contador local (el problema original)

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// Llama al servicio central con reintentos. El requestId va en el path,
// así que todos los reintentos usan el mismo ID (idempotencia).
async function callCounter(path, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(`${COUNTER_URL}${path}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const data = await r.json();
      return { ...data, attempts: attempt };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/') {
    return send(res, 200, { app: 'Distributed App Lab', version: APP_VERSION, pod: POD });
  }
  if (url.pathname === '/api/info') {
    return send(res, 200, {
      version: APP_VERSION, message: APP_MESSAGE, pod: POD,
      counter: localCounter, time: new Date().toISOString(),
    });
  }
  if (url.pathname === '/health') {
    return send(res, 200, { status: 'ok' });
  }
  if (url.pathname === '/increment') {
    localCounter++;
    return send(res, 200, { version: APP_VERSION, pod: POD, counter: localCounter });
  }
  if (url.pathname === '/increment-global') {
    const requestId = url.searchParams.get('requestId') || crypto.randomUUID();
    try {
      const data = await callCounter(`/increment?requestId=${encodeURIComponent(requestId)}`);
      return send(res, 200, {
        version: APP_VERSION, pod: POD, requestId,
        globalCounter: data.counter, duplicate: data.duplicate, attempts: data.attempts,
      });
    } catch (e) {
      return send(res, 503, { error: 'counter-service no disponible', pod: POD, requestId });
    }
  }
  if (url.pathname === '/global-value') {
    try {
      const data = await callCounter('/value');
      return send(res, 200, { pod: POD, globalCounter: data.counter });
    } catch (e) {
      return send(res, 503, { error: 'counter-service no disponible', pod: POD });
    }
  }
  if (url.pathname === '/reset-global') {
    try {
      const data = await callCounter('/reset');
      return send(res, 200, { pod: POD, globalCounter: data.counter });
    } catch (e) {
      return send(res, 503, { error: 'counter-service no disponible', pod: POD });
    }
  }
  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`Distributed App ${APP_VERSION} (${POD}) en puerto ${PORT}`));
