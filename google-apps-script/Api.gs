function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Análise de fichas de EPI');
}
function setupDatabase() { return EpiStore.locked(function () { EpiStore.initialize(); return 'Tabelas inicializadas'; }); }
function epiBootstrap() { return EpiStore.locked(epiBootstrap_); }
function epiBootstrap_() {
  var meta = EpiCatalog.metadata(EpiStore), lives = {};
  EpiStore.rows('Lifetimes').forEach(function (r) { lives[EpiDomain.ca(r.ca)] = Number(r.days); });
  return { catalog: {}, metadata: meta, lifetimes: lives, sheets: epiListSheets_(), connection: EpiStore.connection() };
}
function epiListSheets() { return EpiStore.locked(epiListSheets_); }
function epiListSheets_() {
  var workers = {};
  EpiStore.rows('Workers').forEach(function (w) { workers[w.id] = w; });
  return EpiStore.rows('Sheets').map(function(s) { return { id: s.id, worker: workers[s.workerId], state: s.state, updatedAt: s.updatedAt, revision: Number(s.revision) }; });
}
function epiLoadSheet(id) { return EpiStore.locked(function () { return epiLoadSheet_(id); }); }
function epiLoadSheet_(id) {
  var sheet = EpiStore.rows('Sheets').find(function(s) { return s.id === id; });
  if (!sheet) throw new Error('Ficha não encontrada.');
  var worker = EpiStore.rows('Workers').find(function(w) { return w.id === sheet.workerId; });
  var entries = EpiStore.rows('Entries').filter(function(e) { return e.sheetId === id; }).sort(function(a,b) { return Number(a.position) - Number(b.position); }).map(function(e) {
    return { id: e.id, ca: String(e.ca), date: String(e.date), physicalExpiry: String(e.physicalExpiry || ''), savedAt: String(e.savedAt || '') };
  });
  return { id: sheet.id, worker: worker, state: sheet.state, revision: Number(sheet.revision), updatedAt: sheet.updatedAt, entries: entries };
}
function epiSaveSheet(input) {
  EpiDomain.validateSheet(input);
  ['id'].forEach(function(k) { if (!/^[\w-]{1,80}$/.test(input[k])) throw new Error('ID inválido.'); });
  if (!/^[\w-]{1,80}$/.test(input.worker.id)) throw new Error('ID de trabalhador inválido.');
  if (!['draft', 'complete'].includes(input.state)) throw new Error('Estado da ficha inválido.');
  input.entries.forEach(function(e) { if (e.physicalExpiry) EpiDomain.date(e.physicalExpiry); });
  return EpiStore.locked(function () {
    var sheets = EpiStore.rows('Sheets'), workers = EpiStore.rows('Workers'), entries = EpiStore.rows('Entries');
    var existing = sheets.find(function(s) { return s.id === input.id; });
    if (existing && (existing.workerId !== input.worker.id || Number(existing.revision) !== Number(input.revision))) throw new Error('Ficha alterada em outra sessão. Reabra a versão salva antes de continuar. O rascunho local permanece disponível.');
    // Snapshot for best-effort recovery: Sheets has no multi-table transactions.
    var oldSheets = sheets.slice(), oldWorkers = workers.slice(), oldEntries = entries.slice();
    var savedAt = new Date().toISOString();
    var revision = existing ? Number(existing.revision) + 1 : 1;
    sheets = sheets.filter(function(s) { return s.id !== input.id; });
    sheets.push({ id: input.id, workerId: input.worker.id, state: input.state, updatedAt: savedAt, revision: revision });
    workers = workers.filter(function(w) { return w.id !== input.worker.id; });
    workers.push({ id: input.worker.id, name: input.worker.name.trim(), sector: input.worker.sector.trim(), role: input.worker.role.trim(), ges: input.worker.ges.trim(), company: (input.worker.company || '').trim() });
    entries = entries.filter(function(e) { return e.sheetId !== input.id; });
    input.entries.forEach(function(e, i) { var old = oldEntries.find(function(r) { return r.sheetId === input.id && r.id === e.id; }); var unchanged = old && String(old.ca) === EpiDomain.ca(e.ca) && old.date === e.date && (old.physicalExpiry || '') === (e.physicalExpiry || ''); entries.push({ id: e.id, sheetId: input.id, ca: EpiDomain.ca(e.ca), date: e.date, physicalExpiry: e.physicalExpiry || '', position: i, savedAt: unchanged && old.savedAt ? old.savedAt : savedAt }); });
    try { EpiStore.replace('Workers', workers); EpiStore.replace('Entries', entries); EpiStore.replace('Sheets', sheets); }
    catch (error) {
      try { EpiStore.replace('Workers', oldWorkers); EpiStore.replace('Entries', oldEntries); EpiStore.replace('Sheets', oldSheets); }
      catch (_) { throw new Error('Falha de gravação e recuperação. Preserve o rascunho local e verifique a planilha antes de repetir.'); }
      throw new Error('Falha de gravação; versão anterior restaurada. Preserve o rascunho local.');
    }
    return { id: input.id, revision: revision, updatedAt: savedAt, entries: entries.filter(function(e) { return e.sheetId === input.id; }).map(function(e) { return {id:e.id,savedAt:e.savedAt}; }) };
  });
}
function epiSaveLifetime(number, days) {
  number = EpiDomain.ca(number); days = Number(days);
  if (!EpiDomain.validLife(days)) throw new Error('Vida útil deve ser um inteiro entre 1 e 36500 dias.');
  return EpiStore.locked(function () {
    var rows = EpiStore.rows('Lifetimes').filter(function(r) { return String(r.ca) !== number; });
    rows.push({ ca: number, days: days }); EpiStore.replace('Lifetimes', rows); return { ca: number, days: days };
  });
}
function epiDeleteLifetime(number) {
  number = EpiDomain.ca(number);
  return EpiStore.locked(function () { EpiStore.replace('Lifetimes', EpiStore.rows('Lifetimes').filter(function(r) { return String(r.ca) !== number; })); return number; });
}
function epiAnalyzeSheet(input) {
  EpiDomain.validateSheet(input);
  return EpiStore.locked(function () {
    if (typeof EpiDefaultCatalog !== 'undefined' && EpiDefaultCatalog.active()) throw new Error('A base padrão ainda está carregando. Aguarde a conclusão em Base e conexão.');
    var data = EpiCatalog.load(EpiStore,input.entries.map(function(e) { return e.ca; })), lives = {};
    EpiStore.rows('Lifetimes').forEach(function(r) { lives[EpiDomain.ca(r.ca)] = Number(r.days); });
    if (!EpiStore.count('CaIndex')) throw new Error('Base de CAs vazia. Importe os dados oficiais na seção Base e conexão.');
    return EpiDomain.analyze(input,data.index,lives,data.metadata);
  });
}
function epiGenerateReports(filters, localSheets) {
  filters = filters || {}; EpiReports.validate(filters);
  return EpiStore.locked(function () {
    if (typeof EpiDefaultCatalog !== 'undefined' && EpiDefaultCatalog.active()) throw new Error('Aguarde o carregamento da base para gerar relatórios.');
    var sheets;
    if (localSheets != null) {
      if (!Array.isArray(localSheets)) throw new Error('Fichas locais inválidas.');
      localSheets.forEach(EpiDomain.validateSheet); sheets = localSheets;
    } else {
      var workers = {}, entries = {};
      EpiStore.rows('Workers').forEach(function(w) { workers[w.id] = w; });
      EpiStore.rows('Entries').forEach(function(e) { (entries[e.sheetId] || (entries[e.sheetId] = [])).push(e); });
      sheets = EpiStore.rows('Sheets').map(function(s) { return {id:s.id,worker:workers[s.workerId],state:s.state,updatedAt:s.updatedAt,entries:(entries[s.id] || []).sort(function(a,b) { return Number(a.position)-Number(b.position); })}; });
    }
    sheets = sheets.filter(function(s) { return EpiReports.matches(s,filters); });
    if (!EpiStore.count('CaIndex')) throw new Error('Base de CAs vazia. Carregue a base antes de gerar relatórios.');
    var numbers = []; sheets.forEach(function(s) { s.entries.forEach(function(e) { numbers.push(e.ca); }); });
    var data = EpiCatalog.load(EpiStore,numbers), lives = {};
    EpiStore.rows('Lifetimes').forEach(function(r) { lives[EpiDomain.ca(r.ca)] = Number(r.days); });
    return EpiReports.create(sheets,data.index,lives,data.metadata,filters);
  });
}
