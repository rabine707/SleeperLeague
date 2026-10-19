const LEAGUE = '1382152189975199744';
const cache = new Map();
async function read(path, ttl = 60000) {
  const old = cache.get(path);
  if (old && old.until > Date.now()) return old.promise;
  const promise = fetch('https://api.sleeper.app/v1' + path, { signal: AbortSignal.timeout(12000) }).then(r => {
    if (!r.ok) throw new Error('Sleeper unavailable');
    return r.json();
  });
  cache.set(path, { promise, until: Date.now() + ttl });
  try { return await promise; } catch (e) { cache.delete(path); throw e; }
}
async function load() {
  const [league, rosters, users, catalog] = await Promise.all([
    read('/league/' + LEAGUE), read('/league/' + LEAGUE + '/rosters'),
    read('/league/' + LEAGUE + '/users'), read('/players/nfl', 86400000)
  ]);
  if (!league || league.sport !== 'nfl' || !Array.isArray(rosters) || !Array.isArray(users)) throw new Error('Invalid league response');
  // last_scored_leg is Sleeper's finalized scoring boundary; never use an ongoing week.
  const end = Math.min(18, Number(league.settings?.last_scored_leg) || 0);
  const weeks = Array.from({ length: Math.min(5, end) }, (_, i) => end - i).reverse();
  const results = await Promise.all(weeks.map(w => read(`/league/${LEAGUE}/matchups/${w}`)));
  const samples = {};
  results.forEach((rows, i) => {
    const seen = new Set();
    for (const row of rows) for (const [id, score] of Object.entries(row.players_points || {})) {
      if (!seen.has(id) && Number.isFinite(score)) { (samples[id] ||= []).push({ week: weeks[i], score }); seen.add(id); }
    }
  });
  const ids = new Set(rosters.flatMap(r => r.players || []));
  const players = {};
  for (const id of ids) {
    const p = catalog[id] || {};
    const history = samples[id] || [];
    players[id] = { id, name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || id,
      positions: p.fantasy_positions || [p.position || id], team: p.team || 'FA', age: p.age,
      injury: p.injury_status || '', samples: history.length,
      value: history.length ? history.reduce((s, x) => s + x.score, 0) / history.length : null };
  }
  return { league: { id: LEAGUE, name: league.name, season: league.season, teams: league.total_rosters,
    slots: league.roster_positions.filter(p => !['BN','IR'].includes(p)), scoring: league.scoring_settings,
    rosterLimit: league.roster_positions.length, reserveSlots: league.settings?.reserve_slots || 0 },
    rosters: rosters.map(r => ({ id: r.roster_id, owner: r.owner_id, players: r.players || [], reserve: r.reserve || [], taxi: r.taxi || [],
      name: users.find(u => u.user_id === r.owner_id)?.metadata?.team_name || users.find(u => u.user_id === r.owner_id)?.display_name || `Team ${r.roster_id}` })),
    players, weeks, fetchedAt: new Date().toISOString() };
}
module.exports = { load };
