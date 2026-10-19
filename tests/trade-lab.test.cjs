const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const E = require('../trade-engine.js'), auth = require('../lib/trade-auth.cjs'), handler = require('../api/trade-lab.js');
const player = (positions, value) => ({ positions, value, name: positions.join('/'), samples: 5 });
const players = { q:player(['QB'],30), r:player(['RB'],20), w:player(['WR'],25), dual:player(['RB','WR'],40), t:player(['TE'],10), x:player(['WR'],15) };
const roster = (id, ids, reserve=[]) => ({ id, name:'Team '+id, players:ids, reserve, taxi:[] });
const cfg = { hash:'a'.repeat(32) + ':' + crypto.scryptSync('fixture-code-for-tests','a'.repeat(32),64).toString('hex'), secret:'test-signing-secret-'.repeat(3) };
test('exact optimizer preserves scarce dual-position eligibility', () => {
  const result = E.lineup(roster(1,['r','dual','w']),players,['RB','RB','WR']);
  assert.equal(result.total,85); assert.equal(new Set(result.rows.map(r=>r.id)).size,3);
});
test('Superflex can start a second QB, IR and taxi cannot start', () => {
  const p = {...players,q2:player(['QB'],29)};
  const r = roster(1,['q','q2','w','dual'],['dual']); r.taxi=['w'];
  const result = E.lineup(r,p,['QB','SUPER_FLEX','WR']);
  assert.equal(result.total,59); assert.equal(result.empty,1);
});
test('negative and unknown baselines leave optional empty slots', () => {
  assert.equal(E.lineup(roster(1,['n','u']),{n:player(['QB'],-2),u:player(['QB'],null)},['QB']).total,0);
});
test('optimizer agrees with exhaustive assignment over seeded random inputs', () => {
  let seed=42; const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  const slots=['RB','WR','FLEX','SUPER_FLEX'];
  for(let k=0;k<50;k++) {
    const p={}; for(let i=0;i<7;i++)p[i]=player([['RB','WR','QB','TE'][Math.floor(random()*4)]],Math.floor(random()*40)-5);
    const ids=Object.keys(p);
    const brute=(i,used)=>i===slots.length?0:Math.max(brute(i+1,used),...ids.filter(id=>!used.includes(id)&&E.eligible(p[id],slots[i])).map(id=>p[id].value+brute(i+1,[...used,id])));
    assert.equal(E.lineup(roster(1,ids),p,slots).total,brute(0,[]));
  }
});
test('manual trade validates ownership and duplicates, does not mutate input', () => {
  const a=roster(1,['q','r']),b=roster(2,['w','t']),league={slots:['QB','FLEX'],rosterLimit:2};
  const snapshot=JSON.stringify([a,b]);
  assert.throws(()=>E.analyze(a,b,['w'],['r'],players,league));
  assert.throws(()=>E.analyze(a,b,['r','r'],['w'],players,league));
  const r=E.analyze(a,b,['r'],['w'],players,league); assert.equal(r.deltaA,5); assert.equal(JSON.stringify([a,b]),snapshot);
});
test('package trades report required roster drops', () => {
  const r=E.analyze(roster(1,['r']),roster(2,['w','t']),['r'],['w','t'],players,{slots:['FLEX'],rosterLimit:1});
  assert.ok(r.warnings.some(w=>w.includes('drop 1')));
});
test('unknown player values warn instead of implying a reliable ranking', () => {
  const r=E.analyze(roster(1,['r']),roster(2,['u']),['r'],['u'],{...players,u:player(['RB'],null)},{slots:['RB'],rosterLimit:2});
  assert.equal(r.verdict,'Needs estimates');
});
test('default recognizes punctuation and stable owner identity', () => {
  assert.equal(E.defaultRoster([{id:3,name:'Brrr’s House of Ice'}]).id,3);
  assert.equal(E.defaultRoster([{id:9,name:'Renamed',owner:'636685844886925312'}]).id,9);
  assert.equal(E.defaultRoster([{id:1,name:'Other'}]),null);
});
test('finder ranks across all opponents and supports cancellation', async () => {
  const data={rosters:[roster(1,['r','t']),roster(2,['w','x']),roster(3,['dual'])],players,league:{slots:['FLEX'],rosterLimit:4}};
  const result=await E.find(data,data.rosters[0],{minFairness:0,bundles:true});
  assert.ok(result.checked>4); assert.ok(result.results.some(r=>r.partner===2)); assert.ok(result.results.some(r=>r.partner===3));
  assert.ok(result.results.every((r,i,a)=>i===0||a[i-1].score>=r.score));
  assert.equal((await E.find(data,data.rosters[0],{},()=>{},()=>true)).cancelled,true);
});
test('access verifier rejects wrong, malformed and oversized codes',async()=>{
  assert.equal(await auth.verify('fixture-code-for-tests',cfg),true);
  for(const code of ['wrong',null,{},'x'.repeat(257)])assert.equal(await auth.verify(code,cfg),false);
});
test('sessions reject tampering, expiry, and secret/hash rotation',()=>{
  const now=Date.now(),token=auth.issue(cfg,now),req={headers:{cookie:'bape_trade_lab='+token}};
  assert.equal(auth.authorized(req,cfg,now),true);
  assert.equal(auth.authorized(req,cfg,now+14401000),false);
  assert.equal(auth.authorized(req,{...cfg,secret:'new'},now),false);
  assert.equal(auth.authorized(req,{...cfg,hash:cfg.hash+'1'},now),false);
  assert.equal(auth.authorized({headers:{cookie:'bape_trade_lab='+token+'x'}},cfg),false);
  assert.equal(auth.authorized({headers:{cookie:'bape_trade_lab='+token.split('.')[0]+'.'+'é'.repeat(43)}},cfg),false);
});
async function request(action,method='GET',body,headers={}) {
  const req={url:'/api/trade-lab?action='+action,query:{action},method,body,headers:{host:'localhost:5173',origin:'http://localhost:5173',...headers},socket:{remoteAddress:'test'}};
  const res={headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this}};
  await handler(req,res);return res;
}
test('API fails closed unset, requires auth for data, verifies origin and sets private cookies',async()=>{
  const prevHash=process.env.TRADE_LAB_CODE_HASH,prevSecret=process.env.TRADE_LAB_SESSION_SECRET;
  try {
    delete process.env.TRADE_LAB_CODE_HASH;delete process.env.TRADE_LAB_SESSION_SECRET;
    assert.equal((await request('data')).code,503);
    process.env.TRADE_LAB_CODE_HASH=cfg.hash;process.env.TRADE_LAB_SESSION_SECRET=cfg.secret;
    assert.equal((await request('data')).code,401);
    assert.equal((await request('login','POST',{code:'fixture-code-for-tests'},{origin:'https://evil.example'})).code,403);
    assert.equal((await request('login','POST',{code:'wrong'})).code,401);
    const login=await request('login','POST',{code:'fixture-code-for-tests'});
    assert.equal(login.code,200);assert.match(login.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);
    assert.match(login.headers['Cache-Control'],/no-store/);
    const cookie=login.headers['Set-Cookie'].split(';')[0];
    assert.equal((await request('session','GET',null,{cookie})).code,200);
    const logout=await request('logout','POST',{}, {cookie});assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
    for(let i=0;i<5;i++)await request('login','POST',{code:'wrong'},{'x-real-ip':'rate-test'});
    assert.equal((await request('login','POST',{code:'wrong'},{'x-real-ip':'rate-test'})).code,429);
  } finally {
    if(prevHash===undefined)delete process.env.TRADE_LAB_CODE_HASH;else process.env.TRADE_LAB_CODE_HASH=prevHash;
    if(prevSecret===undefined)delete process.env.TRADE_LAB_SESSION_SECRET;else process.env.TRADE_LAB_SESSION_SECRET=prevSecret;
  }
});
test('live adapter maps league scoring samples including zero without duplicate ownership',async()=>{
  const original=global.fetch;
  global.fetch=async url=>({ok:true,json:async()=>{
    if(url.endsWith('/players/nfl'))return {r:{full_name:'Runner',fantasy_positions:['RB'],team:'BUF'}};
    if(url.endsWith('/rosters'))return [{roster_id:1,owner_id:'owner',players:['r']}];
    if(url.endsWith('/users'))return [{user_id:'owner',metadata:{team_name:'Brrr’s House of Ice'}}];
    if(url.includes('/matchups/'))return [{players_points:{r:0}},{players_points:{r:99}}];
    return {sport:'nfl',season:'2026',total_rosters:12,roster_positions:['RB','SUPER_FLEX','BN'],settings:{last_scored_leg:2,reserve_slots:2},scoring_settings:{rec:1}};
  }});
  try {const data=await require('../lib/trade-data.cjs').load();assert.equal(data.players.r.samples,2);assert.equal(data.players.r.value,0);assert.equal(data.rosters[0].name,'Brrr’s House of Ice');assert.deepEqual(data.league.slots,['RB','SUPER_FLEX']);}
  finally {global.fetch=original;}
});
