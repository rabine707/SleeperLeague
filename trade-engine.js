(function (root) {
  'use strict';
  const FLEX = { FLEX: ['RB','WR','TE'], SUPER_FLEX: ['QB','RB','WR','TE'], REC_FLEX: ['WR','TE'], WRRB_FLEX: ['WR','RB'], IDP_FLEX: ['DL','LB','DB'] };
  const eligible = (p, slot) => (FLEX[slot] || [slot]).some(pos => p.positions.includes(pos));
  const value = p => Number.isFinite(p?.value) ? p.value : 0;
  // Rectangular Hungarian assignment: slots are rows, players + empty slots are columns.
  // Unlike greedy assignment, dual-eligible players cannot consume a scarce position incorrectly.
  function lineup(roster, players, slots) {
    const excluded = new Set([...(roster.reserve || []), ...(roster.taxi || [])]);
    const pool = roster.players.filter(id => !excluded.has(id) && players[id]);
    const n = slots.length, m = pool.length + n;
    const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
    const cost = (i, j) => j > pool.length ? 0 : eligible(players[pool[j - 1]], slots[i - 1]) ? -value(players[pool[j - 1]]) : 1e6;
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const min = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
      do {
        used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
        for (let j = 1; j <= m; j++) if (!used[j]) {
          const cur = cost(i0, j) - u[i0] - v[j];
          if (cur < min[j]) { min[j] = cur; way[j] = j0; }
          if (min[j] < delta) { delta = min[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else min[j] -= delta;
        j0 = j1;
      } while (p[j0]);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const rows = slots.map(slot => ({ slot, id: null, value: 0 }));
    for (let j = 1; j <= pool.length; j++) if (p[j]) rows[p[j] - 1] = { slot: slots[p[j] - 1], id: pool[j - 1], value: value(players[pool[j - 1]]) };
    return { rows, total: rows.reduce((s, r) => s + r.value, 0), empty: rows.filter(r => !r.id).length };
  }
  function swap(roster, give, get) {
    return { ...roster, players: roster.players.filter(id => !give.includes(id)).concat(get), reserve: (roster.reserve || []).filter(id => !give.includes(id)), taxi: (roster.taxi || []).filter(id => !give.includes(id)) };
  }
  function analyze(a, b, give, get, players, league, mode = 'win-now') {
    if (a.id === b.id || !give.length || !get.length || new Set(give).size !== give.length || new Set(get).size !== get.length ||
      give.some(id => !a.players.includes(id)) || get.some(id => !b.players.includes(id)) || give.some(id => get.includes(id))) throw new Error('Choose different teams and at least one owned player on each side.');
    const beforeA = lineup(a, players, league.slots), beforeB = lineup(b, players, league.slots);
    const nextA = swap(a, give, get), nextB = swap(b, get, give);
    const afterA = lineup(nextA, players, league.slots), afterB = lineup(nextB, players, league.slots);
    const deltaA = afterA.total - beforeA.total, deltaB = afterB.total - beforeB.total;
    const outgoing = give.reduce((s, id) => s + Math.max(0, value(players[id])), 0), incoming = get.reduce((s, id) => s + Math.max(0, value(players[id])), 0);
    const fairness = Math.max(outgoing, incoming) ? 100 * Math.min(outgoing, incoming) / Math.max(outgoing, incoming) : 100;
    const warnings = [];
    for (const [r, label] of [[nextA, a.name], [nextB, b.name]]) {
      const activeCount = r.players.filter(id => !(r.reserve || []).includes(id) && !(r.taxi || []).includes(id)).length;
      if (activeCount > league.rosterLimit) warnings.push(`${label}: drop ${activeCount - league.rosterLimit} player(s) to fit the active roster.`);
    }
    const unknown = [...give, ...get].filter(id => players[id]?.value == null);
    if (unknown.length) warnings.push('Missing scoring samples: enter manual estimates before relying on this result.');
    if ([...give, ...get].some(id => players[id]?.injury)) warnings.push('Injury flags present. Review availability; baseline scores are not injury forecasts.');
    if (afterA.empty || afterB.empty) warnings.push('At least one team has an unfilled starter slot.');
    return { give, get, partner: b.id, beforeA, beforeB, afterA, afterB, deltaA, deltaB, fairness, warnings,
      score: deltaA * (mode === 'balanced' ? 1 : 2) + deltaB * (mode === 'balanced' ? 1 : .35) - (100 - fairness) / 20,
      verdict: unknown.length ? 'Needs estimates' : deltaA > .1 && deltaB > .1 ? 'Both lineups improve' : deltaA > .1 ? 'Your lineup improves' : 'No immediate lineup gain' };
  }
  function defaultRoster(rosters) {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return rosters.find(r => normalize(r.name).includes('brrr') && normalize(r.name).includes('houseofice')) || rosters.find(r => r.owner === '636685844886925312') || null;
  }
  async function find(data, team, options = {}, progress = () => {}, cancelled = () => false) {
    const results = [], partners = data.rosters.filter(r => r.id !== team.id);
    const valid = r => r.players.filter(id => data.players[id]?.value != null && value(data.players[id]) > 0 && !(r.reserve || []).includes(id) && !(r.taxi || []).includes(id)).sort((a,b) => value(data.players[b]) - value(data.players[a]));
    const mine = valid(team), packs = ids => ids.flatMap((id,i) => ids.slice(i + 1).map(other => [id, other]));
    let checked = 0;
    for (const partner of partners) {
      const theirs = valid(partner);
      const candidates = mine.flatMap(a => theirs.map(b => [[a],[b]]));
      if (options.bundles) {
        for (const pair of packs(mine.slice(0,8))) for (const id of theirs.slice(0,8)) candidates.push([pair,[id]]);
        for (const id of mine.slice(0,8)) for (const pair of packs(theirs.slice(0,8))) candidates.push([[id],pair]);
      }
      for (const [give, get] of candidates) {
        if (cancelled()) return { results: [], checked, cancelled: true };
        const result = analyze(team, partner, give, get, data.players, data.league, options.mode);
        checked++;
        if (result.deltaA >= (options.minGain ?? .1) && result.fairness >= (options.minFairness ?? 60) && (!options.mutual || result.deltaB > .1) && !result.warnings.some(w => /drop |Missing/.test(w))) results.push(result);
        if (checked % 100 === 0) { progress(checked); await new Promise(resolve => setTimeout(resolve, 0)); }
      }
    }
    results.sort((a,b) => b.score - a.score || b.fairness - a.fairness || a.partner - b.partner || a.give.join().localeCompare(b.give.join()));
    return { results: results.slice(0,50), checked, cancelled: false };
  }
  const api = { eligible, lineup, analyze, find, defaultRoster };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TradeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
