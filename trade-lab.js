(() => {
  'use strict';
  const $ = id => document.getElementById(id), E = window.TradeEngine;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => Number(n).toFixed(1), signed = n => (n > 0 ? '+' : '') + fmt(n);
  let data, give = new Set(), get = new Set(), searchVersion = 0, loadVersion = 0, results = [];
  const mine = () => data.rosters.find(r => String(r.id) === $('team').value);
  const theirs = () => data.rosters.find(r => String(r.id) === $('partner').value);
  async function api(action, body) {
    const response = await fetch('/api/trade-lab?action=' + action, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && action !== 'login') lockUI();
      throw new Error(result.error || 'Request failed.');
    }
    return result;
  }
  function lockUI() {
    searchVersion++; loadVersion++; data = null; results = []; give.clear(); get.clear();
    $('lab').hidden = true; $('gate').hidden = false; $('lock').hidden = true;
    for (const id of ['mine','theirs','analysis','results','source','format']) $(id).replaceChildren();
    $('workspace').hidden = true;
  }
  const options = rosters => rosters.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  async function refresh() {
    searchVersion++; const version = ++loadVersion; $('refresh').disabled = true; $('status').textContent = 'Syncing live league rosters and completed scoring…';
    $('workspace').hidden = true;
    const previous = data && mine()?.id;
    try {
      const loaded = await api('data');
      if (version !== loadVersion) return;
      data = loaded;
      $('team').innerHTML = options(data.rosters);
      const defaultTeam = E.defaultRoster(data.rosters);
      if (previous && data.rosters.some(r => r.id === previous)) $('team').value = previous;
      else if (defaultTeam) $('team').value = defaultTeam.id;
      $('format').textContent = `${data.league.teams}-team ${data.league.slots.includes('SUPER_FLEX') ? 'Superflex' : 'league'} · ${data.league.season}`;
      $('source').textContent = `Live roster sync: ${new Date(data.fetchedAt).toLocaleString()}. Scoring weeks: ${data.weeks.join(', ') || 'none finalized'}. ${data.league.slots.join(' / ')}.`;
      $('status').textContent = `Live Sleeper rosters loaded.${defaultTeam ? '' : ' Brrr’s House of Ice was not found; choose your team.'} ${data.weeks.length ? 'Recent scores loaded.' : 'No finalized scores yet. Enter manual estimates.'}`;
      $('workspace').hidden = false; teamChanged();
    } catch (e) { if (version === loadVersion) $('status').textContent = e.message; }
    finally { $('refresh').disabled = false; }
  }
  async function open() { $('gate').hidden = true; $('lab').hidden = false; $('lock').hidden = false; await refresh(); }
  function invalidate() {
    searchVersion++; results = []; $('results').replaceChildren(); $('analysis').replaceChildren();
    $('finderStatus').textContent = ''; $('find').disabled = false; $('cancel').hidden = true;
  }
  function teamChanged() {
    invalidate(); give.clear(); get.clear();
    $('partner').innerHTML = options(data.rosters.filter(r => r.id !== mine().id)); renderRosters();
  }
  function rosterHTML(roster, selected, side, search) {
    return roster.players.filter(id => data.players[id]).filter(id => {
      const p = data.players[id]; return `${p.name} ${p.positions.join(' ')} ${p.team}`.toLowerCase().includes(search.toLowerCase());
    }).sort((a,b) => (data.players[b].value ?? -999) - (data.players[a].value ?? -999)).map(id => {
      const p = data.players[id], tag = roster.reserve.includes(id) ? ' · IR' : roster.taxi.includes(id) ? ' · TAXI' : '';
      return `<div class="player"><input type="checkbox" id="pick-${side}-${esc(id)}" data-side="${side}" data-id="${esc(id)}" ${selected.has(id) ? 'checked' : ''}><label class="name" for="pick-${side}-${esc(id)}">${esc(p.name)}<small>${esc(p.positions.join('/'))} · ${esc(p.team)}${tag}${p.injury ? ' · ' + esc(p.injury) : ''} · ${p.samples} samples</small></label><label class="points">BASELINE<input class="estimate" aria-label="${esc(p.name)} baseline points" type="number" min="-100" max="100" step="0.1" placeholder="Unknown" value="${p.value == null ? '' : fmt(p.value)}" data-estimate="${esc(id)}"></label></div>`;
    }).join('') || '<p class="empty">No matching players.</p>';
  }
  function renderRosters() {
    if (!data || !mine() || !theirs()) return;
    $('myName').textContent = mine().name; $('theirName').textContent = theirs().name;
    $('mine').innerHTML = rosterHTML(mine(), give, 'give', $('searchMine').value);
    $('theirs').innerHTML = rosterHTML(theirs(), get, 'get', $('searchTheirs').value);
    $('selection').textContent = `${give.size} outgoing · ${get.size} incoming`;
  }
  function names(ids) { return ids.map(id => data.players[id]?.name || id).join(' + '); }
  function metric(n, label) { return `<div class="metric"><strong class="${n >= 0 ? 'positive' : 'negative'}">${signed(n)}</strong><span>${label}</span></div>`; }
  function lineupHTML(before, after, title) {
    return `<div><h3>${esc(title)}</h3><p>${fmt(before.total)} → ${fmt(after.total)} baseline points</p>${after.rows.map((r,i) => `<div class="lineup-row"><small>${esc(r.slot)}</small><span>${esc(r.id ? data.players[r.id].name : 'Empty slot')}${before.rows[i].id !== r.id ? `<small> was ${esc(before.rows[i].id ? data.players[before.rows[i].id].name : 'empty')}</small>` : ''}</span><b>${fmt(r.value)}</b></div>`).join('')}</div>`;
  }
  function resultHTML(r, full = false, index = 0) {
    const partner = data.rosters.find(t => t.id === r.partner);
    return `<article class="panel result"><span class="eyebrow">${full ? 'TRADE REPORT' : '#' + (index + 1) + ' / ' + esc(partner.name)}</span><h3>${esc(r.verdict)}</h3><p>Send <b>${esc(names(r.give))}</b><br>Receive <b>${esc(names(r.get))}</b></p><div class="metrics">${metric(r.deltaA,'Your lineup / points')}${metric(r.deltaB,'Partner lineup / points')}<div class="metric"><strong>${fmt(r.fairness)}%</strong><span>Value balance</span></div><div class="metric"><strong>${fmt(r.score)}</strong><span>Trade rank score</span></div></div>${r.warnings.map(w => `<p class="warning">${esc(w)}</p>`).join('')}${full ? `<div class="lineups">${lineupHTML(r.beforeA,r.afterA,mine().name)}${lineupHTML(r.beforeB,r.afterB,partner.name)}</div>` : `<button data-review="${index}">Review in analyzer →</button>`}</article>`;
  }
  function analyze() {
    const invalid = document.querySelector('.estimate:invalid');
    if (invalid) { invalid.reportValidity(); $('analysis').textContent = 'Correct invalid baseline points before analyzing.'; return; }
    try { const r = E.analyze(mine(),theirs(),[...give],[...get],data.players,data.league,$('mode').value); $('analysis').innerHTML = resultHTML(r,true); }
    catch(e) { $('analysis').textContent = e.message; }
  }
  function tab(which) {
    $('manual').hidden = which !== 'manual'; $('finder').hidden = which !== 'finder';
    $('manualTab').setAttribute('aria-pressed', String(which === 'manual')); $('finderTab').setAttribute('aria-pressed', String(which === 'finder'));
  }
  $('unlock').addEventListener('submit', async event => {
    event.preventDefault(); const button = event.submitter; button.disabled = true;
    try { await api('login', { code: $('code').value }); $('code').value = ''; await open(); }
    catch(e) { $('gateStatus').textContent = e.message; }
    finally { button.disabled = false; }
  });
  $('lock').onclick = async () => { try { await api('logout', {}); lockUI(); $('gateStatus').textContent = 'Lab locked.'; } catch(e) { $('status').textContent = e.message; } };
  $('refresh').onclick = refresh; $('team').onchange = teamChanged;
  $('partner').onchange = () => { get.clear(); invalidate(); renderRosters(); };
  $('mode').onchange = invalidate;
  $('manualTab').onclick = () => tab('manual'); $('finderTab').onclick = () => tab('finder');
  $('searchMine').oninput = renderRosters; $('searchTheirs').oninput = renderRosters;
  for (const id of ['mine','theirs']) $(id).addEventListener('change', event => {
    const el = event.target;
    if (el.dataset.side) { const set = el.dataset.side === 'give' ? give : get; el.checked ? set.add(el.dataset.id) : set.delete(el.dataset.id); $('selection').textContent = `${give.size} outgoing · ${get.size} incoming`; $('analysis').replaceChildren(); }
    if (el.dataset.estimate) {
      const val = el.value === '' ? null : Number(el.value);
      if (val !== null && (!Number.isFinite(val) || val < -100 || val > 100)) { el.setCustomValidity('Use a number between -100 and 100.'); el.reportValidity(); return; }
      el.setCustomValidity(''); data.players[el.dataset.estimate].value = val; invalidate();
    }
  });
  $('analyze').onclick = analyze;
  $('cancel').onclick = () => { invalidate(); $('finderStatus').textContent = 'Search cancelled.'; };
  for (const id of ['minGain','fairness','bundles','mutual']) $(id).onchange = invalidate;
  $('find').onclick = async () => {
    if (document.querySelector('.estimate:invalid')) { $('finderStatus').textContent = 'Correct invalid baseline points in the manual analyzer first.'; return; }
    if (!$('minGain').reportValidity() || !$('fairness').reportValidity()) return;
    const version = ++searchVersion;
    $('find').disabled = true; $('cancel').hidden = false; $('results').replaceChildren();
    $('finderStatus').textContent = 'Comparing legal lineups across the league…';
    try {
      const found = await E.find(data, mine(), { mode: $('mode').value, minGain: Number($('minGain').value), minFairness: Number($('fairness').value), bundles: $('bundles').checked, mutual: $('mutual').checked }, count => { if (version === searchVersion) $('finderStatus').textContent = `${count.toLocaleString()} trades evaluated…`; }, () => version !== searchVersion);
      if (version !== searchVersion) return;
      results = found.results;
      $('finderStatus').textContent = `${found.checked.toLocaleString()} trades evaluated · ${results.length} ranked results. ${results.length ? '' : 'No deals match your filters. Try adjusting estimates or lowering thresholds.'}`;
      $('results').innerHTML = results.map((r,i) => resultHTML(r,false,i)).join('');
    } catch(e) { if (version === searchVersion) $('finderStatus').textContent = e.message; }
    finally { if (version === searchVersion) { $('find').disabled = false; $('cancel').hidden = true; } }
  };
  $('results').onclick = event => {
    const button = event.target.closest('[data-review]'); if (!button) return;
    const r = results[Number(button.dataset.review)]; $('partner').value = r.partner; give = new Set(r.give); get = new Set(r.get);
    $('searchMine').value = ''; $('searchTheirs').value = ''; renderRosters(); tab('manual'); analyze(); $('manualTab').focus();
  };
  api('session').then(open).catch(e => { $('gateStatus').textContent = e.message; });
})();
