/* ============================================================================
   RECIMINSA OPS & API GATEWAY SERVER (Versión v.js)
   - Sirve Reciminsa Ops (Consola Administrativa conectada a Supabase) en `/`
   - Expone la API RESTful `/api/v1/*` hacia Reciminsa Field
   - Sirve el cliente móvil Reciminsa Field (CERO conexión a Supabase) en `/field`
   ============================================================================ */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { handleApiV1Request } = require('./api/v1');

const PORT = process.env.PORT || 3040;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf'
};

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Token'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 1. Endpoints RESTful API v1 (/api/v1/*)
  if (parsedUrl.pathname.startsWith('/api/v1/')) {
    const body = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH'
      ? await parseJsonBody(req)
      : {};
    await handleApiV1Request(req, res, parsedUrl, body);
    return;
  }

  // 2. Proxy DGII Megaplus para Reciminsa Ops
  if (parsedUrl.pathname.startsWith('/api/dgii-megaplus')) {
    const rnc = parsedUrl.searchParams.get('rnc');
    const buscar = parsedUrl.searchParams.get('buscar');
    const mode = parsedUrl.searchParams.get('mode') || (buscar ? 'nombres' : 'consulta');

    let targetUrl = '';
    if (rnc) {
      targetUrl = `https://rnc.megaplus.com.do/api/consulta?rnc=${encodeURIComponent(rnc)}`;
    } else if (buscar) {
      targetUrl = `https://rnc.megaplus.com.do/api/consulta/${mode === 'nombre' ? 'nombre' : 'nombres'}?buscar=${encodeURIComponent(buscar)}`;
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: true, mensaje: 'Parámetro rnc o buscar faltante' }));
      return;
    }

    https.get(targetUrl, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    }).on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: true, mensaje: err.message }));
    });
    return;
  }

  // 3. Enrutamiento estático para Reciminsa Ops y Reciminsa Field
  let reqPath = decodeURI(parsedUrl.pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (reqPath === '/field' || reqPath === '/field/' || reqPath === '/reciminsa-field' || reqPath === '/reciminsa-field/') {
    reqPath = '/reciminsa-field/index.html';
  }

  const filePath = path.join(ROOT, reqPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 [Reciminsa Ops v.js] Consola & API Gateway activa en http://localhost:${PORT}`);
    console.log(`📱 [Reciminsa Field] Cliente móvil de campo en http://localhost:${PORT}/field`);
    console.log(`🔌 [API REST v1] Endpoints activos en http://localhost:${PORT}/api/v1/*`);
  });
}

module.exports = server;

