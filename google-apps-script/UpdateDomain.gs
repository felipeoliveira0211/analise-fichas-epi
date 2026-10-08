/* Parses public publication pages only. Never bypasses a 403 or infers freshness from page dates. */
var EpiUpdates=(function(){
  function validate(url){
    url=String(url||'').trim();
    if(url.length>2000||!/^https:\/\/(www\.gov\.br|caepi\.mte\.gov\.br|caepi\.trabalho\.gov\.br)(?:\/[^\s<>"\\]*)?$/i.test(url))throw new Error('Use uma página HTTPS em www.gov.br, caepi.mte.gov.br ou caepi.trabalho.gov.br.');
    return url;
  }
  function resolve(href,base){
    href=String(href||'').replace(/&amp;/g,'&').replace(/&#38;/g,'&');
    if(!href||href[0]==='#'||(/^[a-z][a-z0-9+.-]*:/i.test(href)&&!href.startsWith('https://')))return null;
    var origin=/^https:\/\/[^/]+/.exec(base)[0];
    var url=href.startsWith('https://')?href:href.startsWith('//')?'https:'+href:href.startsWith('/')?origin+href:base.split(/[?#]/)[0].replace(/\/[^/]*$/,'/')+href;
    try{return validate(url);}catch(_){return null;}
  }
  function candidates(html,base){
    validate(base);if(typeof html!=='string'||html.length>2*1024*1024)throw new Error('Página grande demais para verificação.');
    var result=[],seen=new Set(),re=/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi,m;
    while((m=re.exec(html))&&result.length<20){
      var url=resolve(m[2],base),label=m[3].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      var portal=url&&/^https:\/\/caepi\.(mte|trabalho)\.gov\.br\//i.test(url)&&/base.*caepi|consulta.*ca|consulta.*certificado/i.test(label+' '+url);
      if(!url||seen.has(url)||(!portal&&(!/\.(xlsx?|csv|zip|txt)(?:$|[/?#])/i.test(url)||!/cadastro.?epi|caepi|certificado|base.?ca|relacao.?ca/i.test(url+' '+label))))continue;
      seen.add(url);result.push({kind:portal?'portal':'file',url:url,label:label.slice(0,200)||'Arquivo de base de CAs',freshness:'Data de referência e existência de versão mais recente não confirmadas.'});
    }
    return result;
  }
  return {validate:validate,resolve:resolve,candidates:candidates};
})();
if(typeof module!=='undefined')module.exports=EpiUpdates;
