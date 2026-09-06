// Universal Weekly League HQ
const weeklyHQ={loaded:false,loading:false,selected:null,nfl:null,league:null,rosters:[],users:[],weeks:new Map()};

function wWeek(v){return Math.min(18,Math.max(1,Number(v||1)))}
function wPts(s,k){return Number(s?.[k]||0)+Number(s?.[k+"_decimal"]||0)/100}
function wRec(r){const s=r?.settings||{};return{w:Number(s.wins||0),l:Number(s.losses||0),t:Number(s.ties||0),pf:wPts(s,"fpts"),pa:wPts(s,"fpts_against")}}
function wRecText(r){const x=wRec(r);return x.t?x.w+"-"+x.l+"-"+x.t:x.w+"-"+x.l}
function wRoster(id){return weeklyHQ.rosters.find(r=>Number(r.roster_id)===Number(id))}
function wManager(r){
  const u=weeklyHQ.users.find(x=>String(x.user_id)===String(r?.owner_id));
  const seed=managers.find(x=>String(x.user_id)===String(r?.owner_id));
  return{
    team:u?.metadata?.team_name||seed?.team||u?.display_name||("Roster "+(r?.roster_id||"?")),
    handle:u?.display_name||seed?.display_name||"Sleeper",
    avatar:u?avatarForUser(u):(seed?.avatar||"https://sleepercdn.com/images/v2/icons/player_default.webp")
  };
}
function wManagerId(id){return wManager(wRoster(id))}
function wGroups(rows){
  const map=new Map();
  (rows||[]).forEach(r=>{const id=r.matchup_id??("solo-"+r.roster_id);if(!map.has(id))map.set(id,[]);map.get(id).push(r)});
  return [...map.entries()].map(([id,teams])=>({id,teams})).sort((a,b)=>Number(a.id)-Number(b.id));
}
function wStandings(){
  return weeklyHQ.rosters.map(r=>({r,m:wManager(r),x:wRec(r)})).sort((a,b)=>b.x.w-a.x.w||b.x.t-a.x.t||b.x.pf-a.x.pf||a.m.team.localeCompare(b.m.team));
}
function wLoading(text){
  const el=$("#weeklyLoading");if(!el)return;
  el.classList.remove("hidden");el.innerHTML='<div class="spinner"></div><span>'+esc(text)+'</span>';
}
function wHide(){ $("#weeklyLoading")?.classList.add("hidden") }

async function wBasics(force){
  if(weeklyHQ.loaded&&!force)return;
  if(force){weeklyHQ.loaded=false;weeklyHQ.weeks.clear()}
  const [nfl,league,rosters,users]=await Promise.all([
    api("/state/nfl"),api("/league/"+CONFIG.leagueId),api("/league/"+CONFIG.leagueId+"/rosters"),api("/league/"+CONFIG.leagueId+"/users")
  ]);
  weeklyHQ.nfl=nfl;weeklyHQ.league=league;weeklyHQ.rosters=rosters||[];weeklyHQ.users=users||[];weeklyHQ.loaded=true;
  if(weeklyHQ.selected==null)weeklyHQ.selected=wWeek(nfl?.week||1);
}
async function wLoadWeek(week,force){
  week=wWeek(week);
  if(weeklyHQ.weeks.has(week)&&!force)return weeklyHQ.weeks.get(week);
  const rows=await api("/league/"+CONFIG.leagueId+"/matchups/"+week);
  weeklyHQ.weeks.set(week,rows||[]);return rows||[];
}
function wCompleted(){return Math.max(0,wWeek(weeklyHQ.nfl?.week||1)-1)}
async function wHistory(){
  const n=wCompleted();if(!n)return[];
  await Promise.all(Array.from({length:n},(_,i)=>wLoadWeek(i+1,false)));
  return Array.from({length:n},(_,i)=>weeklyHQ.weeks.get(i+1)||[]);
}

