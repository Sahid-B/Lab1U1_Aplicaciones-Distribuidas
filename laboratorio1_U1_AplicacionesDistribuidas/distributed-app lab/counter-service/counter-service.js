const http = require('http');

const PORT = process.env.PORT || 4000;
let counter = 0;
const processedRequests = new Set();

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    return send(res, 200, { status: 'ok' });
  }

  if (url.pathname === '/increment') {
    const requestId = url.searchParams.get('requestId');
    if (requestId && processedRequests.has(requestId)) {
      return send(res, 200, { counter, duplicate: true });
    }

    counter++;
    if (requestId) {
      processedRequests.add(requestId);
    }
    return send(res, 200, { counter, duplicate: false });
  }

  if (url.pathname === '/value') {
    return send(res, 200, { counter });
  }

  if (url.pathname === '/reset') {
    counter = 0;
    processedRequests.clear();
    return send(res, 200, { counter });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`Counter Service escuchando en puerto ${PORT}`));
