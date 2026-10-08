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
    try { return await fn(); } finally { busy = false; document.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
  }
  function cell(tr, value) { const td = document.createElement('td'); td.textContent = value == null ? '—' : value; tr.append(td); return td; }
  function button(label, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = guard(fn); return b; }
  function view(name) { document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== name; }); document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name)); }
  function capture() {
    if (!current) return;
    current.worker.name = $('workerName').value; current.worker.sector = $('workerSector').value;
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
      const tr = document.createElement('tr'); cell(tr, e.ca); cell(tr, e.date);
      const actions = cell(tr, ''); actions.append(button('Editar', () => { editing = e.id; $('ca').value = e.ca; $('date').value = e.date; $('physicalExpiry').value = e.physicalExpiry || ''; $('addEntry').textContent = 'Atualizar'; $('cancelEdit').hidden = false; $('ca').focus(); }), button('Excluir', () => {
        if (!confirm('Excluir este lançamento?')) return;
        current.entries = current.entries.filter(x => x.id !== e.id); if (editing === e.id) resetInput(); persist(); renderEntries();
      })); $('entries').append(tr);
    });
  }
  function resetInput() { editing = null; $('entryForm').reset(); $('physicalExpiry').value = ''; $('addEntry').textContent = 'Adicionar'; $('cancelEdit').hidden = true; $('ca').focus(); }
  function open(sheet) {
    current = sheet;
    $('workerName').value = sheet.worker.name; $('workerSector').value = sheet.worker.sector;
    $('workerRole').value = sheet.worker.role; $('workerGes').value = sheet.worker.ges; $('sheetState').value = sheet.state;
    resetInput(); renderEntries(); renderSheets(); persist(); view('entry');
  }
  function newSheet() {
    const sheet = { id: id(), worker: { id: id(), name: '', sector: '', role: '', ges: '' }, entries: [], state: 'draft', revision: 0 };
    sheets.push(sheet); open(sheet); $('workerName').focus();
  }
  function renderSheets() {
    $('sheetList').replaceChildren();
    const merged = new Map(savedSheets.map(s => [s.id, s])); sheets.forEach(s => merged.set(s.id, s));
    const groups = {};
    merged.forEach(s => { const ges = s.worker && s.worker.ges || 'GES não informado'; (groups[ges] ||= []).push(s); });
    Object.keys(groups).sort().forEach(ges => {
      const section = document.createElement('div'), heading = document.createElement('h4'); heading.textContent = ges; section.append(heading);
      groups[ges].forEach(s => section.append(button((s.worker && s.worker.name || 'Novo trabalhador') + ' · ' + (s.state === 'complete' ? 'Concluída' : 'Em andamento') + (sheets.some(x => x.id === s.id) ? ' · rascunho local' : ' · planilha'), async () => {
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
    [result.worker.name + ' • GES: ' + result.worker.ges,
      'Fonte: ' + (result.metadata.source || 'Indisponível') + ' • Referência: ' + (result.metadata.referenceDate || 'Indisponível'),
      result.stale ? 'Base indisponível ou com referência superior a 30 dias: confirme a situação atual dos CAs.' : 'Referência recente; confirme a situação atual na fonte oficial.', ...result.warnings].forEach(text => { const p = document.createElement('p'); p.textContent = text; $('resultIntro').append(p); });
    const names = { auditiva: 'Auditiva', dermica: 'Dérmica química', outros: 'Demais EPIs', revisao: 'Revisão manual' };
    result.rows.forEach(row => {
      const tr = document.createElement('tr'); cell(tr, row.date); cell(tr, row.ca + ' · ' + row.name); cell(tr, names[row.group]); cell(tr, row.interval == null ? '—' : row.interval + ' dias'); cell(tr, row.limit == null ? '—' : row.limit + ' dias');
      const td = cell(tr, ''); const tag = document.createElement('span'); tag.textContent = row.status; tag.className = 'status ' + (row.status === 'Dentro do prazo' ? 'ok' : row.status === 'Fora do prazo' ? 'bad' : 'warn'); td.append(tag);
      cell(tr, (row.caExpiry || 'Indisponível') + ' · ' + row.caAtDelivery); cell(tr, row.physicalExpiry || 'Não informada'); $('resultRows').append(tr);
    }); view('results');
  }
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => view(b.dataset.view));
  $('workerForm').onsubmit = e => e.preventDefault();
  $('workerForm').oninput = () => { persist(); renderSheets(); };
  $('ca').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('date').focus(); } };
  $('date').oninput = () => { const v = $('date').value.replace(/\D/g,'').slice(0,8); $('date').value = v.slice(0,2) + (v.length>2 ? '/'+v.slice(2,4) : '') + (v.length>4 ? '/'+v.slice(4) : ''); };
  $('entryForm').onsubmit = guard(() => {
    const ca = EpiDomain.ca($('ca').value), date = $('date').value, physicalExpiry = $('physicalExpiry').value; EpiDomain.date(date); if (physicalExpiry) EpiDomain.date(physicalExpiry);
    if (editing) { const e = current.entries.find(x => x.id === editing); e.ca = ca; e.date = date; e.physicalExpiry = physicalExpiry; }
    else current.entries.push({ id: id(), ca, date, physicalExpiry });
    persist(); renderEntries(); resetInput(); notify('Lançamento registrado no rascunho.');
  });
  $('cancelEdit').onclick = resetInput;
  $('newSheet').onclick = guard(() => { persist(); newSheet(); });
  $('saveSheet').onclick = guard(async () => {
    persist(); if (!$('workerForm').reportValidity()) return; if (editing || $('ca').value || $('date').value || $('physicalExpiry').value) throw new Error('Adicione ou cancele o lançamento em edição antes de salvar.'); EpiDomain.validateSheet(current);
    if (!remote) { notify('Modo local: rascunho salvo apenas neste navegador. Google Sheets exige implantação privada no Apps Script.'); return; }
    const result = await operation(() => rpc('epiSaveSheet', current)); current.revision = result.revision; persist(); notify('Ficha salva na planilha.');
  });
  $('analyze').onclick = guard(async () => {
    persist(); if (!$('workerForm').reportValidity()) return;
    if (editing || $('ca').value || $('date').value || $('physicalExpiry').value) throw new Error('Adicione ou cancele o lançamento em edição antes de analisar.');
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
  init();
})();
