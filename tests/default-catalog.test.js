const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const D=require('../src/domain/analysis');
function setup(){
 const tables={CaIndex:[],CaDefaultStage:[],CaDefaultBackup:[],Metadata:[],Workers:[{id:'fictional-worker'}],Lifetimes:[{ca:'1',days:30}]};const props={};
 const manifest={version:'test-version',statistics:{uniqueCas:12},chunks:Array.from({length:6},()=>({records:2})),source:'Arquivo fictício',referenceDate:'',fileSha256:'fictional-digest'};
 const chunks=Array.from({length:6},(_,i)=>Buffer.from(JSON.stringify([[String(i*2+1),'EPI fictício','Proteção auditiva','31/12/2030'],[String(i*2+2),'EPI fictício','','']])).toString('base64'));
 manifest.chunks.forEach((part,i)=>{part.sha256=crypto.createHash('sha256').update(Buffer.from(chunks[i],'base64')).digest('hex')});
 const store={rows:n=>structuredClone(tables[n]),count:n=>tables[n].length,replace:(n,v)=>{tables[n]=structuredClone(v)},writeAt:(n,offset,rows)=>rows.forEach((r,i)=>{tables[n][offset+i]=structuredClone(r)}),locked:fn=>fn()};
 const properties={getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v}};
 const c=vm.createContext({EpiDomain:D,EpiStore:store,EpiBundledBase:{manifest,chunks},PropertiesService:{getScriptProperties:()=>properties},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,bytes)=>Array.from(crypto.createHash('sha256').update(bytes).digest()),base64Decode:s=>Buffer.from(s,'base64'),newBlob:b=>b,ungzip:b=>({getDataAsString:()=>b.toString()})}});
 vm.runInContext(fs.readFileSync('src/server/default-catalog.js','utf8'),c);store.connection=()=>({connected:true,caCount:tables.CaIndex.length,defaultBase:c.EpiDefaultCatalog.status(store)});
 return {c,store,tables,props,properties};
}
test('base padrão em etapas não expõe registros parciais e preserva trabalhadores/prazos',()=>{const {c,tables}=setup();let first=c.epiLoadDefaultBase();assert.equal(first.status,'pending');assert.equal(first.base.loaded,8);assert.equal(tables.CaIndex.length,0);assert.equal(tables.CaDefaultStage.length,8);let final=c.epiLoadDefaultBase();assert.equal(final.status,'ready');assert.equal(tables.CaIndex.length,12);assert.equal(tables.Metadata[0].referenceDate,'');assert.equal(tables.Workers[0].id,'fictional-worker');assert.equal(tables.Lifetimes[0].days,30);assert.equal(c.epiLoadDefaultBase().status,'preserved');});
test('catálogo existente só é substituído com ação explícita',()=>{const {c,tables}=setup();tables.CaIndex=[{ca:'999',name:'EPI fictício anterior'}];assert.equal(c.epiLoadDefaultBase().status,'preserved');assert.equal(tables.CaIndex[0].ca,'999');c.epiLoadDefaultBase(true);c.epiLoadDefaultBase();assert.equal(tables.CaIndex.length,12);assert.equal(tables.CaDefaultBackup[0].ca,'999');});
test('interrupção após escrever chunk antes de salvar progresso é idempotente',()=>{const {c,properties,tables}=setup();const original=properties.setProperty;let writes=0;properties.setProperty=(k,v)=>{writes++;if(writes===2)throw new Error('interrupção simulada');original(k,v)};assert.throws(()=>c.epiLoadDefaultBase(),/interrupção/);properties.setProperty=original;c.epiLoadDefaultBase();c.epiLoadDefaultBase();assert.equal(tables.CaIndex.length,12);assert.equal(new Set(tables.CaIndex.map(r=>r.ca)).size,12);});
test('falha final recupera catálogo anterior e permite retomar',()=>{const {c,store,tables}=setup();tables.CaIndex=[{ca:'999',name:'EPI anterior'}];tables.Metadata=[{updatedAt:'old-revision',source:'old-source'}];c.epiLoadDefaultBase(true);const replace=store.replace;let fail=true;store.replace=(n,v)=>{if(n==='Metadata'&&fail){fail=false;throw new Error('falha simulada')}replace(n,v)};assert.throws(()=>c.epiLoadDefaultBase(),/tente retomar/);assert.equal(tables.CaIndex[0].ca,'999');assert.equal(tables.Metadata[0].updatedAt,'old-revision');c.epiLoadDefaultBase();assert.equal(tables.CaIndex.length,12);});
test('pacote real tem checksums corretos, CAs únicos, datas válidas e referência desconhecida',()=>{
 const m=JSON.parse(fs.readFileSync('data/default-ca/manifest.json','utf8'));const seen=new Set();let missing=0,total=0;
 for(const part of m.chunks){const blob=fs.readFileSync('data/default-ca/'+part.file);assert.equal(crypto.createHash('sha256').update(blob).digest('hex'),part.sha256);const rows=JSON.parse(zlib.gunzipSync(blob));assert.equal(rows.length,part.records);for(const r of rows){assert.equal(r.length,4);D.ca(r[0]);assert.equal(seen.has(r[0]),false);seen.add(r[0]);if(r[3])D.date(r[3]);if(!r[2])missing++;total++;}}
 assert.equal(total,36136);assert.equal(total,m.statistics.uniqueCas);assert.equal(missing,16359);assert.equal(missing,m.statistics.casWithoutReliableProtection);assert.equal(m.referenceDate,'');assert.match(m.fileModifiedAt,/^2022-08-16/);
});

