/* Shared pure domain module: Node.js and Apps Script V8. */
var EpiDomain = (function () {
  'use strict';
  var GROUP = { AUDITIVA: 'auditiva', DERMICA: 'dermica', OUTROS: 'outros', REVISAO: 'revisao' };
  function ca(value) {
    var v = String(value == null ? '' : value).trim();
    if (!/^\d{1,10}$/.test(v) || Number(v) === 0) throw new Error('CA inválido: informe apenas números positivos.');
    return String(Number(v));
  }
  function parseDate(value, maxYear) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value));
    if (!m) throw new Error('Data inválida. Use DD/MM/AAAA.');
    var d = Number(m[1]), month = Number(m[2]), y = Number(m[3]);
    if (y < 1900 || y > maxYear) throw new Error('Ano deve estar entre 1900 e ' + maxYear + '.');
    var time = Date.UTC(y, month - 1, d), parsed = new Date(time);
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== d) throw new Error('Data inexistente.');
    return time;
  }
  function date(value) { return parseDate(value,2100); }
  function certificateDate(value) { return parseDate(value,9999); }
  function today(now) {
    var parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
    var values = {}; parts.forEach(function(p) { values[p.type] = p.value; });
    return Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day));
  }
  function certificateStatus(record, now) {
    if (!record) return {label:'CA não identificado',tone:'warn',days:null};
    var situation = fold(record.caSituation).trim();
    if (situation === 'suspenso') return {label:'CA suspenso',tone:'bad',days:null};
    if (situation === 'cancelado') return {label:'CA cancelado',tone:'bad',days:null};
    var days;
    try { days = (certificateDate(record.caExpiry)-today(now))/86400000; }
    catch (_) { return {label:'Validade não informada',tone:'warn',days:null}; }
    if (days < 0) return {label:'CA vencido',tone:'bad',days:days};
    // The official export and portal disagree on expiry day; show proximity on day zero.
    if (days >= 0 && days <= 30 && (situation === 'valido' || !situation || days === 0)) return {label:'Próximo ao vencimento',tone:'warn',days:days};
    if (situation === 'vencido') return {label:'CA vencido',tone:'bad',days:days};
    return {label:situation === 'valido' ? 'CA válido' : 'Situação não informada',tone:situation === 'valido' ? 'ok' : 'warn',days:days};
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
    var dermicEquipment = /\b(luva\w*|creme\w*)\b/.test(fold(record.name));
    var chemical = dermicEquipment && /\bquimic\w*\b/.test(p) && /\b(maos|membros superiores|pele|cutane\w*|dermic\w*)\b/.test(p);
    if (auditory && chemical) return GROUP.REVISAO;
    if (auditory) return GROUP.AUDITIVA;
    if (chemical) return GROUP.DERMICA;
    return GROUP.OUTROS;
  }
  function validLife(value) { return Number.isInteger(value) && value > 0 && value <= 36500; }
  function quantity(value) {
    if (value == null || value === '') return 1;
    if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+$/.test(String(value).trim())) throw new Error('Quantidade deve ser um número inteiro positivo.');
    var n = Number(value);
    if (!Number.isSafeInteger(n) || n < 1 || n > Math.floor(Number.MAX_SAFE_INTEGER / 36500)) throw new Error('Quantidade deve ser um número inteiro positivo dentro do limite suportado.');
    return n;
  }
  function limitCalculation(row) {
    if (row.limit == null) return 'Prazo não cadastrado';
    if (!row.previousComponents) return row.limit + ' dias';
    // Aggregate identical unit limits for a compact display, retaining each CA
    // separately in previousComponents for the detailed export.
    var parts = [];
    row.previousComponents.forEach(function(c) {
      var part = parts.find(function(p) { return p.unitLimit === c.unitLimit; });
      if (part) part.quantity += c.quantity;
      else parts.push({unitLimit:c.unitLimit,quantity:c.quantity});
    });
    return parts.map(function(p) { return p.unitLimit + ' × ' + p.quantity; }).join(' + ') + ' = ' + row.limit + ' dias';
  }
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
      seen[entry.id] = true; ca(entry.ca); date(entry.date); quantity(entry.quantity);
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
      var entry = item.entry, number = ca(entry.ca), record = catalog[number], group = classify(record), currentCa = certificateStatus(record,now);
      var row = { id: entry.id, quantity: quantity(entry.quantity), ca: number, date: entry.date, name: record ? record.name : 'CA não identificado', group: group,
        interval: null, limit: null, status: 'Sem análise de periodicidade', caExpiry: record && record.caExpiry || null,
        usefulLifeDays: group === GROUP.DERMICA ? 30 : validLife(lifetimes[number]) ? lifetimes[number] : null, savedAt: entry.savedAt || '', physicalExpiry: entry.physicalExpiry || null, caStatus: currentCa.label, caTone: currentCa.tone, caDaysRemaining: currentCa.days, source: metadata.source || 'Indisponível', referenceDate: metadata.referenceDate || null };
      if (row.physicalExpiry) date(row.physicalExpiry);
      if (record && record.caExpiry) {
        try { row.caAtDelivery = item.time <= certificateDate(record.caExpiry) ? 'Entrega até a validade registrada na base' : stale ? 'Entrega posterior à validade da base; confirmar renovação na fonte oficial' : 'Entrega posterior à validade registrada; confirmar situação na fonte oficial'; }
        catch (_) { row.caAtDelivery = 'Validade do CA indisponível'; }
      } else row.caAtDelivery = 'Validade do CA indisponível';

      if (group === GROUP.REVISAO) row.status = 'Revisão manual necessária';
      if (group === GROUP.AUDITIVA || group === GROUP.DERMICA) {
        // Lines in the same group/date are one delivery batch. Every new date
        // starts a fresh budget; unused time is never carried to that date.
        var batch = previous[group];
        if (!batch || batch.time !== item.time) {
          batch = {time:item.time,previous:batch || null,components:[],quantity:0,total:0,missing:false};
          previous[group] = batch;
        }
        var prev = batch.previous;
        row.status = 'Marco inicial';
        if (prev) {
          row.interval = (item.time - prev.time) / 86400000;
          row.previousComponents = prev.components.map(function(c) { return {ca:c.ca,quantity:c.quantity,unitLimit:c.unitLimit}; });
          row.previousCa = Array.from(new Set(prev.components.map(function(c) { return c.ca; }))).join(' + ');
          row.previousQuantity = prev.quantity;
          row.unitLimit = prev.components.every(function(c) { return c.unitLimit === prev.components[0].unitLimit; }) ? prev.components[0].unitLimit : null;
          row.limit = prev.missing ? null : prev.total;
          row.status = row.limit == null ? 'Vida útil não cadastrada' : row.interval <= row.limit ? 'Dentro do prazo' : 'Fora do prazo';
        }
        var unitLimit = group === GROUP.DERMICA ? 30 : validLife(lifetimes[number]) ? lifetimes[number] : null;
        batch.quantity += row.quantity;
        var component = batch.components.find(function(c) { return c.ca === number; });
        if (component) component.quantity += row.quantity;
        else batch.components.push({ca:number,quantity:row.quantity,unitLimit:unitLimit});
        if (unitLimit == null) batch.missing = true;
        else batch.total += unitLimit * row.quantity;
        if (!Number.isSafeInteger(batch.quantity) || !Number.isSafeInteger(batch.total)) throw new Error('Quantidade total do lote excede o limite suportado.');
      }
      return row;
    });
    return { sheetId: sheet.id, worker: sheet.worker, rows: rows, warnings: rows.some(function(r) { return r.group === GROUP.REVISAO; }) ? ['CAs pendentes de revisão podem alterar as sequências e os intervalos. A análise é parcial.'] : [], metadata: metadata, stale: stale };
  }
  return { GROUP: GROUP, ca: ca, date: date, certificateDate: certificateDate, certificateStatus: certificateStatus, classify: classify, validLife: validLife, quantity: quantity, limitCalculation: limitCalculation, validateSheet: validateSheet, analyze: analyze };
})();
if (typeof module !== 'undefined') module.exports = EpiDomain;
