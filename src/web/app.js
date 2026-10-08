(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const remote = typeof google !== 'undefined' && google.script && google.script.run;
  const KEY = remote ? 'epi.analysis.google.v1' : 'epi.analysis.v1';
  let sheets = [], savedSheets = [], current, editing = null, catalog = {}, lifetimes = {}, metadata = {}, busy = false;
  const id = () => crypto.randomUUID();
  function notify(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
  function rpc(method, ...args) { return new Promise((resolve, reject) => google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[method](...args)); }
  function guard(fn) { return async e => { if (e) e.preventDefault(); if (busy) return; try { await fn(e); } catch (err) { notify(err.message || String(err), true); } }; }
  async function operation(fn) {
    busy = true; document.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try { return await fn(); } finally { busy = false; document.querySelectorAll('button').forEach(b => { b.disabled = b.id === 'printReport' && !reportReady; }); }
  }
  function cell(tr, value) { const td = document.createElement('td'); td.textContent = value == null ? '—' : value; tr.append(td); return td; }
  function button(label, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = guard(fn); return b; }
  function view(name) { document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== name; }); document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name)); }
  function capture() {
    if (!current) return;
    current.worker.company = $('workerCompany').value; current.worker.name = $('workerName').value; current.worker.sector = $('workerSector').value;
    current.worker.role = $('workerRole').value; current.worker.ges = $('workerGes').value; current.state = $('sheetState').value;
  }
  function persist() {
    capture();
    try { localStorage.setItem(KEY, JSON.stringify({ sheets, currentId: current && current.id, demoLifetimes: remote ? undefined : lifetimes })); }
    catch (_) { notify('Não foi possível guardar o rascunho no navegador. Mantenha esta aba aberta e salve na planilha.', true); }
  }
  function renderEntries() {
    $('entries').replaceChildren(); $('entryCount').textContent = '(' + current.entries.length + ')';
    current.entries.forEach(e => {
      const tr = document.createElement('tr'); cell(tr, e.ca); cell(tr, e.date); cell(tr, timeLabel(e.savedAt));
      const actions = cell(tr, ''); actions.append(button('Editar', () => { editing = e.id; $('ca').value = e.ca; $('date').value = e.date; $('quickLifeDays').value = lifetimes[e.ca] || ''; $('addEntry').textContent = 'Atualizar'; $('cancelEdit').hidden = false; $('ca').focus(); }), button('Excluir', () => {
        if (!confirm('Excluir este lançamento?')) return;
        current.entries = current.entries.filter(x => x.id !== e.id); if (editing === e.id) resetInput(); persist(); renderEntries();
      })); $('entries').append(tr);
    });
  }
  function resetInput() { editing = null; $('entryForm').reset(); $('quickLifeDays').value = ''; $('addEntry').textContent = 'Adicionar'; $('cancelEdit').hidden = true; $('ca').focus(); }
  function open(sheet) {
    current = sheet;
    $('workerCompany').value = sheet.worker.company || ''; $('workerName').value = sheet.worker.name; $('workerSector').value = sheet.worker.sector;
    $('workerRole').value = sheet.worker.role; $('workerGes').value = sheet.worker.ges; $('sheetState').value = sheet.state;
    resetInput(); renderEntries(); renderSheets(); persist(); view('entry');
  }
  function newSheet() {
    const sheet = { id: id(), worker: { id: id(), company: '', name: '', sector: '', role: '', ges: '' }, entries: [], state: 'draft', revision: 0 };
    sheets.push(sheet); open(sheet); $('workerName').focus();
  }
  function renderSheets() {
    $('sheetList').replaceChildren();
    const merged = new Map(savedSheets.map(s => [s.id, s])); sheets.forEach(s => merged.set(s.id, s));
    const groups = {};
    merged.forEach(s => { const ges = s.worker && s.worker.ges || 'GES não informado'; (groups[ges] ||= []).push(s); });
    Object.keys(groups).sort().forEach(ges => {
      const section = document.createElement('div'), heading = document.createElement('h4'); heading.textContent = ges; section.append(heading);
      groups[ges].forEach(s => section.append(button((s.worker && s.worker.name || 'Novo trabalhador') + ' · ' + (s.state === 'complete' ? 'Concluída' : 'Em andamento') + ' · ' + (s.worker && s.worker.company || 'Empresa não informada') + (sheets.some(x => x.id === s.id) ? ' · rascunho local' : ' · planilha'), async () => {
        persist(); let local = sheets.find(x => x.id === s.id);
        if (!local) { local = await operation(() => rpc('epiLoadSheet', s.id)); sheets.push(local); }
        open(local);
      })));
      $('sheetList').append(section);
    });
  }
  document.addEventListener('epi:catalog-updated', e => { metadata = e.detail; });
  function renderLives() {
    $('lifeRows').replaceChildren();
    Object.keys(lifetimes).sort((a,b) => Number(a)-Number(b)).forEach(ca => {
      const tr = document.createElement('tr'); cell(tr, ca); cell(tr, lifetimes[ca]); const td = cell(tr, '');
      td.append(button('Editar', () => { $('lifeCa').value = ca; $('lifeDays').value = lifetimes[ca]; $('lifeDays').focus(); }), button('Excluir', async () => {
        if (!confirm('Excluir o prazo do CA ' + ca + '?')) return;
        if (remote) await operation(() => rpc('epiDeleteLifetime', ca)); delete lifetimes[ca]; persist(); renderLives();
      })); $('lifeRows').append(tr);
    });
  }
  function renderResult(result) {
    $('resultIntro').replaceChildren(); $('resultRows').replaceChildren();
    [result.worker.name + ' • Setor: ' + result.worker.sector + ' • GES: ' + result.worker.ges].forEach(text => { const p = document.createElement('p'); p.textContent = text; $('resultIntro').append(p); });
    const names = { auditiva: 'Auditiva', dermica: 'Dérmica química', outros: 'Demais EPIs', revisao: 'Revisão manual' };
    result.rows.forEach(row => {
      const tr = document.createElement('tr'); cell(tr, row.date); cell(tr, row.ca + ' · ' + row.name); cell(tr, names[row.group]); cell(tr, row.interval == null ? '—' : row.interval + ' dias'); cell(tr, row.limit == null ? '—' : row.limit + ' dias');
      const td = cell(tr, ''); const tag = document.createElement('span'); tag.textContent = row.status; tag.className = 'status ' + (row.status === 'Dentro do prazo' ? 'ok' : row.status === 'Fora do prazo' ? 'bad' : 'warn'); td.append(tag);
      cell(tr, (row.caExpiry || 'Indisponível') + ' · ' + row.caAtDelivery); cell(tr, row.usefulLifeDays == null ? 'Não cadastrada' : row.usefulLifeDays + ' dias'); $('resultRows').append(tr);
    }); view('results');
  }
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => view(b.dataset.view));
  $('workerForm').onsubmit = e => e.preventDefault();
  $('workerForm').oninput = () => { persist(); renderSheets(); };
  $('ca').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('date').focus(); } };
  $('date').oninput = () => { const v = $('date').value.replace(/\D/g,'').slice(0,8); $('date').value = v.slice(0,2) + (v.length>2 ? '/'+v.slice(2,4) : '') + (v.length>4 ? '/'+v.slice(4) : ''); };
  $('entryForm').onsubmit = guard(async () => {
    const ca = EpiDomain.ca($('ca').value), date = $('date').value, rawLife = $('quickLifeDays').value; EpiDomain.date(date);
    const days = Number(rawLife);
    if (rawLife && !EpiDomain.validLife(days)) throw new Error('Vida útil deve ser um inteiro entre 1 e 36500 dias.');
    if (rawLife) {
      if (lifetimes[ca] && lifetimes[ca] !== days && !confirm('Substituir a vida útil do CA ' + ca + ' de ' + lifetimes[ca] + ' para ' + days + ' dias? O prazo será usado em todas as fichas desse CA.')) return;
      if (remote) await operation(() => rpc('epiSaveLifetime', ca, days));
      lifetimes[ca] = days; renderLives();
    }
    if (editing) { const e = current.entries.find(x => x.id === editing); if (e.ca !== ca || e.date !== date) e.savedAt = ''; e.ca = ca; e.date = date; }
    else current.entries.push({ id: id(), ca, date });
    persist(); renderEntries(); resetInput(); notify(rawLife ? 'Lançamento no rascunho; vida útil salva no cadastro de prazos.' : 'Lançamento registrado no rascunho.');
  });
  $('cancelEdit').onclick = resetInput;
  $('newSheet').onclick = guard(() => { persist(); newSheet(); });
  $('saveSheet').onclick = guard(async () => {
    persist(); if (!$('workerForm').reportValidity()) return; if (editing || $('ca').value || $('date').value || $('quickLifeDays').value) throw new Error('Adicione ou cancele o lançamento em edição antes de salvar.'); EpiDomain.validateSheet(current);
    if (!remote) { notify('Modo local: rascunho salvo apenas neste navegador. Google Sheets exige implantação privada no Apps Script.'); return; }
    const result = await operation(() => rpc('epiSaveSheet', current)); current.revision = result.revision; current.updatedAt = result.updatedAt; result.entries.forEach(saved => { const entry = current.entries.find(e => e.id === saved.id); if (entry) entry.savedAt = saved.savedAt; }); persist(); renderEntries(); notify('Ficha salva na planilha.');
  });
  $('analyze').onclick = guard(async () => {
    persist(); if (!$('workerForm').reportValidity()) return;
    if (editing || $('ca').value || $('date').value || $('quickLifeDays').value) throw new Error('Adicione ou cancele o lançamento em edição antes de analisar.');
    if (!current.entries.length) throw new Error('Adicione pelo menos uma entrega para analisar.');
    EpiDomain.validateSheet(current);
    const result = remote ? await operation(() => rpc('epiAnalyzeSheet', current)) : EpiDomain.analyze(current, catalog, lifetimes, metadata);
    renderResult(result); notify(remote ? 'Análise calculada com a base da planilha.' : 'Demonstração com CAs fictícios; não utilize para conclusões técnicas.');
  });
  $('lifeForm').onsubmit = guard(async () => {
    const ca = EpiDomain.ca($('lifeCa').value), days = Number($('lifeDays').value);
    if (!EpiDomain.validLife(days)) throw new Error('Informe um número inteiro positivo de dias.');
    if (remote) await operation(() => rpc('epiSaveLifetime', ca, days)); lifetimes[ca] = days; persist(); renderLives(); notify('Prazo cadastrado.');
  });
  $('refreshSheets').onclick = guard(async () => {
    if (!remote) { renderSheets(); return; }
    savedSheets = await operation(() => rpc('epiListSheets')); renderSheets(); notify('Lista atualizada. Rascunhos locais mantidos.');
  });
  $('reloadSheet').onclick = guard(async () => {
    if (!remote) throw new Error('Reabertura da planilha exige implantação no Apps Script.');
    if (!confirm('Substituir o rascunho desta ficha pela versão da planilha? Alterações locais desta ficha serão descartadas.')) return;
    const loaded = await operation(() => rpc('epiLoadSheet', current.id));
    sheets = sheets.filter(s => s.id !== loaded.id); sheets.push(loaded); open(loaded); notify('Versão da planilha reaberta.');
  });
  $('clearLocal').onclick = guard(() => {
    if (!confirm('Apagar todos os rascunhos deste navegador? Fichas salvas na planilha serão mantidas.')) return;
    localStorage.removeItem(KEY); sheets = []; newSheet(); notify('Dados locais anteriores apagados.');
  });
  async function init() {
    $('mode').textContent = remote ? 'Google Sheets · acesso privado' : 'Demonstração local · dados fictícios';
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(KEY) || '{}'); sheets = Array.isArray(cache.sheets) ? cache.sheets : []; }
    catch (_) { notify('Rascunho local ilegível; não foi recuperado.', true); }
    if (!remote) {
      catalog = { '90001': { name: 'Protetor auditivo fictício', approvedProtection: 'Proteção auditiva contra ruído', caExpiry: '31/12/2030' }, '90002': { name: 'Luva química fictícia', approvedProtection: 'Proteção das mãos contra agentes químicos', caExpiry: '31/12/2030' }, '90003': { name: 'Creme fictício', approvedProtection: 'Proteção da pele contra agentes químicos', caExpiry: '31/12/2030' }, '90004': { name: 'Luva mecânica fictícia', approvedProtection: 'Proteção das mãos contra agentes abrasivos', caExpiry: '31/12/2030' } };
      lifetimes = cache.demoLifetimes || { '90001': 90 }; metadata = { source: 'DADOS FICTÍCIOS — somente demonstração', referenceDate: '01/01/2020' };
      notify('Demonstração: CAs 90001 (auditivo), 90002 (luva química), 90003 (creme), 90004 (mecânico).');
    }
    if (sheets.length) open(sheets.find(s => s.id === cache.currentId) || sheets[0]); else newSheet();
    renderLives();
    if (remote) {
      try { const data = await operation(() => rpc('epiBootstrap')); catalog = data.catalog; metadata = data.metadata; lifetimes = data.lifetimes; savedSheets = data.sheets; document.dispatchEvent(new CustomEvent('epi:connection',{detail:data.connection})); renderLives(); renderSheets(); notify('Planilha conectada.'); }
      catch (err) { notify('Conexão com a planilha falhou: ' + err.message + '. O rascunho local continua disponível.', true); }
    }
  }
  function timeLabel(value) { return value ? new Date(value).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'}) + ' (Brasília)' : 'Horário não registrado'; }
  let reportReady = false, reportGeneration = 0;
  function invalidateReport() { reportGeneration++; reportReady = false; $('printReport').disabled = true; $('reportPreview').replaceChildren(); $('reportStatus').textContent = 'Gere a prévia para usar os filtros atuais.'; }
  $('reportForm').oninput = invalidateReport;
  $('reportForm').onsubmit = guard(async () => {
    invalidateReport(); const generation = reportGeneration; persist();
    const filters = {start:$('reportStart').value,end:$('reportEnd').value,company:$('reportCompany').value,ges:$('reportGes').value,worker:$('reportWorker').value,sector:$('reportSector').value,role:$('reportRole').value,state:$('reportState').value};
    EpiReports.validate(filters);
    const fromGoogle = $('reportSource').value === 'google';
    if (fromGoogle && !remote) throw new Error('Buscar fichas Google exige abrir a aplicação implantada no Apps Script.');
    const local = fromGoogle ? null : sheets.filter(s => s.entries.length && EpiReports.matches(s,filters));
    if (local) local.forEach(EpiDomain.validateSheet);
    const result = remote ? await operation(() => rpc('epiGenerateReports', filters, local)) : EpiReports.create(local,catalog,lifetimes,metadata,filters);
    if (generation !== reportGeneration) return;
    const preview = $('reportPreview');
    function paragraph(parent, text, tag = 'p') { const el = document.createElement(tag); el.textContent = text; parent.append(el); }
    paragraph(preview,'Relatório de fichas de EPI','h2');
    paragraph(preview,'Gerado em ' + timeLabel(result.generatedAt) + ' • Origem: ' + (fromGoogle ? 'Planilha Google' : 'Rascunhos deste navegador'));
    paragraph(preview,'Filtros: ' + Object.entries(filters).filter(([,v]) => v).map(([k,v]) => ({start:'Entrega desde',end:'Entrega até',company:'Empresa',ges:'GES',worker:'Funcionário',sector:'Setor',role:'Cargo',state:'Situação'}[k]) + ': ' + v).join(' • '));
    paragraph(preview,'Fonte de CAs: ' + (result.metadata.source || 'Indisponível') + ' • Referência: ' + (result.metadata.referenceDate || 'Não confirmada'));
    if (!remote) paragraph(preview,'DEMONSTRAÇÃO COM CAs FICTÍCIOS — não usar para conclusões técnicas.');
    result.reports.forEach(report => {
      const section = document.createElement('article'); section.className = 'report-sheet'; preview.append(section);
      const w = report.worker;
      paragraph(section,(w.company || 'Empresa não informada') + ' • ' + w.name,'h3');
      paragraph(section,'Setor: ' + w.sector + ' • Cargo: ' + w.role + ' • GES: ' + w.ges + ' • ' + (report.state === 'complete' ? 'Concluída' : 'Em andamento'));
      paragraph(section,'Último salvamento da ficha: ' + timeLabel(report.updatedAt));
      if (report.stale) paragraph(section,'Data de referência da base ausente ou desatualizada. Confirme a situação dos CAs na fonte oficial.');
      report.warnings.forEach(warning => paragraph(section,warning));
      const table = document.createElement('table'), head = document.createElement('thead'), header = document.createElement('tr'), body = document.createElement('tbody');
      ['Entrega','CA / EPI','Grupo','Intervalo','Limite / CA anterior','Vida útil','Resultado','Validade do CA','Salvo na planilha'].forEach(label => { const th = document.createElement('th'); th.textContent = label; header.append(th); });
      head.append(header); table.append(head,body); section.append(table);
      report.rows.forEach(row => { const tr = document.createElement('tr'); [row.date,row.ca + ' • ' + row.name,{auditiva:'Auditiva',dermica:'Dérmica química',outros:'Demais EPIs',revisao:'Revisão manual'}[row.group],row.interval == null ? '—' : row.interval + ' dias',row.limit == null ? '—' : row.limit + ' dias / CA ' + row.previousCa,row.usefulLifeDays == null ? 'Não cadastrada' : row.usefulLifeDays + ' dias',row.status,(row.caExpiry || 'Indisponível') + ' • ' + row.caAtDelivery,timeLabel(row.savedAt)].forEach(value => cell(tr,value)); body.append(tr); });
    });
    paragraph(preview,'A validade do CA não determina a vida útil do EPI. O limite usa a vida útil do CA anterior; proteção dérmica química usa 30 dias. Esta análise não avalia adequação ao risco, uso efetivo ou proteção após a última entrega.');
    $('reportStatus').textContent = result.reports.length + ' ficha(s), ' + result.reports.reduce((sum,r) => sum+r.rows.length,0) + ' lançamento(s).';
    reportReady = result.reports.length > 0; $('printReport').disabled = !reportReady;
  });
  $('printReport').onclick = () => { if (reportReady) window.print(); };
  init();
})();