function wPower(history){
  const ids=weeklyHQ.rosters.map(r=>Number(r.roster_id)), expected=new Map(ids.map(id=>[id,0]));
  const maps=history.map(rows=>new Map(rows.map(r=>[Number(r.roster_id),Number(r.points||0)])));
  maps.forEach(scores=>ids.forEach(id=>{
    let win=0,tie=0,opp=0,score=Number(scores.get(id)||0);
    ids.forEach(other=>{if(other===id)return;opp++;const os=Number(scores.get(other)||0);if(score>os)win++;else if(score===os)tie++});
    expected.set(id,(expected.get(id)||0)+(opp?(win+.5*tie)/opp:0));
  }));
  const recent=maps.slice(-3), avgs=new Map(ids.map(id=>[id,recent.length?recent.reduce((s,m)=>s+Number(m.get(id)||0),0)/recent.length:0]));
  const vals=ids.map(id=>avgs.get(id)||0), lo=Math.min(...vals,0), hi=Math.max(...vals,0);
  return weeklyHQ.rosters.map(r=>{
    const id=Number(r.roster_id),x=wRec(r),games=x.w+x.l+x.t,winPct=games?(x.w+.5*x.t)/games:.5;
    const all=maps.length?(expected.get(id)||0)/maps.length:.5;
    const recentPct=recent.length&&hi>lo?((avgs.get(id)||0)-lo)/(hi-lo):.5;
    const power=maps.length?(winPct*.5+all*.3+recentPct*.2)*100:50;
    return{r,m:wManager(r),x,power,all,luck:x.w-(expected.get(id)||0)};
  }).sort((a,b)=>b.power-a.power||b.x.pf-a.x.pf||a.m.team.localeCompare(b.m.team));
}

