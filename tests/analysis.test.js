const {test} = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/domain/analysis');
const catalog = {
  1: {name:'Auditivo A', approvedProtection:'Proteção auditiva contra ruído', caExpiry:'31/12/2030'},
  2: {name:'Auditivo B', approvedProtection:'Proteção do sistema auditivo'},
  3: {name:'Luva química', approvedProtection:'Proteção das mãos contra agentes químicos'},
  4: {name:'Creme', approvedProtection:'Proteção da pele contra agentes químicos'},
  5: {name:'Luva mecânica', approvedProtection:'Proteção das mãos contra agentes abrasivos'},
  6: {name:'Capacete', approvedProtection:'Proteção do crânio contra impactos'}
};
function sheet(entries) {return {id:'sheet1',worker:{id:'worker1',name:'Pessoa fictícia',sector:'Setor fictício',role:'Cargo fictício',ges:'GES fictício'}, entries:entries.map(([ca,date],i)=>({id:'e'+i,ca:String(ca),date}))};}
function run(entries,life={1:30,2:60}) {return D.analyze(sheet(entries),catalog,life,{}).rows;}
test('primeira entrega sem intervalo',()=>{const r=run([[1,'01/01/2026']])[0];assert.equal(r.interval,null);assert.equal(r.status,'Marco inicial');});
test('duas entregas: intervalo correto e limite inclusivo',()=>{const r=run([[1,'01/01/2026'],[1,'31/01/2026']])[1];assert.equal(r.interval,30);assert.equal(r.status,'Dentro do prazo');});
test('três entregas consecutivas reiniciam contagem, sem acumulação',()=>{const r=run([[1,'01/01/2026'],[1,'11/01/2026'],[1,'15/02/2026']]);assert.deepEqual(r.map(x=>x.interval),[null,10,35]);assert.equal(r[2].status,'Fora do prazo');});
test('entrega antecipada',()=>assert.equal(run([[1,'01/01/2026'],[1,'02/01/2026']])[1].status,'Dentro do prazo'));
test('entrega fora do prazo',()=>assert.equal(run([[1,'01/01/2026'],[1,'01/02/2026']])[1].status,'Fora do prazo'));
test('mudança de CA auditivo mantém sequência',()=>{const r=run([[1,'01/01/2026'],[2,'31/01/2026']])[1];assert.equal(r.previousCa,'1');assert.equal(r.interval,30);});
test('vida útil usa CA anterior e muda na entrega seguinte',()=>{const r=run([[1,'01/01/2026'],[2,'01/02/2026'],[1,'15/03/2026']]);assert.equal(r[1].limit,30);assert.equal(r[1].status,'Fora do prazo');assert.equal(r[2].limit,60);assert.equal(r[2].status,'Dentro do prazo');});
test('luva seguida de creme, limite fixo',()=>{const r=run([[3,'01/01/2026'],[4,'31/01/2026']],{3:1})[1];assert.equal(r.limit,30);assert.equal(r.status,'Dentro do prazo');});
test('creme seguido de luva fora do prazo',()=>assert.equal(run([[4,'01/01/2026'],[3,'01/02/2026']])[1].status,'Fora do prazo'));
test('datas fora de ordem preservam entrada original',()=>{const s=sheet([[1,'31/01/2026'],[1,'01/01/2026']]);const before=JSON.stringify(s);const r=D.analyze(s,catalog,{1:30});assert.equal(r.rows[0].id,'e1');assert.equal(r.rows[1].interval,30);assert.equal(JSON.stringify(s),before);});
test('datas inválidas e anos bissextos',()=>{for(const date of ['31/02/2026','29/02/2025','00/01/2026','01/13/2026','2026-01-01']) assert.throws(()=>run([[1,date]]));assert.equal(D.date('29/02/2024'),Date.UTC(2024,1,29));});
test('mesmo dia: intervalo zero e ordenação estável',()=>{const r=run([[1,'01/01/2026'],[2,'01/01/2026']]);assert.equal(r[1].interval,0);assert.equal(r[0].id,'e0');assert.equal(r[1].status,'Dentro do prazo');});
test('CA sem vida útil não presume conformidade',()=>{const r=run([[2,'01/01/2026'],[1,'02/01/2026']],{})[1];assert.equal(r.limit,null);assert.equal(r.status,'Vida útil não cadastrada');});
test('CA não identificado sinaliza análise parcial',()=>{const r=D.analyze(sheet([[999,'01/01/2026']]),catalog,{});assert.equal(r.rows[0].group,'revisao');assert.equal(r.rows[0].status,'Revisão manual necessária');assert.equal(r.warnings.length,1);});
test('categorias intercaladas têm sequências independentes',()=>{const r=run([[1,'01/01/2026'],[3,'05/01/2026'],[5,'06/01/2026'],[2,'31/01/2026'],[4,'05/02/2026']]);assert.deepEqual(r.map(x=>x.interval),[null,null,null,30,31]);assert.equal(r[2].group,'outros');assert.equal(r[4].status,'Fora do prazo');});
test('luva mecânica não é classificada como química; descrição insuficiente requer revisão',()=>{assert.equal(D.classify(catalog[5]),'outros');assert.equal(D.classify({name:'Luva química'}),'revisao');});
test('trabalhadores são isolados',()=>{assert.equal(run([[1,'01/01/2026']])[0].interval,null);assert.equal(run([[2,'02/01/2026']])[0].interval,null);});
test('validade física independente da validade do CA',()=>{const r=run([[1,'01/01/2026']])[0];assert.equal(r.caExpiry,'31/12/2030');assert.equal(r.physicalExpiry,null);});
test('metadados ausentes/antigos exigem confirmação',()=>{const s=sheet([[1,'01/01/2026']]);assert.equal(D.analyze(s,catalog,{}).stale,true);assert.equal(D.analyze(s,catalog,{}, {source:'Fonte fictícia',referenceDate:'01/01/2026'},Date.UTC(2026,0,15)).stale,false);assert.equal(D.analyze(s,catalog,{}, {source:'Fonte fictícia',referenceDate:'01/01/2026'},Date.UTC(2026,2,15)).stale,true);});
test('validação de CA, IDs e prazo',()=>{assert.throws(()=>D.ca('=1+1'));assert.equal(D.ca('000123'),'123');assert.equal(D.validLife(1.5),false);const s=sheet([[1,'01/01/2026'],[1,'02/01/2026']]);s.entries[1].id=s.entries[0].id;assert.throws(()=>D.validateSheet(s));});
