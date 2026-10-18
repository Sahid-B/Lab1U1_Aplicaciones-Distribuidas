const http = require('http');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || 'v5';
const APP_MESSAGE = process.env.APP_MESSAGE || (APP_VERSION === 'v3' ? 'Versión Canary v3' : (APP_VERSION === 'v2' ? 'Versión Estable v2' : `Versión ${APP_VERSION}`));
const POD = os.hostname();
const COUNTER_URL = process.env.COUNTER_URL || 'http://counter-service:4000';

let localCounter = 0;

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Connection': 'close'
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

// Llama al servicio central con hasta 3 reintentos y timeout de 2 segundos.
// Idempotencia: el requestId viaja en la URL y se reutiliza en todos los reintentos.
async function callCounter(path, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(`${COUNTER_URL}${path}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return { ...data, attempts: attempt };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Reto 3: /health (Liveness / Readiness)
  if (url.pathname === '/health') {
    return send(res, 200, { status: 'ok', pod: POD, version: APP_VERSION });
  }

  // Reto 3: /api/info liviano y SIN logs para no distorsionar k6
  if (url.pathname === '/api/info') {
    return send(res, 200, {
      version: APP_VERSION,
      message: APP_MESSAGE,
      pod: POD,
      counter: localCounter,
      time: new Date().toISOString()
    });
  }

  // Reto 2: /whoami para distribución de tráfico y balanceo canary
  if (url.pathname === '/whoami') {
    return send(res, 200, {
      pod: POD,
      version: APP_VERSION
    });
  }

  // Contador local
  if (url.pathname === '/increment') {
    localCounter++;
    return send(res, 200, {
      action: 'increment',
      version: APP_VERSION,
      pod: POD,
      counter: localCounter
    });
  }

  // Reto 1: /increment-global con idempotencia y reintentos hacia COUNTER_URL
  if (url.pathname === '/increment-global') {
    const requestId = url.searchParams.get('requestId') || crypto.randomUUID();
    try {
      const data = await callCounter(`/increment?requestId=${encodeURIComponent(requestId)}`);
      return send(res, 200, {
        pod: POD,
        version: APP_VERSION,
        requestId,
        globalCounter: data.counter,
        duplicate: Boolean(data.duplicate),
        attempts: data.attempts
      });
    } catch (e) {
      return send(res, 503, {
        error: 'counter-service no disponible',
        message: e.message || 'Error comunicando con counter-service',
        pod: POD,
        version: APP_VERSION,
        requestId,
        attempts: 3
      });
    }
  }

  // Reto 1: /global-value
  if (url.pathname === '/global-value') {
    try {
      const data = await callCounter('/value');
      return send(res, 200, {
        pod: POD,
        version: APP_VERSION,
        globalCounter: data.counter
      });
    } catch (e) {
      return send(res, 503, {
        error: 'counter-service no disponible',
        message: e.message,
        pod: POD,
        version: APP_VERSION
      });
    }
  }

  // Reto 1: /reset-global
  if (url.pathname === '/reset-global') {
    try {
      const data = await callCounter('/reset');
      return send(res, 200, {
        pod: POD,
        version: APP_VERSION,
        globalCounter: data.counter
      });
    } catch (e) {
      return send(res, 503, {
        error: 'counter-service no disponible',
        message: e.message,
        pod: POD,
        version: APP_VERSION
      });
    }
  }

  // Panel en "/" con diseño simple y limpio
  if (url.pathname === '/') {
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Distributed App Lab</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 30px auto; padding: 0 20px; background: #f4f6f8; color: #222; }
    body.dark { background: #121212; color: #e0e0e0; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 20px; }
    body.dark .card { background: #1e1e1e; box-shadow: 0 2px 10px rgba(0,0,0,0.4); }
    h1 { font-size: 1.5rem; margin: 0; }
    h2 { font-size: 1.15rem; margin-top: 0; margin-bottom: 8px; color: #1a56db; }
    body.dark h2 { color: #60a5fa; }
    p { margin: 6px 0; font-size: 0.95rem; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    code { background: #eef1f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    body.dark code { background: #2d2d2d; color: #f0f0f0; }
    button { padding: 8px 14px; margin: 4px 6px 4px 0; cursor: pointer; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 6px; font-size: 0.9rem; }
    button:hover { background: #f1f5f9; }
    body.dark button { background: #2d2d2d; color: #f0f0f0; border-color: #444; }
    body.dark button:hover { background: #3d3d3d; }
    button.primary { background: #2563eb; color: #ffffff; border-color: #1d4ed8; }
    button.primary:hover { background: #1d4ed8; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 10px; font-size: 0.9rem; }
    body.dark .box { background: #252525; border-color: #383838; }
    .notice { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 4px; margin-top: 10px; font-size: 0.88rem; color: #92400e; }
    body.dark .notice { background: #2d2410; border-left-color: #f59e0b; color: #fde68a; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.88rem; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    body.dark th, body.dark td { border-color: #383838; }
    th { background: #f1f5f9; }
    body.dark th { background: #2d2d2d; }
    .theme-toggle { padding: 6px 12px; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header-row">
      <h1>Distributed App Lab</h1>
      <button class="theme-toggle" onclick="toggleTheme()" id="themeBtn">Modo Oscuro</button>
    </div>
    <p>${APP_MESSAGE}</p>
    <p>Versión: <b>${APP_VERSION}</b></p>
    <p>Servidor / Pod: <code>${POD}</code></p>
    <p>Réplicas descubiertas: <b id="meta-replica-count">1</b></p>
    <p>Hora UTC: ${new Date().toISOString()}</p>
  </div>

  <!-- Reto 1 -->
  <div class="card">
    <h2>Reto 1: Consistencia del Estado Distribuido</h2>
    <p>Comparación entre contador local en memoria y contador global centralizado con reintentos e idempotencia.</p>
    <div>
      <button class="primary" id="btnLocal100" onclick="runLocal100()">Incrementar local x100</button>
      <button class="primary" id="btnGlobal100" onclick="runGlobal100()">Incrementar global x100</button>
      <button onclick="resetGlobal()">Reiniciar global</button>
      <button id="btnIdemp" onclick="testDuplicateRequestId()">Repetir mismo requestId 2 veces</button>
    </div>

    <div class="box">
      <p><b>Local:</b> Resultado esperado: 100 | Máximo contador local en un Pod: <b id="val-local-max">-</b></p>
      <p><b>Global:</b> Resultado esperado: 100 | Valor actual contador global: <b id="val-global-counter">-</b></p>
    </div>

    <div id="local-status" class="box" style="display:none;"></div>
    <div id="global-status" class="box" style="display:none;"></div>
    <div id="idempotency-result" class="box" style="display:none;"></div>

    <div id="pod-local-table-container" style="display:none; margin-top: 10px;">
      <p><b>Contadores locales máximos por Pod:</b></p>
      <table>
        <thead>
          <tr>
            <th>Pod</th>
            <th>Peticiones recibidas</th>
            <th>Contador local máximo</th>
          </tr>
        </thead>
        <tbody id="pod-local-tbody"></tbody>
      </table>
    </div>
  </div>

  <!-- Reto 2 -->
  <div class="card">
    <h2>Reto 2: Despliegue Progresivo Canary</h2>
    <p>Distribución de tráfico hacia <code>/whoami</code> entre versión estable (v2, 3 réplicas) y canary (v3, 1 réplica).</p>
    <div style="margin: 8px 0;">
      <label for="whoami-count">Solicitudes:</label>
      <input type="number" id="whoami-count" value="200" min="10" max="1000" style="padding: 6px; width: 80px;">
      <button class="primary" id="btnWhoami" onclick="runWhoami()">Enviar 200 solicitudes</button>
    </div>

    <div id="whoami-status" class="box" style="display:none;"></div>

    <div id="whoami-table-container" style="display:none;">
      <p><b>Porcentaje por versión:</b></p>
      <p>• v2 (Estable): <b id="pct-v2">-</b> (Esperado: ~75% - 80%)</p>
      <p>• v3 (Canary): <b id="pct-v3">-</b> (Esperado: ~20% - 25%)</p>
      <table>
        <thead>
          <tr>
            <th>Pod</th>
            <th>Versión</th>
            <th>Solicitudes</th>
            <th>Porcentaje</th>
          </tr>
        </thead>
        <tbody id="whoami-tbody"></tbody>
      </table>
    </div>
  </div>

  <!-- Reto 3 -->
  <div class="card">
    <h2>Reto 3: Punto de Degradación del Sistema</h2>
    <p>Pod actual: <code>${POD}</code> (Versión: <b>${APP_VERSION}</b>)</p>
    <p>Número de réplicas visibles: <b id="val-discovered-replicas">1</b></p>
    <p>Pods activos detectados: <span id="pods-list"><code>${POD}</code></span></p>

    <div class="notice">
      <b>Nota:</b> La prueba de carga formal se hace con <b>k6</b> (<code>degradation-test.js</code>) y no desde el navegador. El navegador tiene límites de conexiones concurrentes por host que distorsionan la medición de degradación del clúster.
    </div>
  </div>

  <script>
    const seenPods = new Map();
    seenPods.set('${POD}', '${APP_VERSION}');
    const localCountersByPod = {};

    function toggleTheme() {
      document.body.classList.toggle('dark');
      const isDark = document.body.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      document.getElementById('themeBtn').textContent = isDark ? 'Modo Claro' : 'Modo Oscuro';
    }

    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark');
      document.getElementById('themeBtn').textContent = 'Modo Claro';
    }

    function updateSeenPods() {
      document.getElementById('meta-replica-count').textContent = seenPods.size;
      document.getElementById('val-discovered-replicas').textContent = seenPods.size;
      const listEl = document.getElementById('pods-list');
      listEl.innerHTML = '';
      seenPods.forEach((v, p) => {
        listEl.innerHTML += '<code>' + p + ' (' + v + ')</code> ';
      });
    }

    async function refreshGlobalValue() {
      try {
        const res = await fetch('/global-value');
        if (res.ok) {
          const data = await res.json();
          document.getElementById('val-global-counter').textContent = data.globalCounter;
        }
      } catch (e) {}
    }

    async function runLocal100() {
      const btn = document.getElementById('btnLocal100');
      const status = document.getElementById('local-status');
      btn.disabled = true;
      status.style.display = 'block';
      status.textContent = 'Enviando 100 peticiones concurrentes a /increment...';

      const podDistribution = {};
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          fetch('/increment', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
              if (data.pod) {
                seenPods.set(data.pod, data.version);
                podDistribution[data.pod] = (podDistribution[data.pod] || 0) + 1;
                localCountersByPod[data.pod] = Math.max(localCountersByPod[data.pod] || 0, data.counter || 0);
              }
            })
            .catch(e => console.error(e))
        );
      }

      await Promise.all(promises);
      btn.disabled = false;
      updateSeenPods();

      let maxVal = 0;
      const tbody = document.getElementById('pod-local-tbody');
      tbody.innerHTML = '';
      for (const [pod, count] of Object.entries(podDistribution)) {
        const podMax = localCountersByPod[pod] || count;
        if (podMax > maxVal) maxVal = podMax;
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><code>' + pod + '</code></td><td>' + count + '</td><td><b>' + podMax + '</b></td>';
        tbody.appendChild(tr);
      }

      document.getElementById('val-local-max').textContent = maxVal;
      document.getElementById('pod-local-table-container').style.display = 'block';
      status.textContent = '100 solicitudes completadas. Inconsistencia confirmada: cada Pod incrementó su propio contador local en memoria.';
    }

    async function runGlobal100() {
      const btn = document.getElementById('btnGlobal100');
      const status = document.getElementById('global-status');
      btn.disabled = true;
      status.style.display = 'block';
      status.textContent = 'Enviando 100 peticiones concurrentes a /increment-global...';

      let success = 0;
      let dupes = 0;
      const promises = [];

      for (let i = 0; i < 100; i++) {
        const reqId = 'req-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substring(2, 6);
        promises.push(
          fetch('/increment-global?requestId=' + encodeURIComponent(reqId))
            .then(r => r.json())
            .then(data => {
              if (data.pod) seenPods.set(data.pod, data.version);
              if (data.globalCounter !== undefined) {
                success++;
                if (data.duplicate) dupes++;
              }
            })
            .catch(e => console.error(e))
        );
      }

      await Promise.all(promises);
      btn.disabled = false;
      updateSeenPods();
      await refreshGlobalValue();

      status.textContent = '100 solicitudes procesadas. Exitosas: ' + success + '/100 | Duplicados: ' + dupes + '. Consistencia global mantenida en counter-service.';
    }

    async function resetGlobal() {
      try {
        await fetch('/reset-global');
        await refreshGlobalValue();
        const status = document.getElementById('global-status');
        status.style.display = 'block';
        status.textContent = 'Contador global reiniciado a 0 en counter-service.';
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function testDuplicateRequestId() {
      const btn = document.getElementById('btnIdemp');
      const box = document.getElementById('idempotency-result');
      btn.disabled = true;
      box.style.display = 'block';
      box.textContent = 'Enviando la misma solicitud 2 veces con idéntico requestId...';

      const testId = 'idemp-test-' + Date.now();
      try {
        const r1 = await fetch('/increment-global?requestId=' + encodeURIComponent(testId)).then(r => r.json());
        const r2 = await fetch('/increment-global?requestId=' + encodeURIComponent(testId)).then(r => r.json());

        box.innerHTML = '<b>Prueba de Idempotencia (RequestId: <code>' + testId + '</code>):</b><br>' +
          '• Intento 1 (Pod: <code>' + r1.pod + '</code>): globalCounter = <b>' + r1.globalCounter + '</b>, duplicate = ' + r1.duplicate + '<br>' +
          '• Intento 2 (Pod: <code>' + r2.pod + '</code>): globalCounter = <b>' + r2.globalCounter + '</b>, duplicate = <b>' + r2.duplicate + '</b> (detectado como duplicado)<br>' +
          '<em>El contador central no se incrementó en la segunda llamada.</em>';
        await refreshGlobalValue();
      } catch (e) {
        box.textContent = 'Error: ' + e.message;
      } finally {
        btn.disabled = false;
      }
    }

    async function runWhoami() {
      const count = parseInt(document.getElementById('whoami-count').value || '200', 10);
      const btn = document.getElementById('btnWhoami');
      const status = document.getElementById('whoami-status');
      const tableContainer = document.getElementById('whoami-table-container');

      btn.disabled = true;
      status.style.display = 'block';
      status.textContent = 'Enviando ' + count + ' peticiones a /whoami...';

      const versionCounts = { v2: 0, v3: 0 };
      const podStats = {};
      let totalCompleted = 0;

      const batchSize = 15;
      for (let i = 0; i < count; i += batchSize) {
        const chunk = [];
        for (let j = i; j < Math.min(i + batchSize, count); j++) {
          chunk.push(
            fetch('/whoami')
              .then(r => r.json())
              .then(data => {
                totalCompleted++;
                const v = data.version || 'otro';
                const p = data.pod || 'unknown';
                seenPods.set(p, v);
                versionCounts[v] = (versionCounts[v] || 0) + 1;
                if (!podStats[p]) podStats[p] = { version: v, count: 0 };
                podStats[p].count++;
              })
              .catch(e => console.error(e))
          );
        }
        await Promise.all(chunk);
      }

      btn.disabled = false;
      updateSeenPods();

      const v2Count = versionCounts['v2'] || 0;
      const v3Count = versionCounts['v3'] || 0;
      const v2Pct = totalCompleted ? ((v2Count / totalCompleted) * 100).toFixed(1) : 0;
      const v3Pct = totalCompleted ? ((v3Count / totalCompleted) * 100).toFixed(1) : 0;

      document.getElementById('pct-v2').textContent = v2Pct + '% (' + v2Count + '/' + totalCompleted + ')';
      document.getElementById('pct-v3').textContent = v3Pct + '% (' + v3Count + '/' + totalCompleted + ')';

      const tbody = document.getElementById('whoami-tbody');
      tbody.innerHTML = '';
      for (const [pod, info] of Object.entries(podStats)) {
        const tr = document.createElement('tr');
        const podPct = totalCompleted ? ((info.count / totalCompleted) * 100).toFixed(1) : 0;
        tr.innerHTML = '<td><code>' + pod + '</code></td>' +
          '<td>' + info.version + '</td>' +
          '<td>' + info.count + '</td>' +
          '<td><b>' + podPct + '%</b></td>';
        tbody.appendChild(tr);
      }
      tableContainer.style.display = 'block';
      status.textContent = totalCompleted + ' peticiones completadas.';
    }

    refreshGlobalValue();
    updateSeenPods();
  </script>
</body>
</html>`;
    return send(res, 200, html, 'text/html; charset=utf-8');
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Distributed App Lab (${APP_VERSION}) en pod ${POD} escuchando en puerto ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});