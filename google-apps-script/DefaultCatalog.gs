/* Resumable staging: the bundled archive is used only for an empty catalog. */
var EpiDefaultCatalog = (function () {
  var KEY='CA_DEFAULT_LOAD_STATE';
  function properties(){return PropertiesService.getScriptProperties();}
  function state(){var raw=properties().getProperty(KEY);return raw?JSON.parse(raw):null;}
  function save(s){properties().setProperty(KEY,JSON.stringify(s));}
  function active(){var s=state();return !!(s&&!s.complete);}
  function status(store){
    var s=state(),m=EpiBundledBase.manifest,total=m.statistics.uniqueCas,count=store.count('CaIndex');
    var pending=s&&!s.complete || !count;
    return {status:pending?'pending':'ready',loaded:s?s.rows:0,total:total,fileName:m.fileName,fileModifiedAt:m.fileModifiedAt,referenceNote:m.referenceNote,statistics:m.statistics,classificationCounts:m.classificationCounts||null,version:m.version,loadedVersion:s&&s.complete?s.version:null,updateAvailable:!!(count&&s&&s.complete&&s.version!==m.version)};
  }
  function decode(index){
    var bytes=Utilities.base64Decode(EpiBundledBase.chunks[index]);
    var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
    if(hash!==EpiBundledBase.manifest.chunks[index].sha256)throw new Error('Checksum inválido no pacote padrão. Atualize DefaultData com o arquivo completo.');
    var blob=Utilities.newBlob(bytes,'application/x-gzip','chunk.json.gz');
    var tuples=JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8'));
    if(tuples.length!==EpiBundledBase.manifest.chunks[index].records)throw new Error('Quantidade inesperada no pacote padrão.');
    return tuples.map(function(r){EpiDomain.ca(r[0]);if(r[3])EpiDomain.date(r[3]);return {ca:r[0],name:r[1],approvedProtection:r[2],caExpiry:r[3]};});
  }
  function load(store,replaceExisting){
    var m=EpiBundledBase.manifest,s=state();
    if(store.count('CaIndex')>0&&s&&!s.complete&&s.phase==='stage'&&!s.replacing)throw new Error('O catálogo foi preenchido durante a preparação. Ele foi preservado; revise o carregamento padrão.');
    if(store.count('CaIndex')>0&&(!s||s.complete)&&!replaceExisting)return {status:'preserved',connection:store.connection(),base:status(store)};
    if(s&&!s.complete&&s.version!==m.version)throw new Error('Pacote alterado durante a preparação. Preserve o catálogo e restaure a versão anterior para concluir.');
    if(!s||s.complete){
      var existingRows=store.rows('CaIndex');
      store.replace('CaDefaultStage',[]);store.replace('CaDefaultBackup',existingRows);
      s={version:m.version,next:0,rows:0,phase:'stage',complete:false,replacing:existingRows.length>0,oldMetadata:store.rows('Metadata')};save(s);
    }
    for(var step=0;step<4&&s.next<EpiBundledBase.chunks.length;step++){
      var rows=decode(s.next);store.writeAt('CaDefaultStage',s.rows,rows);s.rows+=rows.length;s.next++;save(s);
    }
    if(s.next===EpiBundledBase.chunks.length){
      if(store.count('CaDefaultStage')!==m.statistics.uniqueCas)throw new Error('Contagem do catálogo em preparação inválida.');
      if(!s.commitAt){s.commitAt=new Date().toISOString();s.phase='commit';save(s);}
      var currentMeta=store.rows('Metadata')[0]||{},oldMeta=s.oldMetadata[0]||{};
      if(currentMeta.updatedAt&&currentMeta.updatedAt!==oldMeta.updatedAt&&currentMeta.updatedAt!==s.commitAt)throw new Error('Metadados alterados durante o carregamento. Base existente preservada; revise a preparação.');
      try{
        store.replace('CaIndex',store.rows('CaDefaultStage'));
        store.replace('Metadata',[{source:m.source+'; SHA-256: '+m.fileSha256,referenceDate:m.referenceDate,updatedAt:s.commitAt}]);
      }catch(error){
        try{store.replace('CaIndex',store.rows('CaDefaultBackup'));store.replace('Metadata',s.oldMetadata);}catch(_){throw new Error('Falha ao recuperar a base padrão. Preserve fichas e vida útil; verifique CaIndex e Metadata.');}
        throw new Error('Falha no carregamento final. A preparação foi preservada; tente retomar.');
      }
      s.complete=true;save(s);
      // The staging sheet is retained for recovery; it contains no workers.
    }
    return {status:s.complete?'ready':'pending',base:status(store),connection:store.connection()};
  }
  return {status:status,load:load,active:active};
})();
function epiLoadDefaultBase(replaceExisting){return EpiStore.locked(function(){return EpiDefaultCatalog.load(EpiStore,replaceExisting===true);});}
