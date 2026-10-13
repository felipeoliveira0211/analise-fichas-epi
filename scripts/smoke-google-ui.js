/* Real application/server with mocked Google services; no OAuth or live deployment. */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {chromium}=require('playwright');require('./build');
(async()=>{
 const tables={Workers:[],Sheets:[],Entries:[],Lifetimes:[{ca:'54460',days:90}],CaIndex:[],Metadata:[],CaDefaultStage:[],CaDefaultBackup:[]},props={};
 const c=vm.createContext({console:{log(){}},EpiReports:require('../src/domain/reports'),EpiDomain:require('../src/domain/analysis'),EpiImport:require('../src/domain/catalog-import'),
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v}})},
 Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,bytes)=>Array.from(crypto.createHash('sha256').update(bytes).digest()),base64Decode:s=>Buffer.from(s,'base64'),newBlob:b=>b,ungzip:b=>({getDataAsString:()=>zlib.gunzipSync(b).toString('utf8')})},
 EpiStore:{initialize(){},rows:n=>structuredClone(tables[n]),count:n=>tables[n].length,replace:(n,v)=>{tables[n]=structuredClone(v)},writeAt:(n,offset,rows)=>rows.forEach((r,i)=>{tables[n][offset+i]=structuredClone(r)}),locked:fn=>fn()}});
 vm.runInContext(fs.readFileSync('dist/DefaultData.gs','utf8'),c);
 for(const name of ['catalog','api','setup','default-catalog'])vm.runInContext(fs.readFileSync(`src/server/${name}.js`,'utf8'),c);
 c.EpiStore.connection=()=>({connected:true,caCount:tables.CaIndex.length,...tables.Metadata[0],defaultBase:c.EpiDefaultCatalog.status(c.EpiStore)});
 c.adminUpdateOfficialBase();assert.equal(tables.CaIndex.length,42478);assert.equal(tables.Lifetimes[0].days,90);
 const baseTimestamp=tables.Metadata[0].updatedAt;c.adminUpdateOfficialBase();assert.equal(tables.Metadata[0].updatedAt,baseTimestamp);
 const allowed=new Set(['epiBootstrap','epiListSheets','epiLoadSheet','epiSaveSheet','epiSaveLifetime','epiDeleteLifetime','epiAnalyzeSheet','epiGenerateReports']);
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync('dist/Index.html'))});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.exposeFunction('__epiRpc',(method,args)=>{if(!allowed.has(method))throw Error('Unexpected RPC '+method);return c[method](...args)});
  await page.addInitScript(()=>{function runner(success,failure){return new Proxy({}, {get(_,key){if(key==='withSuccessHandler')return cb=>runner(cb,failure);if(key==='withFailureHandler')return cb=>runner(success,cb);return (...args)=>window.__epiRpc(key,args).then(v=>success&&success(v),e=>failure&&failure({message:e.message}));}})}window.google={script:{run:runner()}};});
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.getElementById('message').textContent==='Dados carregados.');
  assert.equal(await page.locator('[data-view="catalog"]').count(),0);assert.equal(await page.locator('#catalog').count(),0);assert.match(await page.locator('#baseUpdated').innerText(),/Última atualização da base: \d{2}\/\d{2}\/\d{4}/);
  for(const [name,value]of [['workerCompany','Empresa fictícia'],['workerName','Pessoa fictícia Google'],['workerSector','Setor teste'],['workerRole','Cargo teste'],['workerGes','GES A']])await page.locator('#'+name).fill(value);
  async function add(ca,date,days){await page.locator('#ca').fill(ca);if(days)await page.locator('#quickLifeDays').fill(days);await page.locator('#ca').press('Enter');await page.locator('#date').fill(date);await page.locator('#date').press('Enter');await page.waitForFunction(()=>document.getElementById('ca').value==='');}
  await add('54460','01012026','30');assert.equal(tables.Lifetimes[0].days,30);
  for(const [ca,date]of [['53709','01012026'],['13990','01022026'],['54444','31012026'],['54460','01022026'],['13','01032026'],['40355','01042026'],['12065','01052026']])await add(ca,date);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('epi.analysis.google.v1')).lifetimes['54460']),30);
  await page.locator('#analyze').click();await page.locator('#results').waitFor({state:'visible'});
  assert.deepEqual(await page.locator('#resultRows .group-heading').allTextContents(),['Proteção dérmica','Proteção auditiva','Outras entregas']);
  assert.equal(await page.locator('#results thead th').last().innerText(),'Resultado');
  const audit=page.locator('#resultRows .delivery-row[data-group="auditiva"]');assert.equal(await audit.first().locator('td').nth(2).innerText(),'Marco inicial');assert.equal(await audit.first().locator('td').last().innerText(),'—');
  assert.match(await audit.nth(1).locator('td').last().innerText(),/✕ Fora do prazo/);assert.match(await audit.nth(2).locator('td').last().innerText(),/✓ Dentro do prazo/);
  assert.match(await audit.nth(2).locator('td').nth(5).innerText(),/CA vencido/);assert.equal(await audit.nth(2).locator('td').nth(5).locator('.bad').count(),1);
  assert.match(await page.locator('#resultRows .delivery-row').filter({hasText:'40355'}).innerText(),/26\/05\/3031/);
  assert.match(await page.locator('#resultRows .delivery-row').filter({hasText:'12065'}).locator('td').nth(5).innerText(),/Próximo ao vencimento/);
  assert.equal(await page.locator('#resultRows .delivery-row').filter({hasText:'12065'}).locator('.warn').count(),1);
  for(const group of ['dermica','auditiva','outros']){const dates=await page.locator(`#resultRows .delivery-row[data-group="${group}"] td:first-child`).allTextContents();assert.deepEqual(dates,[...dates].sort((a,b)=>c.EpiDomain.date(a)-c.EpiDomain.date(b)));}
  await page.screenshot({path:'/tmp/epi-results-new.png',fullPage:true});
  await page.locator('[data-view="entry"]').click();await page.locator('#saveSheet').click();await page.waitForFunction(()=>document.getElementById('message').textContent==='Ficha salva na planilha.');assert.equal(tables.Entries.length,8);
  await page.reload();await page.waitForFunction(()=>document.getElementById('message').textContent==='Dados carregados.');await page.locator('#ca').fill('54460');assert.equal(await page.locator('#quickLifeDays').inputValue(),'30');await page.locator('#ca').fill('');assert.equal(tables.Metadata[0].updatedAt,baseTimestamp);
  await page.locator('[data-view="reports"]').click();await page.locator('#reportSource').selectOption('google');await page.locator('#reportCompany').fill('Empresa ficticia');await page.locator('#reportForm button').click();await page.waitForFunction(()=>document.getElementById('reportStatus').textContent.includes('1 ficha(s), 8 lançamento(s)'));
  const preview=await page.locator('#reportPreview').innerText();assert.match(preview,/Gerado em/);assert.match(preview,/Filtros:/);assert.doesNotMatch(preview,/Origem:|Fonte de CAs|Referência:|Último salvamento|Salvo na planilha|Base e conexão/);
  assert.deepEqual(await page.locator('#reportPreview .group-heading').allTextContents(),['Proteção dérmica','Proteção auditiva','Outras entregas']);assert.equal(await page.locator('#reportPreview thead th').last().innerText(),'Resultado');
  await page.locator('#reportPreview .report-logo').evaluate(img=>img.decode());assert.ok(await page.locator('#reportPreview .report-logo').evaluate(img=>img.naturalWidth>0&&img.src.startsWith('data:image/png;base64,')));
  await page.screenshot({path:'/tmp/epi-report-new.png',fullPage:true});
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('#baseUpdated').isVisible(),false);assert.equal(await page.locator('.report-controls').isVisible(),false);const pdf=await page.pdf({preferCSSPageSize:true});fs.writeFileSync('/tmp/epi-google-report-smoke.pdf',pdf);assert.ok(pdf.length>5000);await page.emulateMedia({media:'screen'});
  await page.locator('#reportStart').fill('2026-02-01');await page.locator('#reportEnd').fill('2026-02-01');await page.locator('#reportForm button').click();await page.waitForFunction(()=>document.getElementById('reportStatus').textContent.includes('2 lançamento(s)'));assert.match(await page.locator('#reportPreview').innerText(),/31 dias/);assert.doesNotMatch(await page.locator('#reportPreview').innerText(),/Marco inicial/);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);
  console.log('Google SIMULADO passou: 42478 CAs, atualização administrativa idempotente, vida útil em Sheets/cache/autopreenchimento, grupos/cores/vencimentos, PDF sem dados de base, filtros e layout móvel.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
