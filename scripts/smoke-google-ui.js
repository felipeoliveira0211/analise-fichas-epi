/* Tests Google RPC flow against the real server code with mocked Apps Script services. Not a Google deployment. */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {chromium}=require('playwright');
require('./build');
(async()=>{
 const tables={Workers:[],Sheets:[],Entries:[],Lifetimes:[],CaIndex:[],Metadata:[]};
 const c=vm.createContext({EpiDomain:require('../src/domain/analysis'),EpiImport:require('../src/domain/catalog-import'),
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,text)=>Array.from(crypto.createHash('sha256').update(text).digest())},
  EpiStore:{rows:n=>structuredClone(tables[n]),count:n=>tables[n].length,replace:(n,v)=>{tables[n]=structuredClone(v)},locked:fn=>fn(),connection:()=>({connected:true,caCount:tables.CaIndex.length,...tables.Metadata[0]})}});
 for(const name of ['catalog','api','setup'])vm.runInContext(fs.readFileSync(path.join(__dirname,`../src/server/${name}.js`),'utf8'),c);
 const allowed=new Set(['epiBootstrap','epiListSheets','epiLoadSheet','epiSaveSheet','epiSaveLifetime','epiDeleteLifetime','epiAnalyzeSheet','epiConnectionStatus','epiPreviewCatalog','epiImportCatalog']);
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(__dirname,'../dist/Index.html')))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.exposeFunction('__epiRpc',(method,args)=>{if(!allowed.has(method))throw new Error('Unknown mock RPC');return c[method](...args)});
  await page.addInitScript(()=>{
   function runner(success,failure){return new Proxy({}, {get(_,key){
    if(key==='withSuccessHandler')return callback=>runner(callback,failure);
    if(key==='withFailureHandler')return callback=>runner(success,callback);
    return (...args)=>window.__epiRpc(key,args).then(value=>success&&success(value),error=>failure&&failure({message:error.message}));
   }});}
   window.google={script:{run:runner()}};
   localStorage.setItem('epi.analysis.v1',JSON.stringify({sheets:[],demoLifetimes:{90001:999}}));
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>document.getElementById('message').textContent==='Planilha conectada.');
  await page.locator('[data-view="catalog"]').click();assert.match(await page.locator('#connectionSummary').innerText(),/0 CAs/);
  await page.locator('[data-view="entry"]').click();
  for(const [name,value]of[['workerName','Pessoa fictícia Google'],['workerSector','Setor fictício'],['workerRole','Cargo fictício'],['workerGes','GES teste']])await page.locator('#'+name).fill(value);
  for(const date of ['01012026','01022026']){await page.locator('#ca').fill('123');await page.locator('#ca').press('Enter');await page.locator('#date').fill(date);await page.locator('#date').press('Enter');}
  await page.locator('#analyze').click();await page.waitForFunction(()=>document.getElementById('message').textContent.includes('Base de CAs vazia'));
  await page.locator('[data-view="catalog"]').click();
  await page.locator('#catalogFile').setInputFiles({name:'ficticio.csv',mimeType:'text/csv',buffer:Buffer.from('CA;Equipamento;Aprovado para;Data de validade\n123;Auditivo fictício;Proteção auditiva contra ruído;31/12/2030\n')});
  await page.locator('#readCatalog').click();await page.locator('#catalogSource').fill('https://www.gov.br/exemplo-ficticio');await page.locator('#catalogReference').fill('01/01/2026');await page.locator('#previewCatalog').click();
  await page.locator('#commitCatalog').waitFor({state:'visible'});assert.equal(tables.CaIndex.length,0);await page.locator('#commitCatalog').click();await page.waitForFunction(()=>document.getElementById('message').textContent.includes('1 CAs importados'));
  assert.equal(tables.CaIndex.length,1);assert.equal(tables.Workers.length,0);
  await page.locator('[data-view="admin"]').click();await page.locator('#lifeCa').fill('123');await page.locator('#lifeDays').fill('30');await page.locator('#lifeForm button').click();await page.waitForFunction(()=>document.getElementById('lifeRows').textContent.includes('123'));
  await page.locator('[data-view="entry"]').click();await page.locator('#analyze').click();await page.locator('#results').waitFor({state:'visible'});assert.match(await page.locator('#resultRows').innerText(),/Fora do prazo/);
  await page.locator('[data-view="entry"]').click();await page.locator('#saveSheet').click();await page.waitForFunction(()=>document.getElementById('message').textContent==='Ficha salva na planilha.');assert.equal(tables.Workers.length,1);assert.equal(tables.Entries.length,2);
  await page.locator('#reloadSheet').click();await page.waitForFunction(()=>document.getElementById('message').textContent==='Versão da planilha reaberta.');
  await page.reload();await page.waitForFunction(()=>document.getElementById('message').textContent==='Planilha conectada.');assert.equal(await page.locator('#entries tr').count(),2);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('epi.analysis.google.v1')).sheets[0].worker.name),'Pessoa fictícia Google');
  assert.deepEqual(errors,[]);console.log('Fluxo Google SIMULADO passou: base vazia, prévia/importação, vida útil, análise, salvar/retomar e isolamento da demonstração. OAuth/Sheets reais não foram testados.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1});
