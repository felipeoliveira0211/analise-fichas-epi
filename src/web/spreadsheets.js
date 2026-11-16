/* XLSX processing stays in the browser; no external upload service. */
var EpiSpreadsheets = (function () {
  const headers = ['Identificador','Empresa','Trabalhador','Setor','Cargo','GES','CA','Data da entrega','Quantidade'];
  function book() { const w = new ExcelJS.Workbook(); w.creator = 'Análise de fichas de EPI'; return w; }
  function style(row) { row.font = {bold:true,color:{argb:'FFFFFFFF'}}; row.fill = {type:'pattern',pattern:'solid',fgColor:{argb:'FF185748'}}; row.alignment={wrapText:true,vertical:'middle'}; row.height=32; }
  function template() {
    const w=book(), s=w.addWorksheet('Entregas'); s.addRow(headers); style(s.getRow(1));
    s.columns.forEach(c=>{c.width=24;c.numFmt='@';}); s.views=[{state:'frozen',ySplit:1}];
    const i=w.addWorksheet('Instruções');
    ['Preencha Entregas: uma linha por entrega. Não altere os cabeçalhos.',
      'Identificador: código único por ficha/trabalhador dentro deste arquivo; repita nas entregas da mesma pessoa.',
      'Os oito campos originais são obrigatórios. Quantidade: inteiro positivo, opcional; vazio = 1. Informe pares para luvas e unidades para creme.',
      'Linhas com o mesmo CA e data são aceitas e preservadas; repita os dados do trabalhador.',
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
    if(s.rowCount>2001 || s.columnCount>9)throw Error('Limite de 2000 entregas e 9 colunas excedido.');
    if(headers.slice(0,8).some((h,i)=>text(s.getRow(1).getCell(i+1))!==h) || !['','Quantidade'].includes(text(s.getRow(1).getCell(9))))throw Error('Cabeçalhos inválidos. Use o modelo.');
    const groups=new Map(); let count=0;
    s.eachRow((row,n)=>{
      if(n===1)return;
      try {
        const values=headers.slice(0,8).map((_,i)=>text(row.getCell(i+1))),rawQuantity=text(row.getCell(9)); if(values.every(v=>!v)&&!rawQuantity)return;
        if(rawQuantity&&text(s.getRow(1).getCell(9))!=='Quantidade')throw Error('A coluna 9 deve ter o cabeçalho Quantidade.');
        const quantity=domain.quantity(rawQuantity);
        if(values.some(v=>!v||v.length>200))throw Error('Preencha todos os campos (máximo 200 caracteres).');
        if(typeof row.getCell(8).value==='number'){const serial=row.getCell(8).value;if(!Number.isInteger(serial))throw Error('Data não pode conter horário.');const d=new Date((serial-(w.properties.date1904?24107:25569))*86400000);values[7]=text({value:d});}
        const [key,company,name,sector,role,ges,ca,date]=values;
        if(!/^\d{1,10}$/.test(ca))throw Error('CA deve conter somente dígitos, até 10 posições.');
        domain.date(date);
        let sheet=groups.get(key); const worker={company,name,sector,role,ges};
        if(sheet && Object.keys(worker).some(k=>sheet.worker[k]!==worker[k]))throw Error('Dados divergentes para o mesmo identificador.');
        if(!sheet){const id=prefix+'-'+groups.size;sheet={id,worker:{id:'w-'+id,...worker},state:'draft',revision:0,entries:[]};groups.set(key,sheet);}
        sheet.entries.push({id:sheet.id+'-e'+n,ca,date,quantity});count++;
      }catch(e){throw Error('Linha '+n+': '+e.message);}
    });
    if(!count)throw Error('A planilha não contém entregas.');
    const sheets=Array.from(groups.values());sheets.forEach(domain.validateSheet);return {sheets,count};
  }
  // Check the ZIP directory before inflating; formatted empty sheets can be tiny
  // on disk but expand to hundreds of MB and stall a browser parser.
  function checkArchive(data) {
    const view=new DataView(data);let end=-1;
    for(let i=view.byteLength-22;i>=Math.max(0,view.byteLength-65557);i--) {
      if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===view.byteLength){end=i;break;}
    }
    if(end<0)throw Error('Arquivo .xlsx inválido ou incompleto. Salve novamente no Excel usando o modelo.');
    const count=view.getUint16(end+10,true),size=view.getUint32(end+12,true);let offset=view.getUint32(end+16,true),total=0;
    if(count>1000||offset+size>end)throw Error('Planilha excede a estrutura suportada. Use uma cópia do modelo apenas com as entregas preenchidas.');
    for(let i=0;i<count;i++){
      if(offset+46>end||view.getUint32(offset,true)!==0x02014b50)throw Error('Estrutura XLSX inválida.');
      total+=view.getUint32(offset+24,true);
      if(total>64*1024*1024)throw Error('A planilha contém dados ou formatação excessivos (mais de 64 MB descompactados). Copie apenas as linhas preenchidas para o modelo.');
      offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
      if(offset>end)throw Error('Estrutura XLSX inválida.');
    }
  }
  function matrix(result,logo) {
    const w=book(),s=w.addWorksheet('Matriz de entregas');
    s.properties.defaultRowHeight=26;
    if(logo){const image=w.addImage({base64:logo,extension:'png'});s.addImage(image,{tl:{col:0,row:0},ext:{width:140,height:65}});}
    s.getRow(1).height=52;s.mergeCells('C1:R1');s.getCell('C1').value='Análise de fichas de EPI';s.getCell('C1').font={bold:true,size:18,color:{argb:'FF18312D'}};
    s.mergeCells('A2:R2');s.getCell('A2').value='Gerado em: '+result.generatedAt+' · Filtros: '+JSON.stringify(result.filters||{});
    s.mergeCells('A3:R3');s.getCell('A3').value='Troca em dias: verde = dentro do prazo; vermelho = fora do prazo; amarelo = vida útil não cadastrada ou revisão. Primeira entrega = marco inicial.'+((result.warnings||[]).length?' RELATÓRIO PARCIAL: confira a aba Avisos.':'');s.getCell('A3').alignment={wrapText:true};s.getRow(3).height=32;
    if ((result.warnings || []).length) {
      const notices=w.addWorksheet('Avisos');notices.addRow(['Relatório parcial — confira os registros não incluídos']);
      result.warnings.forEach(warning=>notices.addRow([warning]));notices.getColumn(1).width=120;
    }
    const headings=['Nome do GHE / GES','Setor','Cargo','Nome do funcionário','Empresa','CA','Qtd.','Data entrega','Troca em dias','Creme / luva — agentes químicos','CA','Qtd.','Data entrega','Troca em dias','Outros EPIs / revisão','CA','Qtd.','Data entrega'];
    s.getRow(5).values=headings;
    for(const [from,to,title] of [[1,5,'Trabalhador'],[6,9,'Proteção auditiva'],[10,14,'Proteção dérmica'],[15,18,'Outros EPIs / revisão']]){s.mergeCells(4,from,4,to);s.getRow(4).getCell(from).value=title;}
    for(const n of [4,5]){style(s.getRow(n));s.getRow(n).height=36;s.getRow(n).font={bold:true,color:{argb:'FF102B20'},size:11};s.getRow(n).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFCCFFCC'}};s.getRow(n).alignment={horizontal:'center',vertical:'middle',wrapText:true};}
    const details=w.addWorksheet('Detalhes');details.addRow(['GHE / GES','Setor','Cargo','Funcionário','Empresa','ID da ficha','Grupo','CA','EPI','Data entrega','Intervalo (dias)','Limite (dias)','Resultado','Validade CA','Situação CA','Quantidade','Quantidade anterior','Prazo por unidade (dias)','Cálculo do lote anterior']);style(details.getRow(1));
    const ordered=result.reports.slice().sort((a,b)=>String(a.worker.company||'').localeCompare(String(b.worker.company||''),'pt-BR')||String(a.worker.ges).localeCompare(String(b.worker.ges),'pt-BR')||String(a.worker.name).localeCompare(String(b.worker.name),'pt-BR'));
    ordered.forEach((report,index)=>{
      const p=report.worker,identity=[p.ges,p.sector,p.role,p.name,p.company||''];
      const groups=[report.rows.filter(r=>r.group==='auditiva'),report.rows.filter(r=>r.group==='dermica'),report.rows.filter(r=>!['auditiva','dermica'].includes(r.group))].map(rows=>rows.slice().sort((a,b)=>EpiDomain.date(a.date)-EpiDomain.date(b.date)));
      const height=Math.max(1,...groups.map(rows=>rows.length)),first=s.rowCount+1;
      const identityLines=Math.max(...identity.map((value,i)=>Math.ceil(String(value).length/([30,20,26,32,22][i]))));
      const identityHeight=Math.ceil((identityLines*14+10)/height);
      for(let i=0;i<height;i++){
        const [a,d,o]=groups.map(rows=>rows[i]);
        const row=s.addRow([...(i===0?identity:identity.map(()=>'')),...(a?[a.ca,EpiDomain.quantity(a.quantity),a.date,a.interval==null?'Marco inicial':a.interval]:['','','','']),...(d?[d.name,d.ca,EpiDomain.quantity(d.quantity),d.date,d.interval==null?'Marco inicial':d.interval]:['','','','','']),...(o?[o.name,o.ca,EpiDomain.quantity(o.quantity),o.date]:['','','',''])]);
        row.height=Math.min(409,Math.max(40,identityHeight,...[d,o].filter(Boolean).map(entry=>Math.ceil(String(entry.name).length/28)*14+10)));row.font={size:10};row.alignment={vertical:'middle',horizontal:'center',wrapText:true};
        row.eachCell({includeEmpty:true},cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index%2?'FFD9E9F8':'FFF2F2F2'}};cell.border={bottom:{style:'hair',color:{argb:'FFFFFFFF'}}};});
        for(const [entry,col] of [[a,6],[d,11],[o,16]])if(entry){const cell=row.getCell(col);const color=entry.caTone==='bad'?'FFFF4D4D':entry.caTone==='warn'||entry.group==='revisao'?'FFFFEB72':null;if(color)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};cell.note=(entry.caStatus||'Situação não informada')+(entry.caExpiry?' · Validade CA: '+entry.caExpiry:'');}
        for(const [entry,col] of [[a,9],[d,14]])if(entry){const cell=row.getCell(col);const color=entry.status==='Dentro do prazo'?'FF00B050':entry.status==='Fora do prazo'?'FFFF4D4D':entry.interval!=null?'FFFFEB72':null;if(color)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};cell.note=entry.status+(entry.limit!=null?' · Prazo anterior: '+EpiDomain.limitCalculation(entry):'')+(entry.caExpiry?' · Validade CA: '+entry.caExpiry:'');}
      }
      if(height>1)for(let col=1;col<=5;col++)s.mergeCells(first,col,first+height-1,col);
      for(const rows of groups)for(const r of rows)details.addRow([...identity,report.sheetId,r.group,r.ca,r.name,r.date,r.interval==null?'':r.interval,r.limit==null?'':r.limit,r.status,r.caExpiry||'',r.caStatus||'',EpiDomain.quantity(r.quantity),r.previousQuantity||'',r.unitLimit==null?'':r.unitLimit,r.limit==null?'':EpiDomain.limitCalculation(r)]);
      // A white separator keeps different sheets distinct, including homonyms.
      s.addRow([]).height=10;
    });
    const widths=[32,22,28,34,24,12,8,16,14,30,12,8,16,14,30,12,8,16];widths.forEach((width,i)=>{s.getColumn(i+1).width=width;});
    s.views=[{state:'frozen',xSplit:5,ySplit:5,showGridLines:false}];
    s.pageSetup={paperSize:8,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'4:5',printArea:'A1:R'+s.rowCount};
    details.columns.forEach(c=>{c.width=24;});details.views=[{state:'frozen',xSplit:4,ySplit:1}];details.autoFilter={from:{row:1,column:1},to:{row:details.rowCount,column:19}};
    return w;
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
  return {template,parse,checkArchive,matrix,download,openDownload};
})();
if(typeof module!=='undefined')module.exports=EpiSpreadsheets;
