const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
for (const [source, target] of [['src/domain/reports.js','ReportDomain.gs'], ['src/domain/analysis.js','Domain.gs'], ['src/domain/official-updates.js','UpdateDomain.gs'], ['src/server/official-updates.js','OfficialUpdates.gs'], ['src/server/default-catalog.js','DefaultCatalog.gs'], ['src/domain/catalog-import.js','ImportDomain.gs'], ['src/server/setup.js','Setup.gs'], ['src/server/store.js','Store.gs'], ['src/server/catalog.js','Catalog.gs'], ['src/server/api.js','Api.gs'], ['src/appsscript.json','appsscript.json']]) fs.writeFileSync(path.join(out, target), read(source));
const logoNames = ['sesi-logo.png','sesi-logo.svg','sesi-logo.jpg'];
const rootLogo = ['SESI_logo.png','logo-sesi.png','logo-sesi.svg','logo-sesi.jpg'].find(name => fs.existsSync(path.join(root,name)));
const logoName = rootLogo || logoNames.find(name => fs.existsSync(path.join(root,'src/web/assets',name)));
const logoFile = logoName && path.join(root,rootLogo ? '' : 'src/web/assets',logoName);
const logoType = logoName && (logoName.endsWith('.svg') ? 'image/svg+xml' : logoName.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
const brand = {logo:logoName ? 'data:'+logoType+';base64,'+fs.readFileSync(logoFile).toString('base64') : ''};
const html = read('src/web/Index.html').replace('/*__CSS__*/', () => read('src/web/styles.css')).replace('/*__DOMAIN__*/', () => read('src/domain/analysis.js')).replace('/*__IMPORT__*/', () => read('src/domain/catalog-import.js')).replace('/*__CATALOG_UI__*/', () => read('src/web/catalog-ui.js')).replace('/*__REPORT_DOMAIN__*/', () => read('src/domain/reports.js')).replace('/*__BRAND__*/', () => 'var EpiBrand = '+JSON.stringify(brand)+';').replace('/*__RESULT_UI__*/', () => read('src/web/results-ui.js')).replace('/*__APP__*/', () => read('src/web/app.js'));
fs.writeFileSync(path.join(out,'Index.html'),html);

const crypto = require('node:crypto');
const manifest = JSON.parse(read('data/default-ca/manifest.json'));
manifest.classificationCounts = {auditiva:0,dermica:0,outros:0,revisao:0};
const classification = require('../src/domain/analysis');
const chunks = manifest.chunks.map(entry => {
  const blob = fs.readFileSync(path.join(root,'data/default-ca',entry.file));
  if(crypto.createHash('sha256').update(blob).digest('hex') !== entry.sha256) throw new Error('Checksum inválido: '+entry.file);
  for (const [,name,approvedProtection] of JSON.parse(require('node:zlib').gunzipSync(blob))) manifest.classificationCounts[classification.classify({name,approvedProtection})]++;
  return blob.toString('base64');
});
fs.writeFileSync(path.join(out,'DefaultData.gs'),'// Generated from projected CA fields only. Do not edit.\nvar EpiBundledBase = '+JSON.stringify({manifest,chunks},null,2)+';\n');
console.log('Build concluído em dist/ (Apps Script, base padrão e demonstração local).');
