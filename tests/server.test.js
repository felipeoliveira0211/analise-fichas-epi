const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const D = require('../src/domain/analysis');
function setup() {
 const tables={Workers:[],Sheets:[],Entries:[],Lifetimes:[],CaIndex:[],Metadata:[]};
 const context=vm.createContext({EpiDomain:D,EpiStore:{rows:n=>structuredClone(tables[n]),replace:(n,v)=>{tables[n]=structuredClone(v)},locked:fn=>fn()}});
 for(const file of ['catalog','api']) vm.runInContext(fs.readFileSync(`src/server/${file}.js`,'utf8'),context);
 return {context,tables};
}
const input=()=>({id:'s1',worker:{id:'w1',name:'Pessoa fictícia',sector:'Setor',role:'Cargo',ges:'GES A'},state:'draft',revision:0,entries:[{id:'e1',ca:'1',date:'01/01/2026'}]});
test('salvar parcialmente, retomar, atualizar sem duplicar',()=>{const {context:c,tables:t}=setup();const s=input();s.revision=c.epiSaveSheet(s).revision;const loaded=c.epiLoadSheet('s1');assert.equal(loaded.entries[0].date,s.entries[0].date);assert.equal(loaded.worker.ges,'GES A');s.state='complete';c.epiSaveSheet(s);assert.equal(t.Sheets.length,1);assert.equal(t.Workers.length,1);assert.equal(t.Entries.length,1);assert.equal(c.epiListSheets()[0].state,'complete');});
test('conflito de revisão não sobrescreve ficha',()=>{const {context:c,tables:t}=setup();c.epiSaveSheet(input());assert.throws(()=>c.epiSaveSheet(input()),/outra sessão/);assert.equal(t.Sheets[0].revision,1);});
test('vida útil permanece independente da atualização da base',()=>{const {context:c,tables:t}=setup();c.epiSaveLifetime('0001',30);t.CaIndex=[{ca:'1',name:'CA fictício',approvedProtection:'Proteção auditiva'}];t.Metadata=[{source:'Fonte fictícia',referenceDate:'01/01/2026'}];c.epiSaveLifetime('1',60);assert.equal(t.Lifetimes.length,1);assert.equal(c.epiBootstrap().lifetimes['1'],60);c.epiDeleteLifetime('1');assert.equal(t.Lifetimes.length,0);});
test('falha parcial restaura versão anterior (mock)',()=>{const {context:c,tables:t}=setup();c.epiSaveSheet(input());const original=JSON.stringify(t);const replace=c.EpiStore.replace;let once=true;c.EpiStore.replace=(n,v)=>{if(n==='Sheets' && once){once=false;throw new Error('falha simulada');}replace(n,v)};const s=input();s.revision=1;s.worker.name='Outra pessoa fictícia';assert.throws(()=>c.epiSaveSheet(s),/restaurada/);assert.equal(JSON.stringify(t),original);});
