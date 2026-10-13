const {test}=require('node:test');
const assert=require('node:assert/strict');
const I=require('../src/domain/catalog-import');
const source='https://www.gov.br/exemplo-ficticio';
const one=()=>({records:[{ca:'00123',name:'Luva fictícia',approvedProtection:'Proteção das mãos contra agentes químicos',caExpiry:'2030-12-31'}],source,referenceDate:'01/01/2026'});
test('CSV BOM, separador, aspas escapadas e quebra de linha dentro de campo',()=>{
 const p=I.parse('\uFEFFCA;Equipamento;Aprovado para;Data de validade\r\n123;"Luva; \"\"fictícia\"\"";"Proteção das mãos\ncontra agentes químicos";31/12/2030\r\n',';');
 assert.equal(p.rows.length,1);assert.equal(p.rows[0][1],'Luva; "fictícia"');assert.deepEqual(I.suggest(p.headers),{ca:0,name:1,approvedProtection:2,caExpiry:3});
 const result=I.fromCsv(p,{ca:0,name:1,approvedProtection:2,caExpiry:3},{source,referenceDate:'01/01/2026'});assert.equal(result.groups.dermica,1);
});
test('CSV vírgula, tabulação e linhas vazias',()=>{assert.equal(I.parse('ca,name\n1,Teste\n\n',',').rows.length,1);assert.equal(I.parse('ca\tname\n1\tTeste','\t').rows.length,1);});
test('CSV inválido não é parcialmente aceito',()=>{
 for(const text of ['CA;nome\n1;"aberto','CA;nome\n1;"fechado"extra','CA;nome\n1;a;b','CA;CA\n1;2'])assert.throws(()=>I.parse(text,';'));
});
test('normalização CA e data ISO com validação de data real',()=>{const r=I.prepare(one());assert.equal(r.records[0].ca,'123');assert.equal(r.records[0].caExpiry,'31/12/2030');const p=one();p.records[0].caExpiry='2026-02-31';assert.throws(()=>I.prepare(p),/Registro 1/);});
test('duplicata normalizada, CA inválido e nome ausente bloqueiam base',()=>{
 const p=one();p.records.push({...p.records[0],ca:'123'});assert.throws(()=>I.prepare(p),/duplicado/);
 for(const ca of ['=1+1','0','ABC']){const p=one();p.records[0].ca=ca;assert.throws(()=>I.prepare(p));}
 const empty=one();empty.records[0].name='';assert.throws(()=>I.prepare(empty));
});
test('origem oficial, referência futura e formato de data inválido',()=>{
 for(const url of ['http://www.gov.br/x','https://gov.br.evil.example/x','https://evil.example/?gov.br','https://www.gov.br@evil.example/x']){const p=one();p.source=url;assert.throws(()=>I.prepare(p),/oficial/);}
 const p=one();p.referenceDate='02/01/2026';assert.throws(()=>I.prepare(p,Date.UTC(2026,0,1)),/futuro/);
 p.referenceDate='2026-01-01';assert.throws(()=>I.prepare(p));
});
test('campos ausentes geram aviso e revisão, sem vida útil presumida',()=>{const p=one();p.records[0].approvedProtection='';p.records[0].caExpiry='';const r=I.prepare(p);assert.equal(r.groups.revisao,1);assert.equal(r.warnings.length,1);});
test('mapeamento precisa de quatro colunas diferentes',()=>{const p=I.parse('A;B;C;D\n1;Nome;Proteção;31/12/2030',';');assert.throws(()=>I.fromCsv(p,{ca:0,name:0,approvedProtection:2,caExpiry:3},{source,referenceDate:'01/01/2026'}));});
test('nome de EPI fora do escopo não exige proteção nem gera aviso de revisão',()=>{const p=one();p.records[0].name='ÓCULOS';p.records[0].approvedProtection='';const r=I.prepare(p);assert.equal(r.groups.outros,1);assert.equal(r.warnings.length,0);});
