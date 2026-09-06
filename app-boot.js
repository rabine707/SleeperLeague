$('#teamFocus')?.addEventListener('change',e=>setFocusSlot(e.target.value));
document.addEventListener('click',e=>{
  const target=e.target.closest('[data-focus-slot]');
  if(!target) return;
  const slot=Number(target.dataset.focusSlot);
  if(!slot) return;
  const jump=Boolean(target.closest('.manager-card,.order-card'));
  setFocusSlot(slot,jump);
});
$('#orderPrev')?.addEventListener('click',()=>$('#draftOrderRail')?.scrollBy({left:-520,behavior:'smooth'}));
$('#orderNext')?.addEventListener('click',()=>$('#draftOrderRail')?.scrollBy({left:520,behavior:'smooth'}));

function homeSeasonStyles(){
  if($('#homeSeasonStyles')) return;
  const s=document.createElement('style');s.id='homeSeasonStyles';s.textContent=`
  .home-week{margin:10px 0 28px}.home-week-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}.home-week-head h2{font-size:clamp(28px,4vw,44px);margin:4px 0 0;letter-spacing:-.04em}.home-week-head button{white-space:nowrap}.home-matchups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.home-game{border:1px solid var(--line);border-radius:20px;background:linear-gradient(150deg,rgba(255,255,255,.05),rgba(255,255,255,.018));padding:16px;min-width:0}.home-game.featured{border-color:rgba(200,255,46,.38);box-shadow:inset 0 0 35px rgba(200,255,46,.035)}.home-game-top{display:flex;justify-content:space-between;gap:8px;font-size:9px;font-weight:950;letter-spacing:.12em;color:var(--muted);margin-bottom:12px}.home-game-top b{color:var(--lime)}.home-team{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;padding:7px 0}.home-team img{width:34px;height:34px;border-radius:10px;object-fit:cover;background:#1d202b}.home-team strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.home-team span{font-size:10px;color:var(--muted);display:block;margin-top:2px}.home-team em{font-style:normal;font-size:19px;font-weight:1000}.home-vs{height:1px;background:var(--line);margin:2px 0}.home-pulse-grid{display:grid;grid-template-columns:1.35fr .8fr .8fr;gap:12px;margin:18px 0 30px}.home-pulse{border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.025);padding:20px;min-height:155px}.home-pulse h3{font-size:clamp(19px,2vw,28px);margin:14px 0 7px;letter-spacing:-.035em}.home-pulse p{color:var(--muted);font-size:12px;line-height:1.5;margin:0}.home-move{font-size:42px;font-weight:1000;letter-spacing:-.06em;margin:12px 0 3px}.home-move small{font-size:11px;color:var(--muted);letter-spacing:0}.home-loading{color:var(--muted);font-size:12px;padding:22px;border:1px solid var(--line);border-radius:18px}.nav button[data-route="draft"]{opacity:.68;font-size:11px}.nav button[data-route="draft"]:hover,.nav button[data-route="draft"].active{opacity:1}
  @media(max-width:900px){.home-matchups{grid-template-columns:repeat(2,minmax(0,1fr))}.home-pulse-grid{grid-template-columns:1fr 1fr}.home-pulse:first-child{grid-column:1/-1}}
  @media(max-width:600px){.home-week-head{align-items:flex-start}.home-matchups{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:7px}.home-game{min-width:82vw;scroll-snap-align:start}.home-pulse-grid{grid-template-columns:1fr}.home-pulse:first-child{grid-column:auto}.nav{overflow-x:auto;scrollbar-width:none}.nav::-webkit-scrollbar{display:none}}
  `;document.head.appendChild(s);
}
function homeTeam(row){
  const r=wRoster(row?.roster_id),m=wManager(r);return `<div class="home-team"><img src="${esc(m.avatar)}" alt=""><div><strong>${esc(m.team)}</strong><span>${esc(wRecText(r))}</span></div><em>${Number(row?.points||0).toFixed(1)}</em></div>`;
}
function homeHeadline(rows,current){
  const scored=(rows||[]).filter(r=>Number(r.points||0)>0),groups=wGroups(rows).filter(g=>g.teams.length>1);
  if(!scored.length) return `Week ${current} is loaded. Everybody still believes their roster is good.`;
  const high=[...scored].sort((a,b)=>Number(b.points)-Number(a.points))[0];
  const margins=groups.map(g=>({g,d:Math.abs(Number(g.teams[0]?.points||0)-Number(g.teams[1]?.points||0))})).sort((a,b)=>a.d-b.d);
  const close=margins[0];
  if(close&&close.d<8){const [a,b]=close.g.teams;return `${wManagerId(a.roster_id).team} vs ${wManagerId(b.roster_id).team} is the group-chat heart rate game: ${close.d.toFixed(1)} points apart.`}
  return `${wManagerId(high.roster_id).team} is currently holding the Week ${current} high-score belt at ${Number(high.points||0).toFixed(1)}.`;
}
async function renderHomeSeason(){
  const hero=$('#leagueHome');if(!hero||typeof wBasics!=='function')return;
  homeSeasonStyles();
  let section=$('#homeWeek');if(!section){section=document.createElement('section');section.id='homeWeek';section.className='home-week';hero.insertAdjacentElement('afterend',section)}
  section.innerHTML='<div class="home-loading">Syncing this week from Sleeper…</div>';
  try{
    await wBasics(false);const current=wWeek(weeklyHQ.nfl?.week||1),rows=await wLoadWeek(current,false),groups=wGroups(rows),history=await wHistory(),power=wPower(history);
    document.querySelectorAll('.nav button[data-route="weekly"]').forEach(b=>b.textContent='Week '+current);
    const scored=(rows||[]).some(r=>Number(r.points||0)>0),final=current<wWeek(weeklyHQ.nfl?.week||1),state=final?'FINAL':scored?'LIVE':'UPCOMING';
    let featured=-1,best=Infinity;groups.forEach((g,i)=>{if(g.teams.length<2)return;const d=Math.abs(Number(g.teams[0].points||0)-Number(g.teams[1].points||0));if(scored&&d<best){best=d;featured=i}});if(featured<0)featured=0;
    section.innerHTML=`<div class="home-week-head"><div><div class="kicker">THE SLATE // WEEK ${current}</div><h2>This Week</h2></div><button class="text-btn" data-route="weekly">Full Week ${current} HQ →</button></div><div class="home-matchups">${groups.map((g,i)=>`<article class="home-game ${i===featured?'featured':''}"><div class="home-game-top"><span>${i===featured?'★ GAME OF THE WEEK':'MATCHUP '+g.id}</span><b>${state}</b></div>${homeTeam(g.teams[0])}<div class="home-vs"></div>${homeTeam(g.teams[1])}</article>`).join('')}</div>`;
    let pulse=$('#homePulse');if(!pulse){pulse=document.createElement('div');pulse.id='homePulse';pulse.className='home-pulse-grid';section.insertAdjacentElement('afterend',pulse)}
    const n=wCompleted(),top=power[0],bottom=power.at(-1);pulse.innerHTML=`<article class="home-pulse"><div class="micro">LEAGUE PULSE</div><h3>${esc(homeHeadline(rows,current))}</h3><p>Built from the live Sleeper scoreboard. The receipts update with the week.</p></article><article class="home-pulse"><div class="micro">POWER WATCH</div><div class="home-move">${n?'#1':'—'}</div><h3>${esc(n&&top?top.m.team:'After Week 1')}</h3><p>${n?'Current power-board leader.':'Power movement activates after games are in the books.'}</p></article><article class="home-pulse"><div class="micro">PRESSURE CHECK</div><div class="home-move">${n?'#12':'0-0'}</div><h3>${esc(n&&bottom?bottom.m.team:'Clean slate')}</h3><p>${n?'Somebody has to live down here.':'Nobody has earned a roast yet.'}</p></article>`;
  }catch(e){section.innerHTML='<div class="home-loading">Sleeper did not answer. League HQ can still be opened manually.</div>'}
}

async function boot(){
  renderManagers(); renderOrder(); buildTicker(); populateFocusSelect(); renderDraftBoard(); updateCountdown(); renderChampion();
  try{ await refreshDraft(); }catch{}
  $('#turnSpotlight').innerHTML=`<div class="spot-card"><div><small>SHARED INTEL</small><strong>All 12 managers</strong><span style="color:var(--muted);font-size:10px">Nobody gets a private scouting view.</span></div></div><div class="spot-card"><div><small>PAST DRAFTS</small><strong>Behavior, not identity</strong><span style="color:var(--muted);font-size:10px">Tendencies come from completed Sleeper drafts.</span></div></div><div class="spot-card"><div><small>LIVE FOCUS</small><strong>Any team, anytime</strong><span style="color:var(--muted);font-size:10px">Focus changes presentation only.</span></div></div>`;
  renderHomeSeason();
}
boot();