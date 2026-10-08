/* Browser validation uses only fictitious records and an ephemeral local server. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
require('./build');
(async () => {
  const target = process.env.SMOKE_FILE ? path.resolve(process.env.SMOKE_FILE) : path.join(__dirname,'../dist/Index.html');
  const server = http.createServer((req,res) => { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(fs.readFileSync(target)); });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,headless:true});
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const [name,value] of [['workerName','Pessoa fictícia A'],['workerSector','Setor teste'],['workerRole','Cargo teste'],['workerGes','GES A']]) await page.locator('#'+name).fill(value);
    async function add(ca,date) {
      await page.locator('#ca').fill(ca);await page.locator('#ca').press('Enter');
      assert.equal(await page.locator('#date').evaluate(el=>el===document.activeElement),true);
      await page.locator('#date').fill(date);await page.locator('#date').press('Enter');
      assert.equal(await page.locator('#ca').evaluate(el=>el===document.activeElement),true);
    }
    await add('90001','01012026');await add('90001','01052026');
    assert.equal(await page.locator('#entries tr').count(),2);
    await page.locator('#analyze').click();
    assert.match(await page.locator('#resultRows').innerText(),/120 dias/);
    assert.match(await page.locator('#resultRows').innerText(),/Fora do prazo/);
    await page.locator('[data-view="entry"]').click();
    await page.locator('#entries tr').nth(1).getByText('Editar',{exact:true}).click();
    await page.locator('#date').fill('31012026');await page.locator('#date').press('Enter');
    await page.locator('#analyze').click();assert.match(await page.locator('#resultRows').innerText(),/Dentro do prazo/);
    await page.reload();assert.equal(await page.locator('#entries tr').count(),2);assert.equal(await page.locator('#workerName').inputValue(),'Pessoa fictícia A');
    await page.locator('#newSheet').click();
    for (const [name,value] of [['workerName','Pessoa fictícia B'],['workerSector','Outro setor'],['workerRole','Outro cargo'],['workerGes','GES B']]) await page.locator('#'+name).fill(value);
    await add('90002','01012026');await add('90003','01022026');await page.locator('#analyze').click();
    assert.match(await page.locator('#resultRows').innerText(),/31 dias/);assert.match(await page.locator('#resultRows').innerText(),/Fora do prazo/);
    await page.locator('[data-view="admin"]').click();await page.locator('#lifeCa').fill('90001');await page.locator('#lifeDays').fill('120');await page.locator('#lifeForm button').click();
    assert.match(await page.locator('#lifeRows').innerText(),/120/);
    await page.locator('[data-view="entry"]').click();await page.getByRole('button',{name:/Pessoa fictícia A ·/}).click();
    assert.equal(await page.locator('#entries tr').count(),2);
    await page.locator('#entries tr').nth(1).getByText('Excluir',{exact:true}).click();assert.equal(await page.locator('#entries tr').count(),1);
    await page.locator('#ca').fill('90001');await page.locator('#ca').press('Enter');await page.locator('#date').fill('31022026');await page.locator('#date').press('Enter');
    assert.match(await page.locator('#message').innerText(),/Data inexistente/);assert.equal(await page.locator('#entries tr').count(),1);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
    assert.deepEqual(errors,[]);
    console.log('Smoke de interface passou: teclado, máscara, correção, exclusão, análise, rascunho após reload, múltiplos trabalhadores, vida útil, data inválida e viewport móvel.');
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
