/* =============================================
   PORTAL DE CLIENTES - Local Dev Server
   ============================================= */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3333;

// Import API routes
const apiApp = require('./api/index.js');
app.use(apiApp);

// Serve static web files
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html']
}));

app.listen(PORT, () => {
  console.log('');
  console.log('  ♻️ Portal de Clientes API');
  console.log(`  🌐 http://localhost:${PORT}`);
  console.log('');
});
