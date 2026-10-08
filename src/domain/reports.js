if (typeof module !== 'undefined') var EpiDomain = require('./analysis');
/* Shared reporting: analyze full sequences before selecting delivery dates. */
var EpiReports = (function () {
  function fold(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
  function iso(v) { if (!v) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Período inválido.'); return EpiDomain.date(v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4)); }
  function validate(filters) {
    filters = filters || {}; var start = iso(filters.start), end = iso(filters.end);
    if (start !== null && end !== null && start > end) throw new Error('A data inicial deve ser anterior ou igual à final.');
    if (filters.state && !['draft','complete'].includes(filters.state)) throw new Error('Situação inválida.');
    return {start:start,end:end};
  }
  function matches(sheet, filters) {
    var w = sheet.worker || {};
    return (!filters.state || sheet.state === filters.state) && ['company','ges','sector','role'].every(function(k) { return fold(w[k]).includes(fold(filters[k])); }) && fold(w.name).includes(fold(filters.worker));
  }
  function create(sheets, catalog, lives, metadata, filters) {
    filters = filters || {}; var range = validate(filters), reports = [];
    sheets.filter(function(s) { return matches(s,filters); }).forEach(function(sheet) {
      if (!sheet.entries.length) return;
      var result = EpiDomain.analyze(sheet,catalog,lives,metadata);
      result.rows = result.rows.filter(function(r) { var t = EpiDomain.date(r.date); return (range.start === null || t >= range.start) && (range.end === null || t <= range.end); });
      if (result.rows.length) { result.state = sheet.state; result.updatedAt = sheet.updatedAt || ''; reports.push(result); }
    });
    reports.sort(function(a,b) { return String(a.worker.company || '').localeCompare(String(b.worker.company || ''),'pt-BR') || a.worker.ges.localeCompare(b.worker.ges,'pt-BR') || a.worker.name.localeCompare(b.worker.name,'pt-BR'); });
    return {reports:reports,filters:filters,generatedAt:new Date().toISOString(),metadata:metadata};
  }
  return {validate:validate,matches:matches,create:create};
})();
if (typeof module !== 'undefined') module.exports = EpiReports;
