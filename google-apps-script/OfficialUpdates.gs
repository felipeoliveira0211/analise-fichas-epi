var EpiOfficialUpdates=(function(){
  var DEFAULT='https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/seguranca-e-saude-no-trabalho/equipamentos-de-protecao-individual';
  function check(url){
    var initial=EpiUpdates.validate(url||DEFAULT),current=initial;
    if(/\.(xlsx?|csv|zip|txt)(?:$|[/?#])/i.test(current))throw new Error('Informe uma página oficial de publicação, não o arquivo da base.');
    var outcome={pageUrl:initial,checkedAt:new Date().toISOString(),freshnessConfirmed:false,candidates:[]};
    try{
      for(var hop=0;hop<4;hop++){
        var response=UrlFetchApp.fetch(current,{method:'get',followRedirects:false,muteHttpExceptions:true,validateHttpsCertificates:true});
        var code=response.getResponseCode(),headers=response.getAllHeaders();
        outcome.httpStatus=code;outcome.finalUrl=current;
        if(code===403||code===401){outcome.status='blocked';outcome.message='A fonte bloqueou a consulta. Nenhuma tentativa de contornar o bloqueio foi realizada. Abra a página oficial no seu navegador.';return outcome;}
        if([301,302,303,307,308].includes(code)){
          var location=Object.keys(headers).find(function(k){return k.toLowerCase()==='location';});
          var next=location?EpiUpdates.resolve(headers[location],current):null;
          if(!next)throw new Error('Redirecionamento fora das fontes oficiais permitidas ou sem destino.');current=next;continue;
        }
        if(code!==200){outcome.status='unavailable';outcome.message='Fonte indisponível (HTTP '+code+'). Não foi possível confirmar atualizações.';return outcome;}
        var typeKey=Object.keys(headers).find(function(k){return k.toLowerCase()==='content-type';});
        if(typeKey&& !String(headers[typeKey]).toLowerCase().includes('text/html'))throw new Error('A resposta não é uma página HTML de publicação.');
        outcome.candidates=EpiUpdates.candidates(response.getContentText('UTF-8'),current);
        outcome.status=outcome.candidates.length?'candidates':'not_found';
        outcome.message=outcome.candidates.length?'Arquivos ou portal de exportação encontrados na fonte oficial. Confira a data de referência antes de substituir a base.':'Nenhum arquivo de base foi identificado nesta página. Isso não comprova que a base está atualizada; informe a página de publicação correta.';
        return outcome;
      }
      throw new Error('Limite de redirecionamentos atingido.');
    }catch(error){outcome.status='unavailable';outcome.message='Consulta não concluída: '+error.message+'. A atualidade da base continua não confirmada.';return outcome;}
  }
  return {check:check,defaultPage:DEFAULT};
})();
function epiCheckOfficialUpdates(url){return EpiOfficialUpdates.check(url);}
