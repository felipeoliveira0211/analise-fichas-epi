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
test('EPIs fora do escopo identificados pelo nome dispensam proteção aprovada',()=>{
 for(const name of ['CAPACETE CLASSE B','ÓCULOS','VESTIMENTA TIPO AVENTAL','RESPIRADOR PFF2','LUVA PARA PROTEÇÃO CONTRA AGENTES MECÂNICOS','LUVA PARA PROTEÇÃO CONTRA AGENTES TÉRMICOS E MECÂNICOS','LUVA PARA PROCEDIMENTOS NÃO-CIRÚRGICOS']) assert.equal(D.classify({name}), 'outros',name);
 const result=D.analyze(sheet([[81,'01/01/2026'],[81,'01/02/2026']]),{'81':{name:'VESTIMENTA TIPO AVENTAL'}},{},{});
 assert.equal(result.warnings.length,0);assert.equal(result.rows[1].interval,null);assert.equal(result.rows[1].status,'Sem análise de periodicidade');
});
test('nomes de grupos analisados ou indefinidos continuam pendentes sem proteção',()=>{
 for(const name of ['PROTETOR AUDITIVO','CREME PROTETOR DE SEGURANÇA','LUVA','LUVA PARA PROTEÇÃO CONTRA AGENTES QUÍMICOS','LUVA PARA PROTEÇÃO CONTRA AGENTES MECÂNICOS E QUÍMICOS','CONJUGADO TIPO CAPACETE, PROTETOR FACIAL E PROTETOR AUDITIVO','Nome do EPI indisponível: revisar arquivo original','EPI não especificado']) assert.equal(D.classify({name}), 'revisao',name);
 assert.equal(D.classify({name:'CAPACETE',approvedProtection:'Proteção auditiva contra ruído'}),'auditiva');
});
test('validade antiga não comprova CA atualmente vencido ou ausência de renovação',()=>{
 const s=sheet([[13990,'13/10/2026']]),old={'13990':{name:'PERNEIRA',caExpiry:'22/08/2023'}};
 const result=D.analyze(s,old,{},{});assert.equal(result.stale,true);assert.match(result.rows[0].caAtDelivery,/confirmar renovação/);assert.equal(result.rows[0].status,'Sem análise de periodicidade');
 const updated=D.analyze(s,{'13990':{name:'PERNEIRA',caExpiry:'22/08/2028'}},{},{});assert.match(updated.rows[0].caAtDelivery,/Entrega até/);assert.equal(updated.rows[0].caExpiry,'22/08/2028');
});
test('validade de CA aceita 3031 sem ampliar o intervalo permitido nas entregas',()=>{assert.equal(D.certificateDate('26/05/3031'),Date.UTC(3031,4,26));assert.throws(()=>D.date('26/05/3031'),/2100/);assert.throws(()=>D.certificateDate('31/02/3031'),/inexistente/);});
test('CA vencido usa hoje e não a data histórica da entrega',()=>{
 const result=D.analyze(sheet([[1,'01/01/2020']]),{'1':{name:'Capacete',caExpiry:'12/10/2026',caSituation:'VÁLIDO'}},{},{},Date.UTC(2026,9,13,15));assert.equal(result.rows[0].caStatus,'CA vencido');assert.equal(result.rows[0].caTone,'bad');assert.equal(result.rows[0].status,'Sem análise de periodicidade');
});
test('vencimento próximo inclui dias zero a trinta, com limite no fuso de Brasília',()=>{
 const now=Date.UTC(2026,9,13,15);
 for(const [expiry,label]of[['13/10/2026','Próximo ao vencimento'],['12/11/2026','Próximo ao vencimento'],['13/11/2026','CA válido'],['12/10/2026','CA vencido']])assert.equal(D.certificateStatus({caExpiry:expiry,caSituation:'VÁLIDO'},now).label,label);
 assert.equal(D.certificateStatus({caExpiry:'13/10/2026',caSituation:'VENCIDO'},now).label,'Próximo ao vencimento');
 assert.equal(D.certificateStatus({caExpiry:'12/10/2026',caSituation:'VÁLIDO'},Date.UTC(2026,9,13,1)).label,'Próximo ao vencimento');
});
test('situação suspensa e cancelada prevalece sobre validade futura e aviso de proximidade',()=>{
 const now=Date.UTC(2026,9,13,15);assert.equal(D.certificateStatus({caExpiry:'13/01/2030',caSituation:'SUSPENSO'},now).label,'CA suspenso');assert.equal(D.certificateStatus({caExpiry:'14/10/2026',caSituation:'CANCELADO'},now).label,'CA cancelado');assert.equal(D.certificateStatus({caExpiry:'26/05/3031',caSituation:'VÁLIDO'},now).label,'CA válido');
});
test('proteção dérmica limita-se a luvas e cremes químicos e ignora outras entregas na sequência',()=>{
 const protection='Proteção da pele e membros superiores contra agentes químicos';
 for(const name of ['Manga','Mangote','Vestimenta','Avental'])assert.equal(D.classify({name,approvedProtection:protection}),'outros');
 for(const name of ['Luvas de segurança','Creme protetor'])assert.equal(D.classify({name,approvedProtection:protection}),'dermica');
 const rows=D.analyze(sheet([[3,'01/01/2026'],[7,'15/01/2026'],[4,'01/02/2026']]),{...catalog,7:{name:'Manga',approvedProtection:protection}}, {},{}).rows;
 assert.equal(rows[1].status,'Sem análise de periodicidade');assert.equal(rows[2].interval,31);assert.equal(rows[2].status,'Fora do prazo');
});
