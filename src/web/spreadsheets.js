/* XLSX processing stays in the browser; no external upload service. */
var EpiSpreadsheets = (function () {
  const headers = ['Identificador','Empresa','Trabalhador','Setor','Cargo','GES','CA','Data da entrega'];
  function book() { const w = new ExcelJS.Workbook(); w.creator = 'Análise de fichas de EPI'; return w; }
  function style(row) { row.font = {bold:true,color:{argb:'FFFFFFFF'}}; row.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF185748'}}; row.alignment={wrapText:true,vertical:'middle'}; row.height=32; }
  function template() {
    const w=book(), s=w.addWorksheet('Entregas'); s.addRow(headers); style(s.getRow(1));
    s.columns.forEach(c=>{c.width=24;c.numFmt='@';}); s.views=[{state:'frozen',ySplit:1}];
    const i=w.addWorksheet('Instruções');
    ['Preencha Entregas: uma linha por entrega. Não altere os cabeçalhos.',
      'Identificador: código único por ficha/trabalhador dentro deste arquivo; repita nas entregas da mesma pessoa.',
      'Todos os campos são obrigatórios. Repita Empresa, Trabalhador, Setor, Cargo e GES em cada linha.',
      'Data: DD/MM/AAAA como texto ou data do Excel. CA: somente dígitos. Não use fórmulas.',
      'Limites: 2 MB por arquivo e 2000 entregas. A importação cria fichas em andamento.',
      'Não mescla fichas existentes. Reenviar arquivo alterado cria novas fichas: confira a prévia.',
      'Reenvio do mesmo arquivo é reconhecido neste navegador ou na lista Google carregada.',
      'Vida útil continua no cadastro por CA. CAs desconhecidos serão sinalizados na análise.',
      'Exemplo fictício (não incluído em Entregas): T001 | Empresa teste | Pessoa teste | Setor teste | Cargo teste | GES 1 | 90001 | 01/01/2026'
    ].forEach(t=>i.addRow([t])); i.getColumn(1).width=120; return w;
  }
  function text(cell) {
    const v=cell.value;
    if(v==null)return '';
    if(typeof v==='object') { if(v instanceof Date) return String(v.getUTCDate()).padStart(2,'0')+'/'+String(v.getUTCMonth()+1).padStart(2,'0')+'/'+v.getUTCFullYear(); throw Error('Fórmulas, links e objetos não são aceitos.'); }
    return String(v).trim();
  }
  function parse(w, prefix, domain) {
    const s=w.getWorksheet('Entregas'); if(!s)throw Error('Aba Entregas ausente. Use o modelo.');
    if(s.rowCount>2001 || s.columnCount>8)throw Error('Limite de 2000 entregas e 8 colunas excedido.');
    if(headers.some((h,i)=>text(s.getRow(1).getCell(i+1))!==h))throw Error('Cabeçalhos inválidos. Use o modelo.');
    const groups=new Map(); let count=0;
    s.eachRow((row,n)=>{
      if(n===1)return;
      try {
        const values=headers.map((_,i)=>text(row.getCell(i+1))); if(values.every(v=>!v))return;
        if(values.some(v=>!v||v.length>200))throw Error('Preencha todos os campos (máximo 200 caracteres).');
        if(typeof row.getCell(8).value==='number'){const serial=row.getCell(8).value;if(!Number.isInteger(serial))throw Error('Data não pode conter horário.');const d=new Date((serial-(w.properties.date1904?24107:25569))*86400000);values[7]=text({value:d});}
        const [key,company,name,sector,role,ges,ca,date]=values;
        if(!/^\d{1,10}$/.test(ca))throw Error('CA deve conter somente dígitos, até 10 posições.');
        domain.date(date);
        let sheet=groups.get(key); const worker={company,name,sector,role,ges};
        if(sheet && Object.keys(worker).some(k=>sheet.worker[k]!==worker[k]))throw Error('Dados divergentes para o mesmo identificador.');
        if(!sheet){const id=prefix+'-'+groups.size;sheet={id,worker:{id:'w-'+id,...worker},state:'draft',revision:0,entries:[]};groups.set(key,sheet);}
        if(sheet.entries.some(e=>e.ca===ca&&e.date===date))throw Error('Entrega duplicada (mesmo CA e data).');
        sheet.entries.push({id:sheet.id+'-e'+n,ca,date});count++;
      }catch(e){throw Error('Linha '+n+': '+e.message);}
    });
    if(!count)throw Error('A planilha não contém entregas.');
    const sheets=Array.from(groups.values());sheets.forEach(domain.validateSheet);return {sheets,count};
  }
  function matrix(result,logo) {
    const w=book(),s=w.addWorksheet('Matriz de entregas');
    if(logo){const image=w.addImage({base64:logo,extension:'png'});s.addImage(image,{tl:{col:0,row:0},ext:{width:140,height:65}});}
    s.getRow(1).height=52;s.getCell('C1').value='Análise de fichas de EPI';s.getCell('C1').font={bold:true,size:16};
    s.getCell('A2').value='Gerado em: '+result.generatedAt;
    s.getCell('A3').value='Filtros: '+JSON.stringify(result.filters||{});
    if ((result.warnings || []).length) {
      const notices=w.addWorksheet('Avisos');
      notices.addRow(['Relatório parcial — confira os registros não incluídos']);
      result.warnings.forEach(warning=>notices.addRow([warning]));
      notices.getColumn(1).width=120;
    }
    const groups=[['Proteção auditiva',r=>r.group==='auditiva'],['Proteção dérmica',r=>r.group==='dermica'],['Outras entregas',r=>!['auditiva','dermica'].includes(r.group)]];
    const sizes=groups.map(([,f])=>Math.max(0,...result.reports.map(r=>r.rows.filter(f).length)));
    if(6+sizes.reduce((a,b)=>a+b,0)*8>16384)throw Error('Matriz excede o limite de colunas do Excel. Reduza o período.');
    const fields=['CA','Data','EPI','Intervalo (dias)','Limite (dias)','Resultado','Validade CA','Situação CA'];
    const cols=['Trabalhador','Setor','Empresa','Cargo','GES','ID da ficha'];let col=7;
    groups.forEach(([label],g)=>{const width=sizes[g]*fields.length;if(width){s.mergeCells(4,col,4,col+width-1);s.getRow(4).getCell(col).value=label;col+=width;for(let i=1;i<=sizes[g];i++)fields.forEach(f=>cols.push(i+' · '+f));}});
    s.getRow(5).values=cols;style(s.getRow(4));style(s.getRow(5));
    result.reports.forEach(report=>{const p=report.worker,values=[p.name,p.sector,p.company||'',p.role,p.ges,report.sheetId];groups.forEach(([,f],g)=>{const rows=report.rows.filter(f).sort((a,b)=>EpiDomain.date(a.date)-EpiDomain.date(b.date));for(let i=0;i<sizes[g];i++){const r=rows[i];values.push(...(r?[r.ca,r.date,r.name,r.interval==null?'':r.interval,r.limit==null?'':r.limit,r.status,r.caExpiry||'',r.caStatus||'']:fields.map(()=>'')));}});s.addRow(values);});
    if(cols.length>16384)throw Error('Matriz excede o limite de colunas do Excel. Reduza o período.');
    s.columns.forEach(c=>{c.width=24;});s.views=[{state:'frozen',xSplit:3,ySplit:5}];s.autoFilter={from:{row:5,column:1},to:{row:s.rowCount,column:cols.length}};
    s.eachRow((r,n)=>{if(n>5){r.alignment={vertical:'top',wrapText:true};r.eachCell(c=>{c.border={bottom:{style:'hair',color:{argb:'FFCCCCCC'}}};});}});return w;
  }
  function openDownload() {
    // Apps Script runs in an iframe which can block downloads. Open an escaped
    // window during the click, before asynchronous XLSX serialization.
    const target=window.open('', '_blank');
    if(!target)throw Error('Permita pop-ups para esta aplicação e clique novamente para baixar o Excel.');
    target.document.title='Preparando planilha Excel';
    target.document.body.textContent='Preparando sua planilha Excel… Aguarde.';
    return target;
  }
  async function download(w,name,target) {
    let url;
    try {
      target=target||openDownload();
      const data=await w.xlsx.writeBuffer();
      url=URL.createObjectURL(new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      if(target.closed)throw Error('A janela de download foi fechada. Clique novamente para baixar.');
      const doc=target.document;doc.title=name;doc.body.replaceChildren();
      const title=doc.createElement('h1');title.textContent='Planilha pronta';
      const p=doc.createElement('p');p.textContent='Se o download não iniciar automaticamente, clique abaixo. Depois de salvar, você pode fechar esta janela.';
      const a=doc.createElement('a');a.href=url;a.download=name;a.textContent='Baixar '+name;
      a.style.cssText='display:inline-block;padding:16px 24px;background:#245ce6;color:white;border-radius:8px;font:600 18px sans-serif';
      doc.body.style.cssText='font:16px system-ui;padding:32px;color:#172b4d';doc.body.append(title,p,a);
      // Keep the object URL alive while the fallback link can still be used.
      target.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
      a.click();
    }catch(error){if(url)URL.revokeObjectURL(url);if(target&&!target.closed)target.document.body.textContent='Não foi possível gerar a planilha: '+error.message;throw error;}
  }
  return {template,parse,matrix,download,openDownload};
})();
if(typeof module!=='undefined')module.exports=EpiSpreadsheets;