function wControls(){
  const s=$("#weeklyWeek");if(!s)return;
  const current=wWeek(weeklyHQ.nfl?.week||1);
  s.innerHTML=Array.from({length:18},(_,i)=>{const n=i+1;return'<option value="'+n+'" '+(n===weeklyHQ.selected?"selected":"")+'>Week '+n+(n===current?" · CURRENT":"")+'</option>'}).join("");
  $("#weeklyPrev")?.toggleAttribute("disabled",weeklyHQ.selected<=1);
  $("#weeklyNext")?.toggleAttribute("disabled",weeklyHQ.selected>=18);
}
function wKpis(rows){
  const current=wWeek(weeklyHQ.nfl?.week||1), standings=wStandings(), leader=standings[0], groups=wGroups(rows);
  const spots=Number(weeklyHQ.league?.settings?.playoff_teams||6), scored=(rows||[]).filter(r=>Number(r.points||0)>0).length;
  $("#weeklyKpis").innerHTML=[
    ["WEEK",weeklyHQ.selected,weeklyHQ.selected<current?"FINAL":weeklyHQ.selected===current?"CURRENT":"FUTURE"],
    ["MATCHUPS",groups.length||6,"LEAGUE-WIDE"],
    ["LEAGUE LEADER",leader?.m?.team||"TIED",leader?wRecText(leader.r):"0-0"],
    ["PLAYOFF LINE",spots,"SPOTS"],
    ["SCOREBOARD",weeklyHQ.selected===current&&scored?"LIVE":weeklyHQ.selected<current?"FINAL":"READY",scored?(scored+"/12 scoring"):"Sleeper sync"]
  ].map(a=>'<article class="weekly-kpi"><small>'+esc(a[0])+'</small><strong class="'+(a[0]==="LEAGUE LEADER"?"kpi-team":"")+'">'+esc(a[1])+'</strong><span>'+esc(a[2])+'</span></article>').join("");
}
function wTeam(row){
  const r=wRoster(row.roster_id),m=wManager(r);
  return'<div class="matchup-team"><img src="'+esc(m.avatar)+'" alt=""><div class="matchup-team-copy"><strong>'+esc(m.team)+'</strong><span>@'+esc(m.handle)+' · '+esc(wRecText(r))+'</span></div><div class="matchup-score">'+Number(row.points||0).toFixed(2)+'</div></div>';
}
function wMatchups(rows){
  const current=wWeek(weeklyHQ.nfl?.week||1),final=weeklyHQ.selected<current,groups=wGroups(rows),el=$("#weeklyMatchups");
  if(!groups.length){el.innerHTML='<div class="weekly-empty"><strong>No matchup data yet.</strong><span>Sleeper has not posted this week’s slate.</span></div>';return}
  el.innerHTML=groups.map(g=>{
    const a=g.teams[0],b=g.teams[1],ap=Number(a?.points||0),bp=Number(b?.points||0),diff=Math.abs(ap-bp),state=final?"FINAL":(ap||bp)?"LIVE":"UPCOMING";
    return'<article class="matchup-card '+state.toLowerCase()+'"><div class="matchup-top"><span>GAME '+esc(g.id)+'</span><b>'+state+'</b></div>'+wTeam(a)+'<div class="matchup-vs"><span>VS</span><i></i><em>'+((ap||bp)?("Δ "+diff.toFixed(2)):"—")+'</em></div>'+wTeam(b)+'</article>';
  }).join("");
}
function wAward(k,t,v,c,kind){
  return'<article class="weekly-award '+(kind||"")+'"><small>'+esc(k)+'</small><strong>'+esc(t)+'</strong><div class="award-value">'+esc(v)+'</div><p>'+esc(c)+'</p></article>';
}
function wAwards(rows,power){
  const current=wWeek(weeklyHQ.nfl?.week||1),final=weeklyHQ.selected<current,groups=wGroups(rows).filter(g=>g.teams.length>1),scored=(rows||[]).filter(r=>Number(r.points||0)>0);
  if(!scored.length){
    $("#weeklyAwards").innerHTML=[
      wAward("CLEAN SLATE","NO RECEIPTS YET","0.00","Everybody can still pretend the draft went perfectly."),
      wAward("THIS WEEK",(groups.length||6)+" MATCHUPS","12 TEAMS","Every matchup gets the same spotlight."),
      wAward("POWER BOARD","ONE FORMULA","ALL 12","Record + all-play + recent scoring. Same math for everybody.")
    ].join("");return;
  }
  const sorted=[...scored].sort((a,b)=>Number(b.points)-Number(a.points)),high=sorted[0],low=sorted.at(-1);
  const margins=groups.map(g=>{const[a,b]=g.teams;return{a,b,d:Math.abs(Number(a.points||0)-Number(b.points||0))}}).sort((a,b)=>b.d-a.d);
  const blow=margins[0],close=[...margins].sort((a,b)=>a.d-b.d)[0],luck=[...power].sort((a,b)=>b.luck-a.luck)[0],bad=[...power].sort((a,b)=>a.luck-b.luck)[0],label=final?"WEEKLY RECEIPT":"LIVE PULSE";
  $("#weeklyAwards").innerHTML=[
    wAward(label,"HIGH SCORE",wManagerId(high.roster_id).team,Number(high.points||0).toFixed(2)+" points. "+(final?"Put the league on notice.":"Currently holding the belt."),"good"),
    wAward(label,"LOW SCORE",wManagerId(low.roster_id).team,Number(low.points||0).toFixed(2)+" points. "+(final?"The lineup technically submitted a score.":"There is still time to escape."),"danger"),
    wAward(label,"BIGGEST MARGIN",blow?blow.d.toFixed(2)+" PTS":"—",blow?wManagerId(blow.a.roster_id).team+" vs "+wManagerId(blow.b.roster_id).team+". This got out of hand.":"Waiting."),
    wAward(label,"NAIL BITER",close?close.d.toFixed(2)+" PTS":"—",close?wManagerId(close.a.roster_id).team+" vs "+wManagerId(close.b.roster_id).team+". Group-chat heart rate game.":"Waiting."),
    wAward("SEASON LUCK","GETTING AWAY WITH IT",luck?.m?.team||"—",wCompleted()?(luck.luck>=0?"+":"")+luck.luck.toFixed(2)+" wins vs all-play expectation.":"Activates after Week 1.","gold"),
    wAward("SEASON LUCK","RECORD FILED A COMPLAINT",bad?.m?.team||"—",wCompleted()?(bad.luck>=0?"+":"")+bad.luck.toFixed(2)+" wins vs all-play expectation.":"Activates after Week 1.","purple")
  ].join("");
}
function wPowerBoard(power){
  const n=wCompleted();
  $("#weeklyPower").innerHTML=power.map((z,i)=>{
    const luck=(z.luck>=0?"+":"")+z.luck.toFixed(2);
    return'<article class="power-row"><div class="power-rank">'+(i+1)+'</div><img src="'+esc(z.m.avatar)+'" alt=""><div class="power-team"><strong>'+esc(z.m.team)+'</strong><span>'+wRecText(z.r)+' · '+z.x.pf.toFixed(1)+' PF</span></div><div class="power-metric"><small>INDEX</small><strong>'+(n?z.power.toFixed(0):"—")+'</strong></div><div class="power-metric"><small>ALL-PLAY</small><strong>'+(n?(z.all*100).toFixed(0)+"%":"—")+'</strong></div><div class="power-metric luck '+(z.luck>.35?"lucky":z.luck<-.35?"unlucky":"")+'"><small>LUCK</small><strong>'+(n?luck:"—")+'</strong></div></article>';
  }).join("");
  $("#powerFormulaNote").textContent=n?("Through Week "+n+": 50% record · 30% all-play · 20% recent scoring."):"Preseason tie. Power rankings activate after Week 1.";
}
function wTable(){
  const rows=wStandings(),spots=Number(weeklyHQ.league?.settings?.playoff_teams||6);
  $("#weeklyStandings").innerHTML='<div class="weekly-table-wrap"><table class="weekly-table"><thead><tr><th>#</th><th>Team</th><th>Record</th><th>PF</th><th>PA</th><th>Race</th></tr></thead><tbody>'+
    rows.map((z,i)=>'<tr class="'+(i<spots?"playoff-in":i===spots?"playoff-bubble":"")+'"><td><b>'+(i+1)+'</b></td><td><div class="stand-team"><img src="'+esc(z.m.avatar)+'" alt=""><span><strong>'+esc(z.m.team)+'</strong><small>@'+esc(z.m.handle)+'</small></span></div></td><td>'+wRecText(z.r)+'</td><td>'+z.x.pf.toFixed(2)+'</td><td>'+z.x.pa.toFixed(2)+'</td><td><span class="race-tag '+(i<spots?"in":i===spots?"bubble":"out")+'">'+(i<spots?"IN":i===spots?"BUBBLE":"CHASE")+'</span></td></tr>').join("")+
    '</tbody></table></div>';
}
function wPlayoff(){
  const rows=wStandings(),spots=Number(weeklyHQ.league?.settings?.playoff_teams||6),inside=rows.slice(0,spots),bubble=rows.slice(spots,spots+3);
  const team=(z,i)=>'<div class="playoff-team"><span>'+i+'</span><img src="'+esc(z.m.avatar)+'" alt=""><strong>'+esc(z.m.team)+'</strong><em>'+wRecText(z.r)+'</em></div>';
  $("#weeklyPlayoff").innerHTML='<div class="playoff-column"><div class="playoff-column-title">CURRENTLY IN</div>'+inside.map((z,i)=>team(z,i+1)).join("")+'</div><div class="playoff-column bubble-column"><div class="playoff-column-title">CHASING THE LINE</div>'+bubble.map((z,i)=>team(z,spots+i+1)).join("")+'<div class="playoff-note">Display tiebreak: wins → ties → points for. Sleeper remains the source of truth.</div></div>';
}

