const {test}=require('node:test');const assert=require('node:assert/strict');
global.ExcelJS=require('exceljs');global.EpiDomain=require('../src/domain/analysis');
const X=require('../src/web/spreadsheets');
function filled(){const w=X.template();w.getWorksheet('Entregas').addRow(['A','Empresa','Pessoa','Setor','Cargo','GES','90001','01/01/2026']);return w;}
test('modelo XLSX preserva cabeçalhos e importa entregas agrupadas sem mesclar homônimos',async()=>{
 const w=filled(),s=w.getWorksheet('Entregas');s.addRow(['A','Empresa','Pessoa','Setor','Cargo','GES',90001,new Date('2026-05-01T00:00:00Z')]);s.addRow(['B','Empresa','Pessoa','Setor','Cargo','GES','90002','01/02/2026']);
 const copy=new ExcelJS.Workbook();await copy.xlsx.load(await w.xlsx.writeBuffer());const result=X.parse(copy,'imp-test',EpiDomain);assert.equal(result.count,3);assert.equal(result.sheets.length,2);assert.equal(result.sheets[0].entries[1].date,'01/05/2026');assert.notEqual(result.sheets[0].worker.id,result.sheets[1].worker.id);
});
test('validação informa linha e aceita repetições e rejeita datas inválidas, divergências e fórmulas',()=>{
 for(const [col,value,pattern] of [[8,'31/02/2026',/Linha 2/],[7,{formula:'1+1',result:2},/Fórmulas/],[2,'',/Preencha/]]){const w=filled();w.getWorksheet('Entregas').getRow(2).getCell(col).value=value;assert.throws(()=>X.parse(w,'x',EpiDomain),pattern);}
 const w=filled(),s=w.getWorksheet('Entregas');s.addRow(['A','Empresa','Pessoa','Setor','Cargo','GES','90001','01/01/2026']);const repeated=X.parse(w,'x',EpiDomain);assert.equal(repeated.count,2);assert.notEqual(repeated.sheets[0].entries[0].id,repeated.sheets[0].entries[1].id);s.getRow(3).getCell(3).value='Outra';assert.throws(()=>X.parse(w,'x',EpiDomain),/divergentes/);
 assert.throws(()=>X.parse(X.template(),'x',EpiDomain),/não contém/);
});
test('matriz XLSX contém logo, grupos em ordem, datas e texto sem fórmulas',async()=>{
 const result={generatedAt:'2026-11-13',filters:{company:'Teste'},reports:[{sheetId:'s',worker:{name:'=1+1',sector:'S',company:'C',role:'R',ges:'G'},rows:[{group:'dermica',quantity:3,ca:'2',date:'02/01/2026',name:'Luva',interval:1,limit:30,status:'Dentro do prazo'},{group:'auditiva',ca:'1',date:'01/01/2026',name:'Protetor',status:'Marco inicial'},{group:'revisao',ca:'3',date:'03/01/2026',name:'Desconhecido',status:'Revisão necessária',caTone:'warn'}]}]};
 const fs=require('node:fs');const w=X.matrix(result,'data:image/png;base64,'+fs.readFileSync('SESI_logo.png').toString('base64'));
 const copy=new ExcelJS.Workbook();await copy.xlsx.load(await w.xlsx.writeBuffer());const s=copy.worksheets[0];assert.equal(s.getImages().length,1);assert.equal(s.getCell('F4').value,'Proteção auditiva');assert.equal(s.getCell('J4').value,'Proteção dérmica');assert.equal(s.getCell('O4').value,'Outros EPIs / revisão');assert.equal(s.getCell('D6').value,'=1+1');assert.equal(s.getCell('F6').value,'1');assert.equal(s.getCell('M6').value,'02/01/2026');assert.equal(s.getCell('L6').value,3);assert.equal(copy.getWorksheet('Detalhes').getCell('P3').value,3);assert.equal(s.getCell('P6').value,'3');assert.equal(s.getCell('P6').fill.fgColor.argb,'FFFFEB72');assert.equal(s.getCell('N6').fill.fgColor.argb,'FF00B050');assert.equal(copy.getWorksheet('Detalhes').rowCount,4);assert.equal(s.columnCount,18);
});

test('matriz usa linhas por entrega, mescla trabalhador, mantém homônimos separados e cores por prazo',async()=>{
 const worker={ges:'GES 1',sector:'S',role:'C',name:'Homônimo',company:'E'};
 const rows=[{group:'auditiva',ca:'1',date:'01/03/2026',name:'Protetor',interval:59,limit:30,status:'Fora do prazo'},{group:'auditiva',ca:'1',date:'01/01/2026',name:'Protetor',interval:null,status:'Marco inicial'},{group:'dermica',ca:'2',date:'02/02/2026',name:'Creme',interval:32,limit:30,status:'Fora do prazo'}];
 const w=X.matrix({reports:[{sheetId:'1',worker,rows},{sheetId:'2',worker,rows:rows.slice(0,1)}],filters:{},generatedAt:'2026'});
 const copy=new ExcelJS.Workbook();await copy.xlsx.load(await w.xlsx.writeBuffer());const s=copy.worksheets[0];
 assert.equal(s.getCell('H6').value,'01/01/2026');assert.equal(s.getCell('H7').value,'01/03/2026');assert.equal(s.getCell('I7').fill.fgColor.argb,'FFFF4D4D');assert.equal(s.getCell('N6').fill.fgColor.argb,'FFFF4D4D');assert.equal(s.getCell('D7').master.address,'D6');assert.equal(s.getCell('D9').value,'Homônimo');assert.notEqual(s.getCell('D9').master.address,'D6');assert.equal(s.pageSetup.fitToWidth,1);
});

test('validação antecipada rejeita arquivo inválido e XLSX excessivo antes da descompactação',async()=>{
 assert.throws(()=>X.checkArchive(new ArrayBuffer(10)),/inválido/);
 const buffer=await filled().xlsx.writeBuffer(),bytes=Uint8Array.from(buffer),view=new DataView(bytes.buffer);
 X.checkArchive(bytes.buffer);
 for(let i=bytes.length-22;i>=0;i--)if(view.getUint32(i,true)===0x06054b50){const directory=view.getUint32(i+16,true);view.setUint32(directory+24,65*1024*1024,true);break;}
 assert.throws(()=>X.checkArchive(bytes.buffer),/64 MB/);
});

test('importa quantidade opcional e modelo antigo de 8 colunas sem eliminar repetições',()=>{
 const w=filled();w.getWorksheet('Entregas').getRow(2).getCell(9).value=3;
 assert.equal(X.parse(w,'q',EpiDomain).sheets[0].entries[0].quantity,3);
 for(const value of [0,-2,1.5,{formula:'1+2',result:3}]){w.getWorksheet('Entregas').getRow(2).getCell(9).value=value;assert.throws(()=>X.parse(w,'q',EpiDomain),/Linha 2/);}
 const old=new ExcelJS.Workbook(),tab=old.addWorksheet('Entregas');tab.addRow(['Identificador','Empresa','Trabalhador','Setor','Cargo','GES','CA','Data da entrega']);
 for(let i=0;i<2;i++)tab.addRow(['A','Empresa','Pessoa','Setor','Cargo','GES','90001','01/01/2026']);
 const parsed=X.parse(old,'legacy',EpiDomain);assert.equal(parsed.count,2);assert.deepEqual(parsed.sheets[0].entries.map(e=>e.quantity),[1,1]);
});
