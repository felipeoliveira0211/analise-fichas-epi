/* Adapter boundary for a future official spreadsheet importer. No scraping. */
var EpiCatalog = (function () {
  function load(store) {
    var index = {};
    store.rows('CaIndex').forEach(function (row) {
      var number = EpiDomain.ca(row.ca);
      index[number] = { ca: number, name: String(row.name || ''), approvedProtection: String(row.approvedProtection || ''), caExpiry: String(row.caExpiry || '') };
    });
    var meta = store.rows('Metadata')[0] || {};
    return { index: index, metadata: { source: meta.source || '', referenceDate: meta.referenceDate || '', updatedAt: meta.updatedAt || '' } };
  }
  return { load: load };
})();
if (typeof module !== 'undefined') module.exports = EpiCatalog;
