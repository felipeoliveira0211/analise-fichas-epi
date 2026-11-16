const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('HTML exportado não contém tags script literais dentro do JavaScript Excel',()=>{
 require('../scripts/build');
 const html=fs.readFileSync('dist/Index.html','utf8');
 const scripts=Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g),m=>m[1]);
 assert.equal(scripts.length,8);
 scripts.forEach(source=>assert.doesNotMatch(source,/<\/?script/i));
 assert.ok(scripts.some(source=>source.includes('var EpiSpreadsheets')));
});
