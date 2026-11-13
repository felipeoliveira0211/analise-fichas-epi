const {test}=require('node:test');const assert=require('node:assert/strict');
global.ExcelJS=require('exceljs');global.EpiDomain=require('../src/domain/analysis');
const X=require('../src/web/spreadsheets');
function filled(){const w=X.template();w.getWorksheet('Entregas').addRow(['A','Empresa','Pessoa','Setor','Cargo','GES','90001','01/01/2026']);return w;}
test('modelo XLSX preserva cabeçalhos e importa entregas agrupadas sem mesclar homônimos',async()=>{
 const w=filled(),s=w.getWorksheet('Entregas');s.addRow(['A','Empresa','Pessoa','Setor','Cargo','GES',90001,new Date('2026-05-01T00:00:00Z')]);s.addRow(['B','Empresa','Pessoa','Setor','Cargo','GES','90002','01/02/2026']);
 const copy=new ExcelJS.Workbook();await copy.xlsx.load(await w.xlsx.writeBuffer());const result=X.parse(copy,'imp-test',EpiDomain);assert.equal(result.count,3);assert.equal(result.sheets.length,2);assert.equal(result.sheets[0].entries[1].date,'01/05/2026');assert.notEqual(result.sheets[0].worker.id,result.sheets[1].worker.id);
});
test('validação informa linha e rejeita duplicatas, datas inválidas, divergências e fórmulas',()=>{
 for(const [col,value,pattern] of [[8,'31/02/2026',/Linha 2/],[7,{formula:'1+1',result:2},/Fórmulas/],[2,'',/Preencha/]]){const w=filled();w.getWorksheet('Entregas').getRow(2).getCell(col).value=value;assert.throws(()=>X.parse(w,'x',EpiDomain),pattern);}
 const w=filled(),s=w.getWorksheet('Entregas');s.addRow(['A','Empresa','Pessoa','Setor','Cargo','GES','90001','01/01/2026']);assert.throws(()=>X.parse(w,'x',EpiDomain),/Linha 3.*duplicada/);s.getRow(3).getCell(3).value='Outra';assert.throws(()=>X.parse(w,'x',EpiDomain),/divergentes/);
 assert.throws(()=>X.parse(X.template(),'x',EpiDomain),/não contém/);
});
test('matriz XLSX contém logo, grupos em ordem, datas e texto sem fórmulas',async()=>{
 const result={generatedAt:'2026-11-13',filters:{company:'Teste'},reports:[{sheetId:'s',worker:{name:'=1+1',sector:'S',company:'C',role:'R',ges:'G'},rows:[{group:'dermica',ca:'2',date:'02/01/2026',name:'Luva',interval:1,limit:30,status:'Dentro do prazo'},{group:'auditiva',ca:'1',date:'01/01/2026',name:'Protetor',status:'Marco inicial'},{group:'revisao',ca:'3',date:'03/01/2026',name:'Desconhecido',status:'Revisão necessária'}]}]};
 const fs=require('node:fs');const w=X.matrix(result,'data:image/png;base64,'+fs.readFileSync('SESI_logo.png').toString('base64'));
 const copy=new ExcelJS.Workbook();await copy.xlsx.load(await w.xlsx.writeBuffer());const s=copy.worksheets[0];assert.equal(s.getImages().length,1);assert.equal(s.getCell('G4').value,'Proteção auditiva');assert.equal(s.getCell('O4').value,'Proteção dérmica');assert.equal(s.getCell('W4').value,'Outras entregas');assert.equal(s.getCell('A6').value,'=1+1');assert.equal(s.getCell('G6').value,'1');assert.equal(s.getCell('P6').value,'02/01/2026');assert.equal(s.getCell('W6').value,'3');
});
