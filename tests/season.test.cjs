const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({Intl,Date,Map,Set});vm.runInContext(fs.readFileSync('season.js','utf8'),context);
const clock=(date,events=[])=>context.seasonClock({season:'2026',season_type:'regular'},{season:'2026'},events,new Date(date));
test('Tuesday Eastern rolls to Week 2 PREP',()=>{assert.equal(clock('2026-09-15T04:00:00Z').current,2);assert.equal(clock('2026-09-15T04:00:00Z').mode,'PREP')});
test('Monday stays Week 1 until Tuesday in Eastern time',()=>assert.equal(clock('2026-09-15T03:59:59Z').current,1));
test('Thursday kickoff switches PREP to LIVE without scored points',()=>{let games=[{date:'2026-09-18T00:15Z',status:{type:{completed:false}}}];assert.equal(clock('2026-09-18T00:14Z',games).mode,'PREP');assert.equal(clock('2026-09-18T00:15Z',games).mode,'LIVE')});
test('last final switches to FINAL before Tuesday and completes week',()=>{const x=clock('2026-09-22T03:30Z',[{date:'2026-09-22T00:15Z',status:{type:{completed:true}}}]);assert.equal(x.current,2);assert.equal(x.completed,2);assert.equal(x.mode,'FINAL')});
test('Tuesday rolls to Week 3',()=>{assert.equal(clock('2026-09-22T04:00Z').current,3);assert.equal(clock('2026-09-22T04:00Z').mode,'PREP')});
test('season end caps Week 18',()=>{assert.equal(clock('2027-02-15T12:00Z').current,18);assert.equal(clock('2027-02-15T12:00Z').mode,'FINAL')});
test('standings include zero, negative scores and ties but not bye wins',()=>{const h=[[{roster_id:1,matchup_id:1,points:0},{roster_id:2,matchup_id:1,points:-1}],[{roster_id:1,matchup_id:1,points:2},{roster_id:2,matchup_id:1,points:2}],[{roster_id:1,matchup_id:null,points:5}]];assert.equal(JSON.stringify(context.seasonRecord(1,h)),JSON.stringify({w:1,l:0,t:1,pf:7,pa:1}))});
test('record rate accounts for ties and unequal games',()=>{assert.ok(context.recordRate({w:2,l:0,t:0})>context.recordRate({w:3,l:2,t:0}));assert.equal(context.recordRate({w:1,l:1,t:2}),.5)});
test('ranking movement compares roster identity',()=>{assert.equal(context.rankMovement([{r:{roster_id:2}},{r:{roster_id:1}}],1,0),'▲1');assert.equal(context.rankMovement([],1,0),'NEW')});

test('power snapshots ignore newer roster settings',()=>{
  const c=vm.createContext({Intl,Date,Map,Set,console,$:()=>null,document:{addEventListener(){}}});
  vm.runInContext(fs.readFileSync('season.js','utf8')+fs.readFileSync('app-weekly.js','utf8'),c);
  vm.runInContext("weeklyHQ.rosters=[{roster_id:1,settings:{wins:99}},{roster_id:2,settings:{wins:0}}];weeklyHQ.users=[];",c);
  c.managers=[];const result=c.wPower([[{roster_id:1,matchup_id:1,points:1},{roster_id:2,matchup_id:1,points:2}]]);
  assert.equal(result[0].r.roster_id,2);assert.equal(result[1].x.w,0);
});
test('commissioner overrides include an explicit zero',async()=>{
  const c=vm.createContext({Intl,Date,Map,Set,console,$:()=>null,document:{addEventListener(){}},CONFIG:{leagueId:'test'},api:async()=>[{roster_id:1,points:99,custom_points:0}]});
  vm.runInContext(fs.readFileSync('season.js','utf8')+fs.readFileSync('app-weekly.js','utf8'),c);
  assert.equal((await c.wLoadWeek(1,false))[0].points,0);
});
