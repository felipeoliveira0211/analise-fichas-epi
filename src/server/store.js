var EpiStore = (function () {
  var schema = {
    Workers: ['id', 'name', 'sector', 'role', 'ges'],
    Sheets: ['id', 'workerId', 'state', 'updatedAt', 'revision'],
    Entries: ['id', 'sheetId', 'ca', 'date', 'physicalExpiry', 'position'],
    Lifetimes: ['ca', 'days'],
    CaIndex: ['ca', 'name', 'approvedProtection', 'caExpiry'],
    Metadata: ['source', 'referenceDate', 'updatedAt']
  };
  function database() {
    var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('Configure SPREADSHEET_ID nas propriedades do script.');
    return SpreadsheetApp.openById(id);
  }
  function table(name) {
    if (!schema[name]) throw new Error('Tabela desconhecida.');
    var db = database(), tab = db.getSheetByName(name);
    if (!tab) throw new Error('Execute setupDatabase pelo editor do Apps Script.');
    var header = tab.getRange(1, 1, 1, schema[name].length).getValues()[0];
    if (header.join('|') !== schema[name].join('|')) throw new Error('Cabeçalho inesperado em ' + name + '.');
    return tab;
  }
  function initialize() {
    var db = database();
    Object.keys(schema).forEach(function (name) {
      var tab = db.getSheetByName(name);
      if (!tab) { tab = db.insertSheet(name); tab.getRange(1, 1, 1, schema[name].length).setValues([schema[name]]); tab.setFrozenRows(1); }
      table(name);
    });
  }
  function rows(name) {
    var tab = table(name), count = tab.getLastRow() - 1;
    if (count < 1) return [];
    return tab.getRange(2, 1, count, schema[name].length).getValues().map(function (cells) {
      var obj = {}; schema[name].forEach(function (key, i) { obj[key] = cells[i]; }); return obj;
    });
  }
  function text(value) {
    // Keep dates and numeric CAs as text; prevent spreadsheet formula injection.
    return typeof value === 'number' ? value : "'" + String(value == null ? '' : value);
  }
  function replace(name, objects) {
    var tab = table(name), oldCount = Math.max(0, tab.getLastRow() - 1);
    var values = objects.map(function(obj) { return schema[name].map(function(key) { return text(obj[key]); }); });
    if (values.length) tab.getRange(2, 1, values.length, schema[name].length).setValues(values);
    if (oldCount > values.length) tab.getRange(values.length + 2, 1, oldCount - values.length, schema[name].length).clearContent();
  }
  function locked(fn) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try { return fn(); } finally { lock.releaseLock(); }
  }
  return { initialize: initialize, rows: rows, replace: replace, locked: locked };
})();
