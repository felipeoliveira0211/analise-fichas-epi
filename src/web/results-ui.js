/* One presentation for the application and printed reports. */
var EpiResultUi = (function () {
  const headers = ['Entrega','CA / EPI','Intervalo','Limite','Vida útil','Validade do CA','Resultado'];
  function cell(tr,text) { const td=document.createElement('td');td.textContent=text;tr.append(td);return td; }
  function badge(td,label,tone) { const span=document.createElement('span');span.className='status '+tone;span.textContent=({ok:'✓ ',bad:'✕ ',warn:'⚠ '}[tone]||'')+label;td.append(span); }
  function rows(tbody,items,showLimit=true) {
    tbody.replaceChildren();
    const sections=[['Proteção dérmica',r=>r.group==='dermica'],['Proteção auditiva',r=>r.group==='auditiva'],['Outras entregas',r=>!['dermica','auditiva'].includes(r.group)]];
    sections.forEach(([name,predicate])=>{
      const selected=items.filter(predicate).sort((a,b)=>EpiDomain.date(a.date)-EpiDomain.date(b.date));
      if(!selected.length)return;
      const heading=document.createElement('tr'),th=document.createElement('th');heading.className='group-heading';heading.dataset.group=name==='Proteção dérmica'?'dermica':name==='Proteção auditiva'?'auditiva':'outros';th.colSpan=headers.length-(showLimit?0:1);th.scope='rowgroup';th.textContent=name;heading.append(th);tbody.append(heading);
      selected.forEach(row=>{
        const tr=document.createElement('tr');tr.className='delivery-row';tr.dataset.group=row.group;cell(tr,row.date);cell(tr,row.ca+' · '+row.name);
        cell(tr,row.status==='Marco inicial'?'Marco inicial':row.interval==null?'—':row.interval+' dias');
        if(showLimit){const limit=cell(tr,row.limit==null?'—':row.limit+' dias');if(row.previousCa)limit.title='Vida útil do CA anterior: '+row.previousCa;}
        cell(tr,row.usefulLifeDays==null?'Não cadastrada':row.usefulLifeDays+' dias');
        const validity=cell(tr,'');const date=document.createElement('div');date.textContent=row.caExpiry||'Indisponível';validity.append(date);badge(validity,row.caStatus,row.caTone);
        const result=cell(tr,'');
        if(row.status==='Marco inicial'||row.status==='Sem análise de periodicidade')result.textContent='—';
        else badge(result,row.status,row.status==='Dentro do prazo'?'ok':row.status==='Fora do prazo'?'bad':'warn');
        tbody.append(tr);
      });
    });
  }
  function table(items) {const t=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr'),body=document.createElement('tbody');headers.forEach(label=>{const th=document.createElement('th');th.textContent=label;tr.append(th);});head.append(tr);t.append(head,body);rows(body,items);return t;}
  return {headers,rows,table};
})();
