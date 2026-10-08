const fs = require('node:fs');
const path = require('node:path');
require('./build');
const destination = path.join(__dirname,'../google-apps-script');
fs.mkdirSync(destination,{recursive:true});
for (const file of ['Domain.gs','ImportDomain.gs','Store.gs','Catalog.gs','Api.gs','Setup.gs','Index.html','appsscript.json']) {
  fs.copyFileSync(path.join(__dirname,'../dist',file),path.join(destination,file));
}
console.log('Pacote para o editor Google gerado em google-apps-script/. Não houve conexão ou publicação.');
