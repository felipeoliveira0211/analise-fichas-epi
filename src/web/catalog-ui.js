(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const remote = typeof google !== 'undefined' && google.script && google.script.run;
  let parsed = null, payload = null, confirmation = null, busy = false;
  const fields = {ca:'columnCa',name:'columnName',approvedProtection:'columnProtection',caExpiry:'columnExpiry'};
  const labels = {auditiva:'Proteção auditiva',dermica:'Proteção dérmica química',outros:'Demais EPIs',revisao:'Revisão manual'};
  function rpc(method,...args) { return new Promise((resolve,reject) => google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[method](...args)); }
  function notice(text,error=false) { $('message').textContent=text; $('message').className=error?'error':''; }
  function invalid() { payload=null;confirmation=null;$('commitCatalog').hidden=true; $('catalogPreview').replaceChildren(); }
  async function act(fn) {
    if(busy)return;busy=true;
    const controls=Array.from(document.querySelectorAll('#catalog button,#catalog input,#catalog select'));controls.forEach(el=>el.disabled=true);
    try {await fn();}catch(err){notice(err.message||String(err),true);}finally{busy=false;controls.forEach(el=>el.disabled=false);}
  }
  function connection(data) {
    const p=$('connectionSummary');
    if(!remote){p.textContent='Demonstração local: sem conexão Google e sem base oficial carregada.';return;}
    if(data && data.connected){p.textContent='Planilha conectada • '+data.caCount+' CAs • Fonte: '+(data.source||'não informada')+' • Referência: '+(data.referenceDate||'não informada');}
    else p.textContent='Conexão não verificada. Execute initializeApplication no editor do Apps Script e verifique o acesso à planilha.';
  }
  document.addEventListener('epi:connection',e=>connection(e.detail));connection();
  $('catalogForm').onsubmit=e=>e.preventDefault();
  $('catalogForm').oninput=invalid;
  ['catalogFile','catalogDelimiter','catalogEncoding'].forEach(id=>$(id).addEventListener('change',()=>{parsed=null;invalid();}));
  $('checkConnection').onclick=()=>act(async()=>{
    if(!remote){connection();notice('Conexão real exige abertura pela implantação privada no Apps Script.');return;}
    try {const status=await rpc('epiConnectionStatus');connection(status);notice(status.caCount?'Planilha e catálogo disponíveis.':'Planilha conectada. Importe a base oficial antes de analisar.');}
    catch(err){connection();throw err;}
  });
  $('readCatalog').onclick=()=>act(async()=>{
    invalid();parsed=null;
    const file=$('catalogFile').files[0];if(!file)throw new Error('Selecione o CSV oficial ou seu recorte.');
    if(file.size>EpiImport.MAX_CHARS)throw new Error('Arquivo maior que 10 MB. Exporte um recorte dos CAs necessários.');
    let text;try{text=new TextDecoder($('catalogEncoding').value,{fatal:true}).decode(await file.arrayBuffer());}catch(_){throw new Error('Não foi possível ler a codificação. Confira UTF-8 ou Windows-1252.');}
    const delimiter=$('catalogDelimiter').value==='tab'?'\t':$('catalogDelimiter').value;
    parsed=EpiImport.parse(text,delimiter);const suggested=EpiImport.suggest(parsed.headers);
    Object.entries(fields).forEach(([key,id])=>{
      const select=$(id);select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecione a coluna';select.append(placeholder);
      parsed.headers.forEach((header,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=header;select.append(option);});
      if(suggested[key]>=0)select.value=String(suggested[key]);
    });notice(parsed.rows.length+' registros lidos. Confira o mapeamento e informe origem/data de referência.');
  });
  $('previewCatalog').onclick=()=>act(async()=>{
    invalid();if(!parsed)throw new Error('Leia o arquivo CSV primeiro.');
    const mapping={};Object.entries(fields).forEach(([key,id])=>{if($(id).value==='')throw new Error('Selecione todas as quatro colunas.');mapping[key]=Number($(id).value);});
    const prepared=EpiImport.fromCsv(parsed,mapping,{source:$('catalogSource').value,referenceDate:$('catalogReference').value});
    const candidate={records:prepared.records,source:prepared.metadata.source,referenceDate:prepared.metadata.referenceDate};
    const preview=remote?await rpc('epiPreviewCatalog',candidate):{count:prepared.records.length,groups:prepared.groups,warnings:prepared.warnings.slice(0,100),warningCount:prepared.warnings.length,sample:prepared.records.slice(0,5)};
    const container=$('catalogPreview');
    function paragraph(text){const p=document.createElement('p');p.textContent=text;container.append(p);}
    paragraph(preview.count+' CAs validados. '+(remote?'A importação substituirá '+preview.previousCount+' registros do catálogo atual.':'Prévia local: nada será enviado para Google Sheets.'));
    paragraph(Object.entries(preview.groups).map(([key,count])=>labels[key]+': '+count).join(' • '));
    paragraph('Fonte: '+candidate.source+' • Referência: '+candidate.referenceDate);
    if(preview.warningCount)paragraph(preview.warningCount+' registros com informações ausentes; exigem confirmação ou revisão.');
    preview.warnings.forEach(paragraph);
    const table=document.createElement('table'),head=document.createElement('thead'),hr=document.createElement('tr');
    ['CA','EPI','Proteção aprovada','Validade do CA'].forEach(label=>{const th=document.createElement('th');th.textContent=label;hr.append(th);});head.append(hr);table.append(head);
    const body=document.createElement('tbody');preview.sample.forEach(r=>{const tr=document.createElement('tr');[r.ca,r.name,r.approvedProtection||'Não informada',r.caExpiry||'Não informada'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});body.append(tr);});table.append(body);
    const wrapper=document.createElement('div');wrapper.className='table-wrap';wrapper.append(table);container.append(wrapper);
    payload=candidate;confirmation=remote?{signature:preview.signature,baseRevision:preview.baseRevision}:null;$('commitCatalog').hidden=!remote;
    notice(remote?'Confira a prévia antes de confirmar a substituição do catálogo.':'CSV validado localmente. A importação real depende da conexão Google.');
  });
  $('commitCatalog').onclick=()=>act(async()=>{
    if(!remote||!payload||!confirmation)throw new Error('Gere uma prévia válida na aplicação Google.');
    if(!confirm('Substituir todo o catálogo pelos '+payload.records.length+' CAs desta prévia? Fichas e vida útil serão mantidas.'))return;
    const result=await rpc('epiImportCatalog',payload,confirmation);invalid();document.dispatchEvent(new CustomEvent('epi:catalog-updated',{detail:result.metadata}));
    connection(await rpc('epiConnectionStatus'));notice(result.count+' CAs importados na planilha.');
  });
})();
