const fs = require('node:fs');
const path = require('node:path');
require('./build');
fs.copyFileSync(path.join(__dirname, '../dist/Index.html'), path.join(__dirname, '../demo.html'));
console.log('demo.html exportado. Abra no Chrome ou Edge para testar com dados fictícios.');
