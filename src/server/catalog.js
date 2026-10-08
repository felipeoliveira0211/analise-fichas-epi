/* Imported official data adapter. No requests to CAEPI and no scraping. */
var EpiCatalog = (function () {
  function metadata(store) {
    var meta = store.rows('Metadata')[0] || {};
    return {source:meta.source || '',referenceDate:meta.referenceDate || '',updatedAt:meta.updatedAt || ''};
  }
  function load(store, numbers) {
    var index = {}, wanted = numbers ? new Set(numbers.map(EpiDomain.ca)) : null;
    store.rows('CaIndex').forEach(function (row) {
      var number = EpiDomain.ca(row.ca);
      if (wanted && !wanted.has(number)) return;
      if (index[number]) throw new Error('CA duplicado na base: ' + number + '. Revise a importação.');
      index[number] = { ca: number, name: String(row.name || ''), approvedProtection: String(row.approvedProtection || ''), caExpiry: String(row.caExpiry || '') };
    });
    return { index: index, metadata: metadata(store) };
  }
  function signature(prepared) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify({records:prepared.records,metadata:prepared.metadata}), Utilities.Charset.UTF_8).map(function(b) { return ('0' + ((b+256)%256).toString(16)).slice(-2); }).join('');
  }
  function preview(store, payload) {
    var prepared = EpiImport.prepare(payload);
    return {count:prepared.records.length,groups:prepared.groups,warnings:prepared.warnings.slice(0,100),warningCount:prepared.warnings.length,sample:prepared.records.slice(0,5),signature:signature(prepared),baseRevision:metadata(store).updatedAt,previousCount:store.count('CaIndex')};
  }
  function commit(store, payload, confirmation) {
    var prepared = EpiImport.prepare(payload);
    if (!confirmation || confirmation.signature !== signature(prepared)) throw new Error('Arquivo alterado. Gere uma nova prévia.');
    if (String(confirmation.baseRevision || '') !== String(metadata(store).updatedAt || '')) throw new Error('Base atualizada em outra sessão. Gere uma nova prévia.');
    var oldRows = store.rows('CaIndex'), oldMetadata = store.rows('Metadata');
    var meta = {source:prepared.metadata.source,referenceDate:prepared.metadata.referenceDate,updatedAt:new Date().toISOString()};
    try { store.replace('CaIndex',prepared.records);store.replace('Metadata',[meta]); }
    catch (error) {
      try { store.replace('CaIndex',oldRows);store.replace('Metadata',oldMetadata); }
      catch (_) { throw new Error('Falha na importação e recuperação. Verifique CaIndex e Metadata na planilha antes de repetir.'); }
      throw new Error('Importação falhou; base anterior restaurada.');
    }
    return {count:prepared.records.length,metadata:meta};
  }
  return {load:load,metadata:metadata,preview:preview,commit:commit};
})();
if (typeof module !== 'undefined') module.exports = EpiCatalog;
