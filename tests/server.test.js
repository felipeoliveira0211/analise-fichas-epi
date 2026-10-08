const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const D = require('../src/domain/analysis');
const I = require('../src/domain/catalog-import');
const crypto = require('node:crypto');
function setup() {
 const tables={Workers:[],Sheets:[],Entries:[],Lifetimes:[],CaIndex:[],Metadata:[]};
 const context=vm.createContext({EpiDomain:D,EpiImport:I,Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,text)=>Array.from(crypto.createHash('sha256').update(text).digest())},EpiStore:{rows:n=>structuredClone(tables[n]),count:n=>tables[n].length,connection:()=>({connected:true,caCount:tables.CaIndex.length}),replace:(n,v)=>{tables[n]=structuredClone(v)},locked:fn=>fn()}});
 for(const file of ['catalog','api','setup']) vm.runInContext(fs.readFileSync(`src/server/${file}.js`,'utf8'),context);
 return {context,tables};
}
const input=()=>({id:'s1',worker:{id:'w1',name:'Pessoa fictícia',sector:'Setor',role:'Cargo',ges:'GES A'},state:'draft',revision:0,entries:[{id:'e1',ca:'1',date:'01/01/2026'}]});
test('salvar parcialmente, retomar, atualizar sem duplicar',()=>{const {context:c,tables:t}=setup();const s=input();s.revision=c.epiSaveSheet(s).revision;const loaded=c.epiLoadSheet('s1');assert.equal(loaded.entries[0].date,s.entries[0].date);assert.equal(loaded.worker.ges,'GES A');s.state='complete';c.epiSaveSheet(s);assert.equal(t.Sheets.length,1);assert.equal(t.Workers.length,1);assert.equal(t.Entries.length,1);assert.equal(c.epiListSheets()[0].state,'complete');});
test('conflito de revisão não sobrescreve ficha',()=>{const {context:c,tables:t}=setup();c.epiSaveSheet(input());assert.throws(()=>c.epiSaveSheet(input()),/outra sessão/);assert.equal(t.Sheets[0].revision,1);});
test('vida útil permanece independente da atualização da base',()=>{const {context:c,tables:t}=setup();c.epiSaveLifetime('0001',30);t.CaIndex=[{ca:'1',name:'CA fictício',approvedProtection:'Proteção auditiva'}];t.Metadata=[{source:'Fonte fictícia',referenceDate:'01/01/2026'}];c.epiSaveLifetime('1',60);assert.equal(t.Lifetimes.length,1);assert.equal(c.epiBootstrap().lifetimes['1'],60);c.epiDeleteLifetime('1');assert.equal(t.Lifetimes.length,0);});
test('falha parcial restaura versão anterior (mock)',()=>{const {context:c,tables:t}=setup();c.epiSaveSheet(input());const original=JSON.stringify(t);const replace=c.EpiStore.replace;let once=true;c.EpiStore.replace=(n,v)=>{if(n==='Sheets' && once){once=false;throw new Error('falha simulada');}replace(n,v)};const s=input();s.revision=1;s.worker.name='Outra pessoa fictícia';assert.throws(()=>c.epiSaveSheet(s),/restaurada/);assert.equal(JSON.stringify(t),original);});
const imported=()=>({records:[{ca:'1',name:'CA fictício',approvedProtection:'Proteção auditiva contra ruído',caExpiry:'31/12/2030'}],source:'https://www.gov.br/exemplo-ficticio',referenceDate:'01/01/2026'});
test('prévia não grava; importação preserva trabalhadores, fichas e vida útil',()=>{
 const {context:c,tables:t}=setup();c.epiSaveSheet(input());c.epiSaveLifetime('1',30);const before=JSON.stringify({workers:t.Workers,sheets:t.Sheets,entries:t.Entries,lifetimes:t.Lifetimes});
 const preview=c.epiPreviewCatalog(imported());assert.equal(t.CaIndex.length,0);assert.equal(preview.count,1);
 c.epiImportCatalog(imported(),preview);assert.equal(t.CaIndex[0].ca,'1');assert.equal(t.Metadata[0].source,'https://www.gov.br/exemplo-ficticio');assert.equal(JSON.stringify({workers:t.Workers,sheets:t.Sheets,entries:t.Entries,lifetimes:t.Lifetimes}),before);
 assert.equal(c.epiAnalyzeSheet(input()).rows[0].group,'auditiva');assert.deepEqual(Object.keys(c.epiBootstrap().catalog),[]);
});
test('arquivo alterado ou revisão desatualizada exige nova prévia',()=>{
 const {context:c,tables:t}=setup();const preview=c.epiPreviewCatalog(imported());const changed=imported();changed.records[0].name='Outro nome fictício';assert.throws(()=>c.epiImportCatalog(changed,preview),/Arquivo alterado/);
 t.Metadata=[{updatedAt:'revision-changed'}];assert.throws(()=>c.epiImportCatalog(imported(),preview),/outra sessão/);assert.equal(t.CaIndex.length,0);
});
test('falha ao importar recupera catálogo e metadados anteriores',()=>{
 const {context:c,tables:t}=setup();t.CaIndex=[{ca:'2',name:'Registro fictício anterior'}];t.Metadata=[{source:'Origem anterior',updatedAt:'old'}];const before=JSON.stringify(t);const preview=c.epiPreviewCatalog(imported());
 const replace=c.EpiStore.replace;let fail=true;c.EpiStore.replace=(n,v)=>{if(n==='Metadata'&&fail){fail=false;throw new Error('erro simulado')}replace(n,v)};
 assert.throws(()=>c.epiImportCatalog(imported(),preview),/restaurada/);assert.equal(JSON.stringify(t),before);
});
test('base vazia bloqueia análise real, sem carregar catálogo fictício',()=>{const {context:c}=setup();assert.throws(()=>c.epiAnalyzeSheet(input()),/Base de CAs vazia/);});
test('empresa e horário são persistidos; horário de entrada inalterada é preservado',()=>{
 const {context:c,tables:t}=setup(),s=input();s.worker.company='Empresa fictícia';const result=c.epiSaveSheet(s);assert.equal(t.Workers[0].company,s.worker.company);assert.equal(c.epiLoadSheet(s.id).updatedAt,result.updatedAt);assert.equal(t.Entries[0].savedAt,result.entries[0].savedAt);assert.ok(/^\d{4}-/.test(t.Entries[0].savedAt));
 t.Entries[0].savedAt='2020-01-01T00:00:00.000Z';s.revision=result.revision;s.entries[0].savedAt='forged';c.epiSaveSheet(s);assert.equal(t.Entries[0].savedAt,'2020-01-01T00:00:00.000Z');s.revision=2;s.entries[0].date='02/01/2026';c.epiSaveSheet(s);assert.notEqual(t.Entries[0].savedAt,'2020-01-01T00:00:00.000Z');
});
test('relatório Google usa dados persistidos e relatório local usa rascunhos sem gravar',()=>{
 const {context:c,tables:t}=setup();c.EpiReports=require('../src/domain/reports');const s=input();s.worker.company='Empresa A';s.entries.push({id:'e2',ca:'1',date:'01/02/2026'});c.epiSaveSheet(s);c.epiSaveLifetime('1',30);t.CaIndex=imported().records;t.Metadata=[{source:'Fonte',referenceDate:'01/01/2026'}];
 const before=JSON.stringify(t);const filter={start:'2026-02-01',end:'2026-02-01',company:'empresa a'};const result=c.epiGenerateReports(filter);assert.equal(result.reports[0].rows[0].interval,31);assert.ok(result.reports[0].rows[0].savedAt);
 s.worker.company='Empresa B';assert.equal(c.epiGenerateReports({company:'B'},[s]).reports.length,1);assert.equal(c.epiGenerateReports({company:'B'}).reports.length,0);assert.equal(JSON.stringify(t),before);
});
