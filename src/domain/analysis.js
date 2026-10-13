/* Shared pure domain module: Node.js and Apps Script V8. */
var EpiDomain = (function () {
  'use strict';
  var GROUP = { AUDITIVA: 'auditiva', DERMICA: 'dermica', OUTROS: 'outros', REVISAO: 'revisao' };
  function ca(value) {
    var v = String(value == null ? '' : value).trim();
    if (!/^\d{1,10}$/.test(v) || Number(v) === 0) throw new Error('CA inválido: informe apenas números positivos.');
    return String(Number(v));
  }
  function date(value) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value));
    if (!m) throw new Error('Data inválida. Use DD/MM/AAAA.');
    var d = Number(m[1]), month = Number(m[2]), y = Number(m[3]);
    if (y < 1900 || y > 2100) throw new Error('Ano deve estar entre 1900 e 2100.');
    var time = Date.UTC(y, month - 1, d), parsed = new Date(time);
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== d) throw new Error('Data inexistente.');
    return time;
  }
  function fold(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  // Names may identify equipment outside the periodicity scope; they do not
  // assert approved protection or admit chemical/auditory equipment into scope.
  function nameOnlyOther(name) {
    var n = fold(name);
    if (!n.trim() || /indisponivel|revisar|\b(auditiv\w*|ruido\w*|creme\w*)\b/.test(n)) return false;
    if (/\bluva\w*\b/.test(n)) {
      return !/\bquimic\w*\b/.test(n) && /\b(mecanic\w*|termic\w*|abrasiv\w*|escoriant\w*|vibrac\w*|isolante\w*|procedimento\w*|cirurgic\w*|cobertura|malha de aco)\b/.test(n);
    }
    return /\b(capacete|oculos|vestimenta|macacao|calca|manga|mangote|perneira|calcado|botina|bota|sobre-bota|cinturao|talabarte|trava[- ]?queda|respirador|mascara|capuz|balaclava|colete|meia|protetor facial|cadeira suspensa|bracadeira)\b/.test(n);
  }
  function classify(record) {
    if (!record) return GROUP.REVISAO;
    if (!String(record.approvedProtection || '').trim()) return nameOnlyOther(record.name) ? GROUP.OUTROS : GROUP.REVISAO;
    var p = fold(record.approvedProtection);
    var auditory = /\b(auditiv\w*|ruido\w*)\b/.test(p);
    var chemical = /\bquimic\w*\b/.test(p) && /\b(maos|membros superiores|pele|cutane\w*|dermic\w*)\b/.test(p);
    if (auditory && chemical) return GROUP.REVISAO;
    if (auditory) return GROUP.AUDITIVA;
    if (chemical) return GROUP.DERMICA;
    return GROUP.OUTROS;
  }
  function validLife(value) { return Number.isInteger(value) && value > 0 && value <= 36500; }
  function validateSheet(sheet) {
    if (!sheet || !sheet.id || !sheet.worker || !sheet.worker.id) throw new Error('Ficha e trabalhador precisam de IDs.');
    ['name', 'sector', 'role', 'ges'].forEach(function (field) {
      if (typeof sheet.worker[field] !== 'string' || !sheet.worker[field].trim() || sheet.worker[field].length > 200) throw new Error('Preencha nome, setor, cargo e GES (até 200 caracteres).');
    });
    if (sheet.worker.company != null && (typeof sheet.worker.company !== 'string' || sheet.worker.company.length > 200)) throw new Error('Empresa deve ter até 200 caracteres.');
    if (!Array.isArray(sheet.entries)) throw new Error('Lançamentos inválidos.');
    var seen = {};
    sheet.entries.forEach(function (entry) {
      if (!entry.id || seen[entry.id]) throw new Error('ID de lançamento ausente ou duplicado.');
      seen[entry.id] = true; ca(entry.ca); date(entry.date);
    });
    return sheet;
  }
  function analyze(sheet, catalog, lifetimes, metadata, asOf) {
    validateSheet(sheet);
    catalog = catalog || {}; lifetimes = lifetimes || {}; metadata = metadata || {};
    var now = asOf == null ? Date.now() : asOf;
    var reference;
    try { reference = date(metadata.referenceDate); } catch (_) { reference = NaN; }
    var age = (now - reference) / 86400000;
    var stale = !metadata.source || !Number.isFinite(age) || age > 30 || age < -1;
    var previous = {};
    var rows = sheet.entries.map(function (entry, index) {
      return { entry: entry, index: index, time: date(entry.date) };
    }).sort(function (a, b) { return a.time - b.time || a.index - b.index; }).map(function (item) {
      var entry = item.entry, number = ca(entry.ca), record = catalog[number], group = classify(record);
      var row = { id: entry.id, ca: number, date: entry.date, name: record ? record.name : 'CA não identificado', group: group,
        interval: null, limit: null, status: 'Sem análise de periodicidade', caExpiry: record && record.caExpiry || null,
        usefulLifeDays: group === GROUP.DERMICA ? 30 : validLife(lifetimes[number]) ? lifetimes[number] : null, savedAt: entry.savedAt || '', physicalExpiry: entry.physicalExpiry || null, caStatus: 'Situação atual do CA precisa ser confirmada', source: metadata.source || 'Indisponível', referenceDate: metadata.referenceDate || null };
      if (row.physicalExpiry) date(row.physicalExpiry);
      if (record && record.caExpiry) {
        try { row.caAtDelivery = item.time <= date(record.caExpiry) ? 'Dentro da validade informada do CA' : 'Após a validade informada do CA'; }
        catch (_) { row.caAtDelivery = 'Validade do CA indisponível'; }
      } else row.caAtDelivery = 'Validade do CA indisponível';
      if (!stale && record) row.caStatus = 'Consultar a fonte para confirmar situação atual; referência recente';
      if (group === GROUP.REVISAO) row.status = 'Revisão manual necessária';
      if (group === GROUP.AUDITIVA || group === GROUP.DERMICA) {
        var prev = previous[group];
        row.status = 'Marco inicial';
        if (prev) {
          row.interval = (item.time - prev.time) / 86400000;
          row.previousCa = prev.ca;
          row.limit = group === GROUP.DERMICA ? 30 : validLife(lifetimes[prev.ca]) ? lifetimes[prev.ca] : null;
          row.status = row.limit == null ? 'Vida útil não cadastrada' : row.interval <= row.limit ? 'Dentro do prazo' : 'Fora do prazo';
        }
        previous[group] = { ca: number, time: item.time };
      }
      return row;
    });
    return { sheetId: sheet.id, worker: sheet.worker, rows: rows, warnings: rows.some(function(r) { return r.group === GROUP.REVISAO; }) ? ['CAs pendentes de revisão podem alterar as sequências e os intervalos. A análise é parcial.'] : [], metadata: metadata, stale: stale };
  }
  return { GROUP: GROUP, ca: ca, date: date, classify: classify, validLife: validLife, validateSheet: validateSheet, analyze: analyze };
})();
if (typeof module !== 'undefined') module.exports = EpiDomain;
