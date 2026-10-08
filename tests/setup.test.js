const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function setup(existing) {
 const properties={SPREADSHEET_ID:existing};let created=0,initialized=0;
 const c=vm.createContext({console:{log(){}},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k],setProperty:(k,v)=>{properties[k]=v}})},SpreadsheetApp:{create:()=>{created++;return {getId:()=> 'fake-new-id'}}},EpiStore:{locked:fn=>fn(),initialize:()=>{initialized++},connection:()=>({connected:true,caCount:0,spreadsheetUrl:'https://docs.google.com/spreadsheets/d/fake-id'})}});
 vm.runInContext(fs.readFileSync('src/server/setup.js','utf8'),c);return {c,properties,counts:()=>({created,initialized})};
}
test('inicialização cria uma planilha uma vez, persiste ID e é repetível',()=>{const {c,properties,counts}=setup();assert.equal(c.initializeApplication().created,true);assert.equal(properties.SPREADSHEET_ID,'fake-new-id');assert.equal(c.initializeApplication().created,false);assert.equal(counts().created,1);assert.equal(counts().initialized,2);});
test('ID existente inacessível não é substituído',()=>{const {c,properties,counts}=setup('existing-id');c.EpiStore.initialize=()=>{throw new Error('Acesso negado simulado')};assert.throws(()=>c.initializeApplication(),/negado/);assert.equal(properties.SPREADSHEET_ID,'existing-id');assert.equal(counts().created,0);});
