const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
require('../scripts/build');
test('HTML exportado não contém tags script literais dentro do JavaScript Excel',()=>{
 require('../scripts/build');
 const html=fs.readFileSync('dist/Index.html','utf8');
 const scripts=Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g),m=>m[1]);
 assert.equal(scripts.length,5);
 const encoded=html.match(/id="excelBundle"[^>]*>([^<]+)<\/textarea>/)[1];
 const source=require('node:zlib').gunzipSync(Buffer.from(encoded,'base64')).toString();
 assert.equal(source,fs.readFileSync('node_modules/exceljs/dist/exceljs.min.js','utf8'));
 assert.ok(html.length<500000,'O Index deve caber em um arquivo com menos de 500 KB');
 const buildId=html.match(/\"id\":\"(epi-[a-f0-9]+)\"/)[1];
 assert.ok(fs.readFileSync('dist/Api.gs','utf8').includes(buildId));
 scripts.forEach(source=>assert.doesNotMatch(source,/<\/?script/i));
 assert.ok(scripts.some(source=>source.includes('var EpiSpreadsheets')));
});

function setup(){
 let html=fs.readFileSync('dist/Index.html','utf8');
 const context=vm.createContext({console:{log(){}},HtmlService:{createHtmlOutputFromFile:()=>({getContent:()=>html})},Utilities:{
  DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},base64Decode:s=>Buffer.from(s,'base64'),newBlob:(bytes,contentType)=>({bytes,contentType}),
  ungzip:b=>{if(!b.contentType)throw Error('Objeto blob não pode ter tipo de conteúdo nulo para esta operação.');return {getDataAsString:()=>zlib.gunzipSync(b.bytes).toString()}},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest())
 }});
 for(const file of ['Domain','ReportDomain','Api'])vm.runInContext(fs.readFileSync(`dist/${file}.gs`,'utf8'),context);
 return {context,change:fn=>{html=fn(html)}};
}
test('verificador executa arquivos GAS gerados sem require ou serviços de planilha',()=>{
 const {context:c}=setup();const result=c.verifyReportAndExcelDeployment();
 assert.equal(result.status,'OK');assert.match(result.version,/^epi-[a-f0-9]{12}$/);
});
test('verificador rejeita Index antigo, versões misturadas e biblioteca Excel alterada',()=>{
 for(const [change,message] of [
  [()=>'<html>antigo</html>',/antigo ou incompleto/],
  [html=>html.replace(/"id":"epi-[a-f0-9]{12}"/,'"id":"epi-antigo"'),/versões diferentes/],
  [html=>html.replace(/"excelSha256":"[a-f0-9]{64}"/,'"excelSha256":"'+'0'.repeat(64)+'"'),/Excel alterado ou incompleto/]
 ]){const {context:c,change:modify}=setup();modify(change);assert.throws(()=>c.verifyReportAndExcelDeployment(),message);}
});
