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
    if (typeof EpiDefaultCatalog !== 'undefined') EpiDefaultCatalog.load(EpiStore);
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
