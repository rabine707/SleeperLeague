// Shared season clock. Eastern time defines the Tuesday fantasy-week rollover.
const season={current:1,completed:0,mode:'PREP',schedules:new Map(),scheduleErrors:new Set()};
function easternParts(now=new Date()){
  return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
}
function seasonClock(nfl,league,events=[],now=new Date()){
  const year=Number(league?.season||nfl?.season||now.getFullYear()),p=easternParts(now);
  // NFL regular season starts the Thursday following Labor Day. Anchor weeks on Tuesday.
  const sept=new Date(Date.UTC(year,8,1)),labor=1+(8-sept.getUTCDay())%7;
  const anchor=Date.UTC(year,8,labor+1),today=Date.UTC(+p.year,+p.month-1,+p.day);
  const week=Math.min(18,Math.max(1,Math.floor((today-anchor)/604800000)+1));
  let mode=['Tue','Wed'].includes(p.weekday)?'PREP':'LIVE';
  if(today<anchor)mode='PREP';
  if(events.length){
    if(events.every(e=>e.status?.type?.completed))mode='FINAL';
    else if(events.every(e=>Date.parse(e.date)>now.getTime()))mode='PREP';
    else mode='LIVE';
  }else if(nfl?.season_type==='off'||Number(nfl?.season)>year||today>=anchor+18*604800000)mode='FINAL';
  return {current:week,mode,completed:mode==='FINAL'?week:week-1};
}
async function seasonSchedule(week,force=false){
  if(season.schedules.has(week)&&!force)return season.schedules.get(week);
  try{
    const year=weeklyHQ.league?.season||weeklyHQ.nfl?.season;
    const data=await fetchJSON('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates='+encodeURIComponent(year)+'&seasontype=2&week='+week+'&limit=100');
    const events=data.events||[];
    if(!events.length||events.some(e=>Number(e.week?.number)!==Number(week)))throw new Error('Schedule pending');
    season.schedules.set(week,events);season.scheduleErrors.delete(week);return events;
  }catch{season.scheduleErrors.add(week);return season.schedules.get(week)||[];}
}
async function seasonSync(nfl,league,force){
  const clock=seasonClock(nfl,league);
  const events=await seasonSchedule(clock.current,force);
  Object.assign(season,seasonClock(nfl,league,events));
}
function seasonMode(week){return week<season.current?'FINAL':week>season.current?'PREP':season.mode;}
function recordRate(x){const n=x.w+x.l+x.t;return n?(x.w+x.t*.5)/n:0;}
function recordText(x){return x.w+'-'+x.l+(x.t?'-'+x.t:'');}
function seasonRecord(id,history){
  const x={w:0,l:0,t:0,pf:0,pa:0};
  for(const rows of history){
    const row=rows.find(r=>Number(r.roster_id)===Number(id));if(!row)continue;
    x.pf+=Number(row.points||0);
    const other=rows.find(r=>r.matchup_id!=null&&r.matchup_id===row.matchup_id&&Number(r.roster_id)!==Number(id));
    if(!other)continue;
    const a=Number(row.points||0),b=Number(other.points||0);x.pa+=b;
    if(a>b)x.w++;else if(a<b)x.l++;else x.t++;
  }
  return x;
}
function rankMovement(previous,id,index){const before=previous.findIndex(z=>Number(z.r.roster_id)===Number(id));if(before<0)return 'NEW';const diff=before-index;return diff>0?'▲'+diff:diff<0?'▼'+Math.abs(diff):'—';}
function seasonPlayerMeta(player,week){
  const events=season.schedules.get(week)||[],team=player?.team;
  const alias={WSH:'WAS',JAC:'JAX'};const norm=t=>alias[t]||t;
  const event=events.find(e=>e.competitions?.[0]?.competitors?.some(c=>norm(c.team?.abbreviation)===norm(team)));
  if(!event)return events.length?'No scheduled game / bye':'Opponent & kickoff unavailable';
  const sides=event.competitions[0].competitors,own=sides.find(c=>norm(c.team?.abbreviation)===norm(team)),other=sides.find(c=>c!==own);
  return (own.homeAway==='home'?'vs ':'@ ')+(other?.team?.abbreviation||'?')+' · '+new Date(event.date).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
}
async function seasonRender(rows,history,power){
  const week=weeklyHQ.selected,mode=seasonMode(week);
  await seasonSchedule(week);
  document.querySelectorAll('.manager-card').forEach(card=>{const manager=managers.find(m=>m.slot===Number(card.dataset.focusSlot)),r=weeklyHQ.rosters.find(r=>r.owner_id===manager?.user_id);let badge=card.querySelector('.season-record');if(!badge){badge=document.createElement('span');badge.className='badge season-record';card.querySelector('.manager-badges').appendChild(badge)}badge.textContent=r?wRecText(r):'Record pending'});
  $('#weeklyMatchups').closest('section').querySelector('h2').textContent='Week '+week+' Matchups';
  $('#weeklyNavLabel').textContent='Week '+week;
  $('#homeWeekEyebrow').textContent=weeklyHQ.league.season+' // WEEK '+week+' HQ // '+mode;
  $('#homeWeekKicker').closest('section').querySelector('h2').textContent='Week '+week+' Matchups';
  $('#homeWeekKicker').textContent='THE SLATE // WEEK '+week+' // '+mode;
  $('[data-page="weekly"] h1').textContent='WEEK '+week+' HQ · '+mode;
  if(!$('#homeWeekSelect')){
    $('.hero-actions').insertAdjacentHTML('beforebegin','<div class="season-picker"><label for="homeWeekSelect">WEEK / HISTORY</label><select id="homeWeekSelect"></select><button class="text-btn" id="seasonToday">Current week ↗</button></div>');
    $('#homeWeekSelect').addEventListener('change',e=>{weeklyHQ.selected=wWeek(e.target.value);renderWeeklyHQ()});
    $('#seasonToday').addEventListener('click',()=>{weeklyHQ.selected=season.current;renderWeeklyHQ()});
  }
  $('#homeWeekSelect').innerHTML=$('#weeklyWeek').innerHTML;
  $('#homeMatchups').innerHTML=wGroups(rows).map(g=>'<article class="home-game" role="button" tabindex="0" data-matchup="'+esc(g.id)+'" data-week="'+week+'" aria-label="Open Week '+week+' matchup '+esc(g.id)+'"><div class="home-game-top"><span>MATCHUP '+esc(g.id)+'</span><b>'+mode+'</b></div>'+homeTeam(g.teams[0])+'<div class="home-vs"></div>'+homeTeam(g.teams[1])+'<div class="md-open-hint">WEEK '+week+' LINEUPS →</div></article>').join('')||'<div class="weekly-empty">Sleeper has not posted Week '+week+' matchups yet.</div>';
  const recapWeek=mode==='FINAL'?week:Math.min(week-1,season.completed),recap=recapWeek?await wLoadWeek(recapWeek,false):[];
  if(recapWeek){wAwards(recap,power,recapWeek);$('#weeklyAwards').closest('section').querySelector('h2').textContent='Week '+recapWeek+' Receipts';}else $('#weeklyAwards').closest('section').querySelector('h2').textContent='Receipts pending';
  const valid=recap.filter(r=>r.points!=null),high=[...valid].sort((a,b)=>b.points-a.points)[0];
  $('#homePulseHeadline').textContent=mode==='PREP'?(recapWeek?'WEEK '+recapWeek+': FINAL → WEEK '+week+': LOADING…':'EVERYBODY IS UNDEFEATED. FOR NOW.'):homeHeadline(rows,week);
  $('#homePulseCopy').textContent=high?wManagerId(high.roster_id).team+' won the Week '+recapWeek+' scoring belt with '+Number(high.points).toFixed(2)+' points. The group chat has evidence.':'Waiting for completed results. No imaginary receipts.';
  $('#homePulseFooter').textContent=season.scheduleErrors.has(week)?'SCHEDULE UNAVAILABLE · Calendar mode; final whistle unverified':'SLEEPER SCORES · NFL GAME STATE VIA ESPN';
  $('#homePowerStat').textContent=history.length?'#1':'—';$('#homePowerCopy').textContent=history.length?power[0]?.m.team:'Power board starts after the first completed week.';
  $('#homePressureStat').textContent=history.length?'#'+power.length:'—';$('#homePressureCopy').textContent=history.length?power.at(-1)?.m.team:'Nobody has earned the panic button yet.';
  if(!$('#seasonRecap'))$('#homePulse').insertAdjacentHTML('afterend','<section class="weekly-section"><h2 id="seasonRecapTitle"></h2><div class="weekly-awards" id="seasonRecap"></div></section>');
  $('#seasonRecapTitle').textContent=recapWeek?'Week '+recapWeek+' Recap / Receipts':'Receipts pending';
  if(valid.length){
    const sorted=[...valid].sort((a,b)=>b.points-a.points),low=sorted.at(-1),pairs=wGroups(valid).filter(g=>g.teams.length===2).map(g=>({g,d:Math.abs(g.teams[0].points-g.teams[1].points)})).sort((a,b)=>b.d-a.d);
    const receipt=(title,row,joke)=>wAward('WEEK '+recapWeek+' · FINAL',title,wManagerId(row.roster_id).team,Number(row.points).toFixed(2)+' points. '+joke);
    $('#seasonRecap').innerHTML=receipt('HIGH SCORE',high,'The group chat now requires a cover charge.')+receipt('LOW SCORE',low,'The lineup has requested witness protection.')+pairs.filter((_,i)=>i===0||i===pairs.length-1).map((x,i)=>wAward('WEEK '+recapWeek+' · FINAL',i?'CLOSEST GAME':'BIGGEST BLOWOUT',x.d.toFixed(2)+' PTS',x.g.teams.map(r=>wManagerId(r.roster_id).team).join(' vs '))).join('');
  }else $('#seasonRecap').innerHTML='<div class="weekly-empty">Completed results are not available yet.</div>';
  if(!$('#fantasyAlert'))$('#homeMatchups').closest('section').insertAdjacentHTML('beforebegin','<aside class="fantasy-alert" id="fantasyAlert" aria-live="polite"></aside>');
  const biggest=wGroups(rows).filter(g=>g.teams.length===2).sort((a,b)=>Math.abs(b.teams[0].points-b.teams[1].points)-Math.abs(a.teams[0].points-a.teams[1].points))[0];
  const margin=biggest?Math.abs(biggest.teams[0].points-biggest.teams[1].points):0;
  $('#fantasyAlert').innerHTML='<small>'+ (mode==='LIVE'?'LIVE FANTASY ALERT':mode==='FINAL'?'FINAL FANTASY RECEIPTS':'WEEK '+week+' PREP ALERT')+'</small><h2>'+(mode==='PREP'?'EVERY ROSTER IS A CONTENDER. UNTIL THURSDAY.':margin>=35?'SOMEBODY CALL THE GROUP CHAT CORONER.':mode==='FINAL'?'THE SCORES ARE IN. THE EXCUSES ARE LOADING.':'THE GROUP CHAT HAS ENTERED CARDIAC MODE.')+'</h2><p>'+esc(mode==='PREP'?'Set your lineup. Check kickoff times. Prepare an alibi.':homeHeadline(rows,week))+'</p>';
  const ticker=[['WEEK '+week,mode],['LINEUPS','Open a matchup for opponents & kickoff times'],['RECEIPTS',recapWeek?'Week '+recapWeek+' results':'Awaiting first final'],['POWER',history.length?'Through Week '+wCompleted():'Preseason tie']];
  $('#ticker').innerHTML=[...ticker,...ticker].map(([a,b])=>'<span class="ticker-item"><b>'+esc(a)+'</b>'+esc(b)+'</span>').join('');
}
