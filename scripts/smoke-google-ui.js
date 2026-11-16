/* Real application/server with mocked Google services; no OAuth or live deployment. */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {chromium}=require('playwright');require('./export-google');
(async()=>{
 const tables={Workers:[],Sheets:[],Entries:[],Lifetimes:[{ca:'54460',days:90}],CaIndex:[],Metadata:[],CaDefaultStage:[],CaDefaultBackup:[]},props={};
 const c=vm.createContext({console:{log(){}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v}})},
 Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,bytes)=>Array.from(crypto.createHash('sha256').update(bytes).digest()),base64Decode:s=>Buffer.from(s,'base64'),newBlob:(bytes,contentType)=>({bytes,contentType}),ungzip:b=>{if(!b.contentType)throw Error('Objeto blob não pode ter tipo de conteúdo nulo para esta operação.');return {getDataAsString:()=>zlib.gunzipSync(b.bytes).toString('utf8')}}},
 HtmlService:{createHtmlOutputFromFile:()=>({getContent:()=>fs.readFileSync('google-apps-script/Index.html','utf8')})},
 EpiStore:{initialize(){},rows:n=>structuredClone(tables[n]),count:n=>tables[n].length,replace:(n,v)=>{tables[n]=structuredClone(v)},writeAt:(n,offset,rows)=>rows.forEach((r,i)=>{tables[n][offset+i]=structuredClone(r)}),locked:fn=>fn()}});
 vm.runInContext(fs.readFileSync('dist/DefaultData.gs','utf8'),c);
 // Load the generated Apps Script files in one V8 context, without Node require/module.
 for(const name of ['Domain','ReportDomain','ImportDomain','Catalog','Api','Setup','DefaultCatalog'])vm.runInContext(fs.readFileSync(`google-apps-script/${name}.gs`,'utf8'),c);
 assert.equal(c.verifyReportAndExcelDeployment().status,'OK');
 c.EpiStore.connection=()=>({connected:true,caCount:tables.CaIndex.length,...tables.Metadata[0],defaultBase:c.EpiDefaultCatalog.status(c.EpiStore)});
 c.adminUpdateOfficialBase();assert.equal(tables.CaIndex.length,42478);assert.equal(tables.Lifetimes[0].days,90);
 const baseTimestamp=tables.Metadata[0].updatedAt;c.adminUpdateOfficialBase();assert.equal(tables.Metadata[0].updatedAt,baseTimestamp);
 const allowed=new Set(['epiBootstrap','epiListSheets','epiLoadSheet','epiSaveSheet','epiSaveLifetime','epiDeleteLifetime','epiAnalyzeSheet','epiGenerateReports']);
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/sandbox'?'<html><body style="margin:0"><iframe name="app" style="border:0;width:100%;height:100vh" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals" src="/"></iframe></body></html>':fs.readFileSync('google-apps-script/Index.html'))});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});const page=await browser.newPage();let app;const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.exposeFunction('__epiRpc',(method,args)=>{if(!allowed.has(method))throw Error('Unexpected RPC '+method);return JSON.parse(JSON.stringify(c[method](...args)))});
  await page.addInitScript(()=>{function runner(success,failure){return new Proxy({}, {get(_,key){if(key==='withSuccessHandler')return cb=>runner(cb,failure);if(key==='withFailureHandler')return cb=>runner(success,cb);return (...args)=>window.__epiRpc(key,args).then(v=>success&&success(v),e=>failure&&failure({message:e.message}));}})}window.google={script:{run:runner()}};});
  await page.addInitScript(()=>{window.define=()=>{throw Error('Unexpected AMD registration');};window.define.amd={};});
  await page.goto(`http://127.0.0.1:${server.address().port}/sandbox`);app=page.frame({name:'app'});await app.waitForFunction(()=>document.getElementById('message').textContent==='Dados carregados.');
  assert.equal(await app.locator('[data-view="catalog"]').count(),0);assert.equal(await app.locator('#catalog').count(),0);assert.match(await app.locator('#baseUpdated').innerText(),/Última atualização da base: \d{2}\/\d{2}\/\d{4}/);
  for(const [name,value]of [['workerCompany','Empresa fictícia'],['workerName','Pessoa fictícia Google'],['workerSector','Setor teste'],['workerRole','Cargo teste'],['workerGes','GES A']])await app.locator('#'+name).fill(value);
  async function add(ca,date,days){await app.locator('#ca').fill(ca);if(days)await app.locator('#quickLifeDays').fill(days);await app.locator('#ca').press('Enter');await app.locator('#date').fill(date);await app.locator('#date').press('Enter');await app.waitForFunction(()=>document.getElementById('ca').value==='');}
  await add('54460','01012026','30');assert.equal(tables.Lifetimes[0].days,30);
  for(const [ca,date]of [['53709','01012026'],['13990','01022026'],['54444','31012026'],['54460','01022026'],['13','01032026'],['40355','01042026'],['12065','01052026']])await add(ca,date);
  assert.equal(await app.evaluate(()=>JSON.parse(localStorage.getItem('epi.analysis.google.v1')).lifetimes['54460']),30);
  await app.locator('#analyze').click();await app.locator('#results').waitFor({state:'visible'});
  assert.deepEqual(await app.locator('#resultRows .group-heading').allTextContents(),['Proteção dérmica','Proteção auditiva','Outras entregas']);
  assert.equal(await app.locator('#results thead th').last().innerText(),'Resultado');assert.equal(await app.locator('#results thead th').count(),6);assert.ok(!(await app.locator('#results thead th').allTextContents()).includes('Limite'));
  const audit=app.locator('#resultRows .delivery-row[data-group="auditiva"]');assert.equal(await audit.first().locator('td').nth(2).innerText(),'Marco inicial');assert.equal(await audit.first().locator('td').last().innerText(),'—');
  assert.match(await audit.nth(1).locator('td').last().innerText(),/✕ Fora do prazo/);assert.match(await audit.nth(2).locator('td').last().innerText(),/✓ Dentro do prazo/);
  assert.match(await audit.nth(2).locator('td').nth(4).innerText(),/CA vencido/);assert.equal(await audit.nth(2).locator('td').nth(4).locator('.bad').count(),1);
  assert.match(await app.locator('#resultRows .delivery-row').filter({hasText:'40355'}).innerText(),/26\/05\/3031/);
  const currentStatus=c.EpiDomain.certificateStatus(tables.CaIndex.find(r=>r.ca==='12065'),Date.now());assert.ok((await app.locator('#resultRows .delivery-row').filter({hasText:'12065'}).locator('td').nth(4).innerText()).includes(currentStatus.label));
  assert.equal(await app.locator('#resultRows .delivery-row').filter({hasText:'12065'}).locator('.'+currentStatus.tone).count(),1);
  for(const group of ['dermica','auditiva','outros']){const dates=await app.locator(`#resultRows .delivery-row[data-group="${group}"] td:first-child`).allTextContents();assert.deepEqual(dates,[...dates].sort((a,b)=>c.EpiDomain.date(a)-c.EpiDomain.date(b)));}
  await page.screenshot({path:'/tmp/epi-results-new.png',fullPage:true});
  await app.evaluate(()=>{window.__printCalls=0;window.print=()=>window.__printCalls++;});
  await app.locator('#printAnalyzed').click();await app.waitForFunction(()=>window.__printCalls===1);
  assert.equal(await app.locator('#results').isVisible(),true);assert.equal(tables.Entries.length,0);
  const quick=await app.locator('#quickPrintPreview').textContent();assert.match(quick,/Análise entregas de EPI/);assert.match(quick,/Pessoa fictícia Google/);assert.doesNotMatch(quick,/Filtros:|Última atualização|Origem:|Salvo na planilha/);
  assert.equal(await app.locator('#quickPrintPreview .delivery-row').count(),8);
  await page.emulateMedia({media:'print'});assert.equal(await app.locator('#quickPrintPreview').isVisible(),true);assert.equal(await app.locator('#reports').isVisible(),false);assert.equal(await app.locator('#printAnalyzed').isVisible(),false);
  fs.writeFileSync('/tmp/epi-quick-print-smoke.pdf',await page.pdf({preferCSSPageSize:true}));
  await app.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await page.emulateMedia({media:'screen'});assert.equal(await app.locator('#results').isVisible(),true);assert.equal(await app.locator('#quickPrintPreview').isVisible(),false);
  await app.locator('[data-view="entry"]').click();await app.locator('#saveSheet').click();await app.waitForFunction(()=>document.getElementById('message').textContent==='Ficha salva na planilha.');assert.equal(tables.Entries.length,8);
  await page.reload();app=page.frame({name:'app'});await app.waitForFunction(()=>document.getElementById('message').textContent==='Dados carregados.');await app.locator('#ca').fill('54460');assert.equal(await app.locator('#quickLifeDays').inputValue(),'30');await app.locator('#ca').fill('');assert.equal(tables.Metadata[0].updatedAt,baseTimestamp);
  // Reproduce an older cached draft without a worker ID, beside the valid open sheet.
  await page.addInitScript(()=>{const key='epi.analysis.google.v1',cache=JSON.parse(localStorage.getItem(key));if(!cache||!cache.sheets.length||cache.sheets.some(s=>s.id==='legacy-no-worker-id'))return;const legacy=structuredClone(cache.sheets[0]);legacy.id='legacy-no-worker-id';delete legacy.worker.id;cache.sheets.push(legacy);localStorage.setItem(key,JSON.stringify(cache));});
  await page.reload();app=page.frame({name:'app'});await app.waitForFunction(()=>document.getElementById('message').textContent==='Dados carregados.');
  await app.locator('[data-view="reports"]').click();await app.locator('#reportSource').selectOption('local');await app.locator('#reportForm button').click();
  await app.waitForFunction(()=>document.getElementById('reportStatus').textContent.includes('não incluída') || document.getElementById('message').classList.contains('error'));

  assert.equal(await app.locator('#message').getAttribute('class'),'','RPC error: '+await app.locator('#message').innerText());
  assert.match(await app.locator('#reportPreview').innerText(),/legacy-no-worker-id.*sem ID/);
  assert.equal(await app.locator('#reportPreview .report-sheet').count(),1);
  assert.equal(await app.evaluate(()=>JSON.parse(localStorage.getItem('epi.analysis.google.v1')).sheets.find(s=>s.id==='legacy-no-worker-id').worker.id),undefined);
  await app.locator('[data-view="reports"]').click();await app.locator('#reportSource').selectOption('google');await app.locator('#reportCompany').fill('Empresa ficticia');await app.locator('#reportForm button').click();await app.waitForFunction(()=>document.getElementById('reportStatus').textContent.includes('1 ficha(s), 8 lançamento(s)'));
  // No filters must work even when a saved sheet has lost its worker link.
  tables.Sheets.push({id:'orphan-regression',workerId:'missing',state:'draft'});
  tables.Entries.push({id:'orphan-entry',sheetId:'orphan-regression',ca:'54460',date:'01/01/2026'});
  await app.locator('#reportCompany').fill('');await app.locator('#reportForm button').click();
  await app.waitForFunction(()=>document.getElementById('reportStatus').textContent.includes('não incluída'));
  assert.match(await app.locator('#reportPreview').innerText(),/orphan-regression.*Workers/);
  async function downloadExcel(button) {
    const popupPromise=page.waitForEvent('popup');
    const downloadPromise=popupPromise.then(p=>p.waitForEvent('download'));
    await app.locator(button).click();const file=await downloadPromise;
    const book=new (require('exceljs').Workbook)();await book.xlsx.readFile(await file.path());
    await (await popupPromise).close();return book;
  }
  const matrix=await downloadExcel('#excelReport');
  assert.equal(matrix.getWorksheet('Matriz de entregas').getCell('D6').value,'Pessoa fictícia Google');
  assert.match(matrix.getWorksheet('Avisos').getCell('A2').value,/orphan-regression/);
  await app.locator('[data-view="entry"]').click();
  const template=await downloadExcel('#bulkTemplate');assert.ok(template.getWorksheet('Entregas'));
  await app.locator('[data-view="reports"]').click();
  tables.Sheets=tables.Sheets.filter(s=>s.id!=='orphan-regression');tables.Entries=tables.Entries.filter(e=>e.id!=='orphan-entry');
  const preview=await app.locator('#reportPreview').innerText();assert.match(preview,/Análise entregas de EPI/);assert.doesNotMatch(preview,/Relatório de fichas de EPI/);assert.match(preview,/Gerado em/);assert.match(preview,/Filtros:/);assert.doesNotMatch(preview,/Origem:|Fonte de CAs|Referência:|Último salvamento|Salvo na planilha|Base e conexão/);
  assert.deepEqual(await app.locator('#reportPreview .group-heading').allTextContents(),['Proteção dérmica','Proteção auditiva','Outras entregas']);assert.equal(await app.locator('#reportPreview thead th').last().innerText(),'Resultado');
  await app.locator('#reportPreview .report-logo').evaluate(img=>img.decode());assert.ok(await app.locator('#reportPreview .report-logo').evaluate(img=>img.naturalWidth>0&&img.src.startsWith('data:image/png;base64,')));
  await page.screenshot({path:'/tmp/epi-report-new.png',fullPage:true});
  await page.emulateMedia({media:'print'});assert.equal(await app.locator('#baseUpdated').isVisible(),false);assert.equal(await app.locator('.report-controls').isVisible(),false);const pdf=await page.pdf({preferCSSPageSize:true});fs.writeFileSync('/tmp/epi-google-report-smoke.pdf',pdf);assert.ok(pdf.length>5000);await page.emulateMedia({media:'screen'});
  await app.locator('#reportStart').fill('2026-02-01');await app.locator('#reportEnd').fill('2026-02-01');await app.locator('#reportForm button').click();await app.waitForFunction(()=>document.getElementById('reportStatus').textContent.includes('2 lançamento(s)'));assert.match(await app.locator('#reportPreview').innerText(),/31 dias/);assert.doesNotMatch(await app.locator('#reportPreview').innerText(),/Marco inicial/);
  await page.setViewportSize({width:390,height:844});assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);
  // Upload XLSX exercises the existing save RPC and Sheets adapter, not just local drafts.
  await app.locator('[data-view="entry"]').click();
  const uploadBook=new (require('exceljs').Workbook)();const uploadSheet=uploadBook.addWorksheet('Entregas');
  uploadSheet.addRow(['Identificador','Empresa','Trabalhador','Setor','Cargo','GES','CA','Data da entrega']);
  uploadSheet.addRow(['IMPORT-1','Empresa fictícia','Pessoa importada','Setor teste','Cargo teste','GES teste','54460','01/01/2026']);
  await app.locator('#bulkFile').setInputFiles({name:'teste.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await uploadBook.xlsx.writeBuffer())});
  await app.waitForFunction(()=>document.getElementById('bulkStatus').textContent.includes('1 nova(s)'));
  await app.locator('#bulkImport').click();await app.waitForFunction(()=>document.getElementById('message').textContent.includes('Importação concluída'));
  const importedWorker=tables.Workers.find(w=>w.name==='Pessoa importada');assert.ok(importedWorker);
  const importedSheet=tables.Sheets.find(s=>s.workerId===importedWorker.id);assert.equal(tables.Entries.filter(e=>e.sheetId===importedSheet.id).length,1);assert.equal(importedSheet.revision,1);assert.deepEqual(errors,[]);
  await page.addInitScript(()=>{const key='epi.analysis.google.v1',cache=JSON.parse(localStorage.getItem(key));const imported=cache.sheets.find(s=>s.worker.name==='Pessoa importada');if(!imported.localSync)throw Error('Confirmação local ausente');imported.localSync.confirmedAt=0;const dirty=structuredClone(imported);dirty.id='rascunho-protegido';dirty.worker.id='trabalhador-protegido';dirty.localSync=null;cache.sheets.push(dirty);localStorage.setItem(key,JSON.stringify(cache));});
  await page.reload();app=page.frame({name:'app'});await app.waitForFunction(()=>document.getElementById('message').textContent==='Dados carregados.');
  const cachedIds=await app.evaluate(()=>JSON.parse(localStorage.getItem('epi.analysis.google.v1')).sheets.map(s=>s.id));assert.ok(!cachedIds.includes(importedSheet.id));assert.ok(cachedIds.includes('rascunho-protegido'));assert.ok(tables.Sheets.some(s=>s.id===importedSheet.id));
  assert.equal(await app.locator('#sheetList button').count(),0);await app.locator('#savedSheetsPanel summary').click();await app.getByRole('button',{name:/Pessoa importada.*planilha/}).click();
  assert.equal(await app.locator('#workerName').inputValue(),'Pessoa importada');assert.equal(await app.locator('#entries tr').count(),1);assert.deepEqual(errors,[]);
  console.log('Google SIMULADO em iframe passou: verificação do pacote, rascunho legado, downloads XLSX reais, 42478 CAs, atualização administrativa idempotente, vida útil em Sheets/cache/autopreenchimento, grupos/cores/vencimentos, PDF sem dados de base, filtros e layout móvel.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
