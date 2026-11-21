const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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

const server = http.createServer((req, res) => {
  // Manejador CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    });
    res.end();
    return;
  }

  // Proxy para la API de Megaplus DGII (evita bloqueo de CORS en navegadores)
  if (req.url.startsWith('/api/dgii-megaplus')) {
    const https = require('https');
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      proxyRes.pipe(res);
    }).on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: true, mensaje: err.message }));
    });
    return;
  }

  // Proxy para DominicanTech DGII (requiere variable de entorno DGII_API_TOKEN)
  if (req.url.startsWith('/api/dgii-domtech')) {
    const https = require('https');
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const rnc = parsedUrl.searchParams.get('rnc');
    const q = parsedUrl.searchParams.get('q');
    const domToken = (process.env.DGII_API_TOKEN || '').trim();
    if (!domToken) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ exito: false, mensaje: 'DGII_API_TOKEN no configurado en el servidor.' }));
      return;
    }
    const domBase = 'https://api-dgii.dominicantechnology.com/api/v1';

    let targetUrl = '';
    if (rnc) {
      targetUrl = `${domBase}/rnc/${encodeURIComponent(rnc)}`;
    } else if (q) {
      targetUrl = q.length >= 4
        ? `${domBase}/buscardgi?q=${encodeURIComponent(q)}`
        : `${domBase}/buscar?q=${encodeURIComponent(q)}`;
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ exito: false, mensaje: 'Parámetro rnc o q faltante' }));
      return;
    }

    https.get(targetUrl, {
      headers: {
        'Authorization': `Bearer ${domToken}`,
        'Accept': 'application/json'
      }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    }).on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ exito: false, mensaje: err.message }));
    });
    return;
  }

  let reqPath = '/';
  try {
    reqPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (_) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const relativePath = reqPath.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relativePath);

  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  const blockedTopSegments = new Set([
    '.git', '.env', 'node_modules', 'ReciminsaApp', 'android',
    'main.js', 'dev-server.js', 'build.js', 'package.json',
    'package-lock.json', 'n8nac-config.json', 'InnoSetupScript_MAUI.iss',
    'forge.config.js', 'LICENSE.txt'
  ]);
  const topSegment = path.relative(ROOT, filePath).split(path.sep)[0] || '';
  if (
    topSegment.startsWith('.env') ||
    blockedTopSegments.has(topSegment) ||
    filePath.toLowerCase().endsWith('.sql')
  ) {
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

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor local activo en http://localhost:${PORT}`);
});
