const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs');
const ExcelJS=require('exceljs');global.ExcelJS=ExcelJS;
const X=require('../src/web/spreadsheets');const {chromium}=require('playwright');require('./build');
(async()=>{
 const server=http.createServer((req,res)=>res.end(req.url==='/sandbox'?'<iframe name="app" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" src="/"></iframe>':fs.readFileSync('dist/Index.html')));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/sandbox');const app=page.frame({name:'app'});await app.waitForSelector('#bulkTemplate');
  assert.equal(await app.locator('#sheetList').isVisible(),false);
  const w=X.template();w.getWorksheet('Entregas').addRow(['A','Empresa teste','Pessoa teste','Setor','Cargo','GES','90001','01/01/2026']);w.getWorksheet('Entregas').addRow(['A','Empresa teste','Pessoa teste','Setor','Cargo','GES','90001','01/05/2026']);
  const buffer=Buffer.from(await w.xlsx.writeBuffer());
  const upload=async bytes=>app.locator('#bulkFile').setInputFiles({name:'entregas.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:bytes});
  // Upload is the FIRST Excel action: no warmed library from template/export.
  await upload(buffer);await app.waitForFunction(()=>document.getElementById('bulkStatus').textContent.includes('1 nova(s)'));
  assert.equal(await app.locator('#bulkImport').isEnabled(),true);await app.locator('#bulkImport').click();await app.waitForFunction(()=>document.getElementById('message').textContent.includes('Importação concluída'));
  await upload(buffer);await app.waitForFunction(()=>document.getElementById('bulkStatus').textContent.includes('já constam'));
  assert.equal(await app.locator('#bulkFile').isEnabled(),true);
  await upload(Buffer.from('arquivo corrompido'));await app.waitForFunction(()=>document.getElementById('bulkStatus').textContent.includes('inválido'));
  assert.equal(await app.locator('#bulkFile').isEnabled(),true);assert.equal(await app.locator('#bulkImport').isEnabled(),false);
  // A nonresponsive parser must terminate, release the input and allow retry.
  await app.evaluate(()=>{window.__worker=Worker;window.__timer=setTimeout;window.__terminated=0;window.Worker=class{postMessage(){}terminate(){window.__terminated++;}};window.setTimeout=(fn,ms,...args)=>window.__timer(fn,ms===30000?80:ms,...args);});
  await upload(buffer);await app.waitForFunction(()=>document.getElementById('bulkStatus').textContent.includes('30 segundos'));
  assert.equal(await app.locator('#bulkFile').isEnabled(),true);assert.equal(await app.evaluate(()=>window.__terminated),1);
  await app.evaluate(()=>{window.Worker=window.__worker;window.setTimeout=window.__timer;});
  const fresh=X.template();fresh.getWorksheet('Entregas').addRow(['B','Empresa teste','Pessoa nova','Setor','Cargo','GES','90002','01/02/2026',3]);fresh.getWorksheet('Entregas').addRow(['B','Empresa teste','Pessoa nova','Setor','Cargo','GES','90002','01/02/2026',2]);
  await upload(Buffer.from(await fresh.xlsx.writeBuffer()));await app.waitForFunction(()=>document.getElementById('bulkStatus').textContent.includes('1 nova(s)'));assert.equal(await app.locator('#bulkImport').isEnabled(),true);
  await app.locator('#bulkImport').click();await app.waitForFunction(()=>document.getElementById('message').textContent.includes('Importação concluída'));
  async function downloadExcel(button){const popupPromise=page.waitForEvent('popup'),download=popupPromise.then(p=>p.waitForEvent('download'));await app.locator(button).click();const file=await download,book=new ExcelJS.Workbook();await book.xlsx.readFile(await file.path());await(await popupPromise).close();return book;}
  const template=await downloadExcel('#bulkTemplate');assert.ok(template.getWorksheet('Entregas'));
  const large=X.template();
  for(let worker=0;worker<40;worker++)for(let day=1;day<=50;day++){
    const date=new Date(Date.UTC(2026,0,day));
    large.getWorksheet('Entregas').addRow(['L'+worker,'Empresa teste','Pessoa '+worker,'Setor','Cargo','GES','90001',date]);
  }
  const largeBuffer=Buffer.from(await large.xlsx.writeBuffer());
  const counts=await app.evaluate(async bytes=>{const result=await EpiExcel.read(Uint8Array.from(bytes).buffer,'limite');return [result.count,result.sheets.length];},Array.from(largeBuffer));
  assert.deepEqual(counts,[2000,40]);

  await app.locator('[data-view="reports"]').click();await app.locator('#reportForm button').click();await app.waitForFunction(()=>!document.getElementById('excelReport').disabled);
  const exported=await downloadExcel('#excelReport'),matrix=exported.getWorksheet('Matriz de entregas');
  const row=Array.from({length:matrix.rowCount},(_,i)=>i+1).find(i=>matrix.getCell('D'+i).value==='Pessoa teste');
  assert.ok(row);assert.equal(matrix.getImages().length,1);assert.equal(matrix.getCell('F'+row).value,'90001');assert.equal(matrix.getCell('H'+(row+1)).value,'01/05/2026');assert.equal(matrix.getCell('I'+(row+1)).fill.fgColor.argb,'FFFF4D4D');assert.equal(matrix.columnCount,18);const nova=Array.from({length:matrix.rowCount},(_,i)=>i+1).find(i=>matrix.getCell('D'+i).value==='Pessoa nova');assert.equal(matrix.getCell('L'+nova).value,3);assert.equal(matrix.getCell('L'+(nova+1)).value,2);
  await app.evaluate(()=>{window.open=()=>null;});await app.locator('[data-view="entry"]').click();await app.locator('#bulkTemplate').click();await app.waitForFunction(()=>document.getElementById('message').textContent.includes('Permita pop-ups'));assert.deepEqual(errors,[]);
  console.log('XLSX passou: upload inicial em worker, erro e timeout com recuperação, modelo, importação, reenvio e matriz vertical com cores.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
