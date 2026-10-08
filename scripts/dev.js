const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
require('./build');
http.createServer((req,res) => {
  if (req.url !== '/' && req.url !== '/Index.html') { res.writeHead(404); res.end('Não encontrado'); return; }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  res.end(fs.readFileSync(path.join(__dirname,'../dist/Index.html')));
}).listen(3000,'127.0.0.1', () => console.log('Demonstração local na porta 3000, restrita ao próprio ambiente.'));
