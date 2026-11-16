const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../src/web/session-cache');
function sheet(id){return {id,worker:{name:'Pessoa'},state:'draft',revision:2,entries:[{id:'e',ca:'1',date:'01/01/2026'}]};}
test('expira somente cópias antigas confirmadas na mesma revisão; preserva ficha aberta e rascunhos',()=>{
 const now=10*C.TTL,sheets=['old','open','dirty','fresh','legacy','conflict','missing'].map(sheet);
 sheets.forEach(s=>C.confirm(s,s,0));C.dirty(sheets[2]);C.confirm(sheets[3],sheets[3],now);delete sheets[4].localSync;
 const saved=sheets.filter(s=>s.id!=='missing').map(s=>({id:s.id,revision:s.id==='conflict'?3:2}));
 assert.deepEqual(C.prune(sheets,saved,'open',now).map(s=>s.id),['open','dirty','fresh','legacy','conflict','missing']);assert.equal(sheets.length,7);
});
test('edição durante gravação não recebe confirmação; cópia inalterada recebe prazo',()=>{
 const s=sheet('s'),submitted=structuredClone(s);s.worker.name='Editado';C.confirm(s,submitted,100);assert.equal(s.localSync,null);C.confirm(s,s,200);assert.equal(s.localSync.confirmedAt,200);C.dirty(s);assert.equal(s.localSync,null);
});

test('quantidade alterada durante gravação não pode receber confirmação de cópia antiga',()=>{
 const s=sheet('s'),submitted=structuredClone(s);s.entries[0].quantity=3;C.confirm(s,submitted,100);assert.equal(s.localSync,null);
 const legacy=sheet('s'),normalized=structuredClone(legacy);normalized.entries[0].quantity=1;C.confirm(legacy,normalized,100);assert.equal(legacy.localSync.confirmedAt,100);
});
