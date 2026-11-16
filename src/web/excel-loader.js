/* Keep vendor code out of HtmlService's HTML parser. No CDN or network request. */
var EpiExcel = (function () {
  let pending, sourcePromise;
  function ready() {
    if (pending) return pending;
    pending = load().catch(error => { pending = null; throw error; });
    return pending;
  }
  function source() {
    if (!sourcePromise) sourcePromise = unpack().catch(error=>{sourcePromise=null;throw error;});
    return sourcePromise;
  }
  async function unpack() {
    const payload = document.getElementById('excelBundle');
    if (!payload || typeof DecompressionStream === 'undefined') throw Error('Não foi possível carregar o Excel. Use Chrome ou Edge atualizado e a versão completa do Index.html.');
    const bytes = Uint8Array.from(atob(payload.textContent.trim()), c => c.charCodeAt(0));
    const source = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))), b => b.toString(16).padStart(2,'0')).join('');
    if (digest !== EpiBuild.excelSha256) throw Error('O pacote Excel está incompleto ou alterado. Substitua todo o Index.html pelo arquivo da versão ' + EpiBuild.id + '.');
    return source;
  }
  async function load() {
    const vendor = await source();
    const script = document.createElement('script');
    // Force the bundled UMD library to export to window, even with a host AMD loader.
    script.textContent = '(function(module,exports,define){\n' + vendor + '\n}).call(window);';
    document.head.append(script); script.remove();
    if (!window.ExcelJS || typeof window.ExcelJS.Workbook !== 'function') throw Error('Falha ao inicializar a biblioteca Excel da versão ' + EpiBuild.id + '.');
    return window.ExcelJS;
  }
  function read(data,prefix,onProgress,timeoutMs=30000) {
    return new Promise((resolve,reject)=>{
      let worker,url,done=false;
      const timer=setTimeout(()=>finish(Error('A validação excedeu 30 segundos e foi interrompida. Salve uma cópia .xlsx contendo apenas as linhas preenchidas do modelo (até 2000 entregas) e tente novamente.')),timeoutMs);
      function finish(error,result) {
        if(done)return;done=true;clearTimeout(timer);
        if(worker)worker.terminate();if(url)URL.revokeObjectURL(url);
        if(error)reject(error);else resolve(result);
      }
      source().then(vendor=>{
        if(done)return;
        if(typeof Worker==='undefined')throw Error('Este navegador não permite validar Excel em segundo plano. Use Chrome ou Edge atualizado.');
        url=URL.createObjectURL(new Blob(['(function(module,exports,define){\n',vendor,'\n}).call(self);\n',EpiImportWorker],{type:'text/javascript'}));
        worker=new Worker(url);
        worker.onerror=event=>{event.preventDefault();finish(Error('Falha ao ler o Excel em segundo plano. Confira o arquivo e tente novamente.'));};
        worker.onmessage=event=>{
          if(event.data.stage&&onProgress)onProgress(event.data.stage);
          if(event.data.error)finish(Error(event.data.error));
          else if(event.data.result)finish(null,event.data.result);
        };
        worker.postMessage({data,prefix},[data]);
      }).catch(error=>finish(error));
    });
  }
  return {ready,read};
})();
