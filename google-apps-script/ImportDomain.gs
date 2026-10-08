/* Pure CSV preparation shared by browser, Apps Script and Node. No portal requests. */
var EpiImport = (function () {
  'use strict';
  var MAX_ROWS = 10000, MAX_CHARS = 10 * 1024 * 1024;
  function domain() { return typeof EpiDomain !== 'undefined' ? EpiDomain : require('./analysis'); }
  function fold(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function parse(text, delimiter) {
    if (typeof text !== 'string' || text.length > MAX_CHARS) throw new Error('CSV deve ter no máximo 10 MB de texto.');
    if (![',',';','\t'].includes(delimiter)) throw new Error('Separador inválido.');
    text = text.replace(/^\uFEFF/, '');
    var rows = [], row = [], value = '', quoted = false, closed = false;
    function field() { row.push(value); value = ''; closed = false; }
    function line() { field(); if (row.some(function(v) { return v.trim(); })) rows.push(row); row = []; }
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch === '"') { if (text[i+1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
        else value += ch;
      } else if (ch === delimiter) field();
      else if (ch === '\r' || ch === '\n') { line(); if (ch === '\r' && text[i+1] === '\n') i++; }
      else if (ch === '"') { if (value || closed) throw new Error('Aspas inválidas no CSV.'); quoted = true; }
      else { if (closed) throw new Error('Conteúdo após o fechamento de aspas no CSV.'); value += ch; }
      if (rows.length > MAX_ROWS + 1) throw new Error('Limite: 10.000 CAs por importação. Exporte um recorte dos CAs necessários.');
    }
    if (quoted) throw new Error('Aspas não fechadas no CSV.');
    if (value || row.length || closed) line();
    if (!rows.length || rows[0].length < 2) throw new Error('CSV sem cabeçalho ou separador incorreto.');
    var headers = rows.shift().map(function(v) { return v.trim(); });
    if (headers.some(function(v) { return !v; }) || new Set(headers).size !== headers.length) throw new Error('Cabeçalhos vazios ou duplicados.');
    rows.forEach(function(r,i) { if (r.length !== headers.length) throw new Error('Quantidade de colunas inválida na linha ' + (i+2) + '.'); });
    return { headers: headers, rows: rows };
  }
  function suggest(headers) {
    var aliases = {
      ca: ['ca','numeroca','numerodoca','nca','certificadodeaprovacao'],
      name: ['name','equipamento','nomedoequipamento','epi','nomeepi'],
      approvedProtection: ['approvedprotection','aprovadopara','protecaoaprovada'],
      caExpiry: ['caexpiry','datadevalidade','datavalidade','validadedoca','validade']
    };
    var result = {};
    Object.keys(aliases).forEach(function(key) { result[key] = headers.findIndex(function(h) { return aliases[key].includes(fold(h)); }); });
    return result;
  }
  function expiry(value) {
    value = String(value || '').trim();
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) value = value.slice(8,10) + '/' + value.slice(5,7) + '/' + value.slice(0,4);
    domain().date(value); return value;
  }
  function prepare(payload, now) {
    var D = domain();
    if (!payload || !Array.isArray(payload.records) || !payload.records.length || payload.records.length > MAX_ROWS) throw new Error('Importe de 1 a 10.000 CAs.');
    var source = String(payload.source || '').trim(), referenceDate = String(payload.referenceDate || '').trim();
    // Provenance is declared by the operator; this validates the URL, not authenticity of the file.
    if (!/^https:\/\/([a-z0-9-]+\.)*(gov\.br|mte\.gov\.br)(\/|$)/i.test(source) || source.length > 1000) throw new Error('Informe a URL HTTPS oficial em domínio gov.br como origem dos dados.');
    var reference = D.date(referenceDate);
    var today = now == null ? Date.now() : now;
    var day = new Date(today); var midnight = Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate());
    if (reference > midnight) throw new Error('Data de referência não pode estar no futuro.');
    var seen = new Set(), warnings = [], groups = {auditiva:0,dermica:0,outros:0,revisao:0};
    var records = payload.records.map(function(input,i) {
      try {
        var ca = D.ca(input.ca), name = String(input.name || '').trim(), approved = String(input.approvedProtection || '').trim();
        if (!name || name.length > 1000) throw new Error('Nome do EPI ausente ou maior que 1000 caracteres.');
        if (approved.length > 10000) throw new Error('Proteção aprovada maior que 10000 caracteres.');
        if (seen.has(ca)) throw new Error('CA duplicado: ' + ca + '.'); seen.add(ca);
        var r = {ca:ca,name:name,approvedProtection:approved,caExpiry:expiry(input.caExpiry)};
        groups[D.classify(r)]++;
        if (!approved || !r.caExpiry) warnings.push('CA ' + ca + ': ' + (!approved ? 'proteção aprovada indisponível; revisão manual. ' : '') + (!r.caExpiry ? 'validade do CA indisponível.' : ''));
        return r;
      } catch (err) { throw new Error('Registro ' + (i+1) + ': ' + err.message); }
    });
    records.sort(function(a,b) { return Number(a.ca)-Number(b.ca); });
    if (JSON.stringify(records).length > MAX_CHARS) throw new Error('Base maior que 10 MB de texto.');
    return {records:records,metadata:{source:source,referenceDate:referenceDate},groups:groups,warnings:warnings};
  }
  function fromCsv(parsed, mapping, metadata) {
    var keys = ['ca','name','approvedProtection','caExpiry'];
    keys.forEach(function(k) { if (!Number.isInteger(mapping[k]) || mapping[k] < 0 || mapping[k] >= parsed.headers.length) throw new Error('Selecione a coluna de ' + k + '.'); });
    if (new Set(keys.map(function(k) { return mapping[k]; })).size !== 4) throw new Error('Cada campo precisa de uma coluna diferente.');
    var records = parsed.rows.map(function(cells) { var record = {}; keys.forEach(function(k) { record[k] = cells[mapping[k]]; }); return record; });
    return prepare({records:records,source:metadata.source,referenceDate:metadata.referenceDate});
  }
  return {parse:parse,suggest:suggest,prepare:prepare,fromCsv:fromCsv,MAX_ROWS:MAX_ROWS,MAX_CHARS:MAX_CHARS};
})();
if (typeof module !== 'undefined') module.exports = EpiImport;