test('bloco alterado é rejeitado antes de escrever dados',()=>{const {c,tables}=setup();c.EpiBundledBase.chunks[0]=Buffer.from('conteúdo fictício alterado').toString('base64');assert.throws(()=>c.epiLoadDefaultBase(),/Checksum inválido/);assert.equal(tables.CaIndex.length,0);assert.equal(tables.CaDefaultStage.length,0);});
test('pacote atualizado não recarrega base existente e informa substituição disponível',()=>{const {c,tables}=setup();c.epiLoadDefaultBase();c.epiLoadDefaultBase();c.EpiBundledBase.manifest.version='new-test-version';const before=JSON.stringify(tables);const result=c.epiLoadDefaultBase();assert.equal(result.status,'preserved');assert.equal(result.base.updateAvailable,true);assert.equal(result.base.loadedVersion,'test-version');assert.equal(JSON.stringify(tables),before);});
test('base real aplica dispensa por nome aos demais EPIs e mantém revisão nos grupos indefinidos',()=>{
 const m=JSON.parse(fs.readFileSync('data/default-ca/manifest.json')),counts={auditiva:0,dermica:0,outros:0,revisao:0};let noExpiry=0;
 for(const part of m.chunks)for(const [,name,approvedProtection,date]of JSON.parse(zlib.gunzipSync(fs.readFileSync('data/default-ca/'+part.file)))){counts[D.classify({name,approvedProtection})]++;if(!date)noExpiry++;}
 assert.deepEqual(counts,{auditiva:428,dermica:497,outros:33805,revisao:1406});assert.equal(noExpiry,0);assert.equal(m.expiryPolicy,'latest-valid-date-per-ca');assert.equal(m.projectionVersion,3);
});
test('CA 13990 tem validade do certificado, sem inferir expiração a partir da emissão',()=>{
 const m=JSON.parse(fs.readFileSync('data/default-ca/manifest.json'));let found;
 for(const part of m.chunks)for(const r of JSON.parse(zlib.gunzipSync(fs.readFileSync('data/default-ca/'+part.file))))if(r[0]==='13990')found=r;
 assert.equal(found[3],'22/08/2028');const evidence=m.corrections.find(r=>r.ca==='13990');assert.equal(evidence.issuanceDate,'22/08/2023');assert.match(evidence.source,/Prints/);
});