async function renderWeeklyHQ(force=false){
  if(weeklyHQ.loading)return;weeklyHQ.loading=true;wLoading(force?"Refreshing every league board…":"Syncing all 12 teams from Sleeper…");
  try{
    await wBasics(force);wControls();
    const [rows,history]=await Promise.all([wLoadWeek(weeklyHQ.selected,force),wHistory()]);
    const power=wPower(history);wKpis(rows);wMatchups(rows);wAwards(rows,power);wPowerBoard(power);wTable();wPlayoff();
    $("#weeklyUpdated").textContent="Updated "+new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+" · Sleeper public API";wHide();
  }catch(e){
    console.error("Weekly HQ",e);["#weeklyMatchups","#weeklyAwards","#weeklyPower","#weeklyStandings","#weeklyPlayoff"].forEach(s=>{const el=$(s);if(el)el.innerHTML='<div class="weekly-empty"><strong>Couldn’t load Sleeper.</strong><span>'+esc(e.message||"Try refresh.")+'</span></div>'});wHide();
  }finally{weeklyHQ.loading=false}
}
function wMove(d){weeklyHQ.selected=wWeek((weeklyHQ.selected||wWeek(weeklyHQ.nfl?.week||1))+d);wControls();renderWeeklyHQ()}
$("#weeklyPrev")?.addEventListener("click",()=>wMove(-1));
$("#weeklyNext")?.addEventListener("click",()=>wMove(1));
$("#weeklyWeek")?.addEventListener("change",e=>{weeklyHQ.selected=wWeek(e.target.value);renderWeeklyHQ()});
$("#weeklyRefresh")?.addEventListener("click",()=>renderWeeklyHQ(true));
document.addEventListener("click",e=>{if(e.target.closest('[data-route="weekly"]'))setTimeout(()=>renderWeeklyHQ(),0)});
