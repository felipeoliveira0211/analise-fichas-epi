/* Keep vendor code out of HtmlService's HTML parser. No CDN or network request. */
var EpiExcel = (function () {
  let pending;
  function ready() {
    if (pending) return pending;
    pending = load().catch(error => { pending = null; throw error; });
    return pending;
  }
  async function load() {
    const payload = document.getElementById('excelBundle');
    if (!payload || typeof DecompressionStream === 'undefined') throw Error('Não foi possível carregar o Excel. Use Chrome ou Edge atualizado e a versão completa do Index.html.');
    const bytes = Uint8Array.from(atob(payload.textContent.trim()), c => c.charCodeAt(0));
    const source = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))), b => b.toString(16).padStart(2,'0')).join('');
    if (digest !== EpiBuild.excelSha256) throw Error('O pacote Excel está incompleto ou alterado. Substitua todo o Index.html pelo arquivo da versão ' + EpiBuild.id + '.');
    const script = document.createElement('script');
    // Force the bundled UMD library to export to window, even with a host AMD loader.
    script.textContent = '(function(module,exports,define){\n' + source + '\n}).call(window);';
    document.head.append(script); script.remove();
    if (!window.ExcelJS || typeof window.ExcelJS.Workbook !== 'function') throw Error('Falha ao inicializar a biblioteca Excel da versão ' + EpiBuild.id + '.');
    return window.ExcelJS;
  }
  return {ready};
})();
