const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup() {
 const tabs=new Map(); let locked=false;
 const db={getSheetByName:n=>tabs.get(n),insertSheet:n=>{
  const tab={cells:[],setFrozenRows(){},getLastRow(){return this.cells.length},getRange(row,col,height,width){
   return {getValues:()=>Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>tab.cells[row+r-1]?.[col+c-1]??'')),
    setValues:values=>values.forEach((cells,r)=>{tab.cells[row+r-1] ||= [];cells.forEach((v,c)=>{tab.cells[row+r-1][col+c-1]=v})}),
    clearContent:()=>{for(let r=row-1;r<row+height-1;r++)for(let c=col-1;c<col+width-1;c++)tab.cells[r][c]=''}};
  }};tabs.set(n,tab);return tab;
 }};
 const c=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'fake-spreadsheet-id'})},SpreadsheetApp:{openById:()=>db},LockService:{getScriptLock:()=>({waitLock(){locked=true},releaseLock(){locked=false}})}});
 vm.runInContext(fs.readFileSync('src/server/store.js','utf8'),c);
 return {store:c.EpiStore,tabs,isLocked:()=>locked};
}
test('initialisation repeatable preserves existing table data and rejects unexpected headers',()=>{
 const {store:s,tabs}=setup();s.initialize();assert.equal(tabs.size,6);
 s.replace('Lifetimes',[{ca:'123',days:30}]);const before=JSON.stringify(tabs.get('Lifetimes').cells);s.initialize();assert.equal(JSON.stringify(tabs.get('Lifetimes').cells),before);
 tabs.get('Workers').cells[0][0]='wrong';assert.throws(()=>s.initialize(),/Cabeçalho inesperado/);
});
test('text sent to spreadsheet is escaped, number of days remains numeric; removed rows cleared',()=>{
 const {store:s,tabs}=setup();s.initialize();s.replace('Workers',[{id:'w1',name:'=IMPORTXML("fake")',sector:'Setor',role:'Cargo',ges:'A'},{id:'w2',name:'+1',sector:'Setor',role:'Cargo',ges:'B'}]);
 assert.equal(tabs.get('Workers').cells[1][1],"'=IMPORTXML(\"fake\")");
 s.replace('Workers',[{id:'w1',name:'Pessoa fictícia',sector:'Setor',role:'Cargo',ges:'A'}]);assert.ok(tabs.get('Workers').cells[2].every(v=>v===''));
 s.replace('Lifetimes',[{ca:'123',days:30}]);assert.equal(tabs.get('Lifetimes').cells[1][1],30);
});
test('lock always released on failure',()=>{const {store:s,isLocked}=setup();assert.throws(()=>s.locked(()=>{assert.equal(isLocked(),true);throw new Error('fake error')}));assert.equal(isLocked(),false);});
