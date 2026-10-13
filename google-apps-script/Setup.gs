/* Run manually in the authenticated Apps Script editor. Never shares resources. */
function initializeApplication() {
  return EpiStore.locked(function () {
    var properties = PropertiesService.getScriptProperties();
    var existing = properties.getProperty('SPREADSHEET_ID'), created = false;
    if (!existing) {
      var spreadsheet = SpreadsheetApp.create('Análise de Fichas EPI — banco de dados');
      properties.setProperty('SPREADSHEET_ID',spreadsheet.getId()); created = true;
    }
    // An inaccessible existing ID is an error, never an excuse to replace the database.
    EpiStore.initialize();

    var result = EpiStore.connection();
    result.created = created;
    console.log(JSON.stringify(result));
    return result;
  });
}
function verifyApplicationConnection() {
  return EpiStore.locked(function () { var result = EpiStore.connection();console.log(JSON.stringify(result));return result; });
}
function epiConnectionStatus() { return EpiStore.locked(function () { return EpiStore.connection(); }); }
function epiPreviewCatalog(payload) { return EpiStore.locked(function () { return EpiCatalog.preview(EpiStore,payload); }); }
function epiImportCatalog(payload, confirmation) { return EpiStore.locked(function () { if (typeof EpiDefaultCatalog !== 'undefined' && EpiDefaultCatalog.active()) throw new Error('Conclua o carregamento padrão antes de importar outro catálogo.'); return EpiCatalog.commit(EpiStore,payload,confirmation); }); }

// Administrator operation in the private Apps Script project editor.
// Re-run this function to resume; it never modifies workers, entries or lifetimes.
function adminUpdateOfficialBase() {
  return EpiStore.locked(function () {
    EpiStore.initialize();
    var current = EpiDefaultCatalog.status(EpiStore);
    if (current.status === 'ready' && current.loadedVersion === current.version) { console.log('Base oficial já atualizada.'); return {status:'ready',base:current,connection:EpiStore.connection()}; }
    var deadline = Date.now() + 240000, result;
    do {
      result = EpiDefaultCatalog.load(EpiStore,!EpiDefaultCatalog.active());
    } while (result.status === 'pending' && Date.now() < deadline);
    console.log(JSON.stringify({status:result.status,loaded:result.base.loaded,total:result.base.total,updatedAt:result.connection.updatedAt}));
    return result;
  });
}
