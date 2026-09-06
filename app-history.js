async function loadHistory(force=false){
  const cached=!force && localStorage.getItem('bjff-history-v1');
  if(cached){ try{ historyCache=JSON.parse(cached); renderHistory(historyCache); return historyCache; }catch{} }
  $('#historyLoading').classList.remove('hidden');
  try{
    const seasons=[]; let leagueId=CONFIG.leagueId; let guard=0;
    while(leagueId && leagueId!=='0' && guard<12){
      guard++;
      const league=await api(`/league/${leagueId}`);
      const [users,rosters,drafts]=await Promise.all([
        api(`/league/${leagueId}/users`).catch(()=>[]), api(`/league/${leagueId}/rosters`).catch(()=>[]), api(`/league/${leagueId}/drafts`).catch(()=>[])
      ]);
      seasons.push({league,users,rosters,drafts});
      leagueId=league.previous_league_id;
    }
    historyCache={generated:Date.now(),seasons};
    localStorage.setItem('bjff-history-v1',JSON.stringify(historyCache));
    renderHistory(historyCache);
    return historyCache;
  }catch(err){
    $('#historyContent').innerHTML=`<div class="empty-state"><div class="empty-icon">!</div><h3>History pull failed.</h3><p>${esc(err.message)}. Try again from a normal browser tab with internet access.</p></div>`;
    throw err;
  }finally{$('#historyLoading').classList.add('hidden');}
}

function seasonUserMap(season){ return Object.fromEntries((season.users||[]).map(u=>[String(u.user_id),u])); }
function rosterOwner(season,rosterId){ return (season.rosters||[]).find(r=>Number(r.roster_id)===Number(rosterId))?.owner_id; }
function rosterPts(r){ return Number(r?.settings?.fpts||0) + Number(r?.settings?.fpts_decimal||0)/100; }

function renderHistory(data){
  const seasons=data.seasons||[];
  const completed=seasons.filter(s=>s.league?.status==='complete' || (s.rosters||[]).some(r=>(r.settings?.wins||0)+(r.settings?.losses||0)>0));
  const agg={}; let highSeason=null;
  for(const s of completed){
    const users=seasonUserMap(s);
    for(const r of s.rosters||[]){
      const id=String(r.owner_id||''); if(!id) continue;
      agg[id] ||= {id,name:users[id]?.display_name||managerById(id)?.display_name||id,w:0,l:0,t:0,pts:0,seasons:0};
      agg[id].w += Number(r.settings?.wins||0); agg[id].l += Number(r.settings?.losses||0); agg[id].t += Number(r.settings?.ties||0); agg[id].pts += rosterPts(r); agg[id].seasons++;
      if(!highSeason || rosterPts(r)>highSeason.pts) highSeason={pts:rosterPts(r),id,year:s.league.season};
    }
  }
  const all=Object.values(agg).sort((a,b)=>b.w-a.w || b.pts-a.pts);
  const winsLeader=all[0];
  const oldest=completed.at(-1)?.league?.season || '—';
  const cards=completed.map(s=>{
    const users=seasonUserMap(s), rosters=s.rosters||[];
    const champRoster=s.league?.metadata?.latest_league_winner_roster_id;
    const champId=champRoster?rosterOwner(s,champRoster):null;
    const champ=users[String(champId)]?.metadata?.team_name || users[String(champId)]?.display_name || managerById(champId)?.team || 'Unknown';
    const pointsLeader=[...rosters].sort((a,b)=>rosterPts(b)-rosterPts(a))[0];
    const plId=pointsLeader?.owner_id; const pl=users[String(plId)]?.metadata?.team_name || users[String(plId)]?.display_name || managerById(plId)?.team || '—';
    const recordLeader=[...rosters].sort((a,b)=>(b.settings?.wins||0)-(a.settings?.wins||0) || rosterPts(b)-rosterPts(a))[0];
    const rlId=recordLeader?.owner_id; const rl=users[String(rlId)]?.metadata?.team_name || users[String(rlId)]?.display_name || managerById(rlId)?.team || '—';
    return `<article class="season-card"><div class="micro">SEASON FILE</div><div class="year">${esc(s.league.season)}</div><div class="season-meta"><div class="season-row"><span>Champion</span><b>${esc(champ)}</b></div><div class="season-row"><span>Best record</span><b>${esc(rl)} · ${recordLeader?.settings?.wins||0}-${recordLeader?.settings?.losses||0}</b></div><div class="season-row"><span>Points king</span><b>${esc(pl)} · ${fmt(rosterPts(pointsLeader))}</b></div><div class="season-row"><span>Drafts found</span><b>${s.drafts?.length||0}</b></div></div></article>`;
  }).join('');
  const table=all.map((a,i)=>{ const m=managerById(a.id); return `<tr><td>${i+1}</td><td><div class="table-manager"><img src="${esc(m?.avatar||'https://sleepercdn.com/images/v2/icons/player_default.webp')}" alt="">${esc(m?.team||a.name)}</div></td><td>${a.w}</td><td>${a.l}</td><td>${a.seasons}</td><td>${fmt(a.pts)}</td></tr>`; }).join('');
  $('#historyContent').innerHTML=`
    <div class="history-summary"><div class="history-stat"><small>SEASONS FOUND</small><strong>${completed.length}</strong></div><div class="history-stat"><small>HISTORY STARTS</small><strong>${oldest}</strong></div><div class="history-stat"><small>ALL-TIME WIN LEADER</small><strong>${esc(managerById(winsLeader?.id)?.team||winsLeader?.name||'—')}</strong></div><div class="history-stat"><small>BEST SEASON POINTS</small><strong>${fmt(highSeason?.pts||0)}</strong></div></div>
    <div class="section-head"><div><div class="kicker">SEASON VAULT</div><h2>Receipts</h2></div></div><div class="season-grid">${cards||'<div class="empty-state span-all">No completed seasons returned.</div>'}</div>
    <div class="section-head"><div><div class="kicker">ALL TIME</div><h2>Manager Records</h2></div></div>
    <table class="alltime-table"><thead><tr><th>#</th><th>Manager</th><th>W</th><th>L</th><th>Seasons</th><th>Points</th></tr></thead><tbody>${table}</tbody></table>`;
}
$('#loadHistory').addEventListener('click',()=>loadHistory(true));

async function analyzeScouting(){
  $('#scoutGrid').innerHTML='<div class="history-loading span-all"><div class="spinner"></div><span>Studying old draft crimes…</span></div>';
  try{
    const hist=historyCache || await loadHistory(false);
    const profiles={};
    for(const m of managers) profiles[m.user_id]={...m,drafts:0,picks:0,positions:{QB:0,RB:0,WR:0,TE:0,OTHER:0},early:{QB:0,RB:0,WR:0,TE:0},qb1Rounds:[],te1Rounds:[]};
    for(const s of hist.seasons||[]){
      for(const d of s.drafts||[]){
        if(d.status!=='complete') continue;
        const [detail,picks]=await Promise.all([api(`/draft/${d.draft_id}`).catch(()=>d),api(`/draft/${d.draft_id}/picks`).catch(()=>[])]);
        const participants=new Set(); const firstByUser={};
        const slotToUser={};
        Object.entries(detail.draft_order||{}).forEach(([uid,slot])=>slotToUser[Number(slot)]=uid);
        for(const p of picks){
          const uid=String(p.picked_by || slotToUser[Number(p.draft_slot)] || '');
          if(!uid || !profiles[uid]) continue;
          participants.add(uid); const prof=profiles[uid]; prof.picks++;
          const pos=(p.metadata?.position||'OTHER').toUpperCase(); const bucket=['QB','RB','WR','TE'].includes(pos)?pos:'OTHER'; prof.positions[bucket]++;
          if(Number(p.round)<=5 && ['QB','RB','WR','TE'].includes(bucket)) prof.early[bucket]++;
          firstByUser[uid] ||= {};
          if(firstByUser[uid][bucket]==null) firstByUser[uid][bucket]=Number(p.round);
        }
        participants.forEach(uid=>{profiles[uid].drafts++; const f=firstByUser[uid]||{}; if(f.QB) profiles[uid].qb1Rounds.push(f.QB); if(f.TE) profiles[uid].te1Rounds.push(f.TE);});
      }
    }
    renderScouting(Object.values(profiles));
  }catch(err){ $('#scoutGrid').innerHTML=`<div class="empty-state span-all"><div class="empty-icon">!</div><h3>Scouting failed.</h3><p>${esc(err.message)}</p></div>`; }
}

function avg(a){ return a.length ? a.reduce((x,y)=>x+y,0)/a.length : null; }
function tagsFor(p){
  const d=Math.max(p.drafts,1), q=avg(p.qb1Rounds), t=avg(p.te1Rounds); const tags=[];
  if(q && q<=2.5) tags.push('QB HUNTER'); else if(q && q>=5.5) tags.push('LATE QB');
  if(p.early.WR/d>=2) tags.push('WR HOARDER'); if(p.early.RB/d>=2) tags.push('RB HEAVY');
  if(t && t<=5) tags.push('EARLY TE'); if(p.positions.QB/d>=3) tags.push('QB DEPTH');
  if(!tags.length) tags.push('BALANCED CHAOS'); return tags.slice(0,3);
}
function renderScouting(profiles){
  const bySlot=[...profiles].sort((a,b)=>a.slot-b.slot);
  const withHistory=bySlot.filter(p=>p.drafts>0);
  const reads=[];
  const earliest=[...withHistory].filter(p=>avg(p.qb1Rounds)!=null).sort((a,b)=>avg(a.qb1Rounds)-avg(b.qb1Rounds))[0];
  const latest=[...withHistory].filter(p=>avg(p.qb1Rounds)!=null).sort((a,b)=>avg(b.qb1Rounds)-avg(a.qb1Rounds))[0];
  const volume=[...withHistory].sort((a,b)=>b.picks-a.picks)[0];
  for(const p of [earliest,latest,volume]) if(p && !reads.some(x=>x.user_id===p.user_id)) reads.push(p);
  $('#turnSpotlight').innerHTML=reads.map((p,i)=>`<div class="spot-card"><img src="${esc(p.avatar)}" alt=""><div><small>${i===0?'EARLY QB READ':i===1?'PATIENT QB READ':'HISTORY DEPTH'} · SLOT ${p.slot}</small><strong>${esc(p.team)}</strong><span style="color:var(--muted);font-size:10px">${tagsFor(p)[0]}</span></div></div>`).join('');
  $('#scoutGrid').innerHTML=bySlot.map(p=>{
    const total=Math.max(1,Object.values(p.positions).reduce((a,b)=>a+b,0)); const q=avg(p.qb1Rounds), t=avg(p.te1Rounds);
    const bars=Object.entries(p.positions).filter(([,v])=>v>0).map(([k,v])=>`<span class="${k}" style="width:${(v/total)*100}%" title="${k} ${v}"></span>`).join('');
    return `<article class="scout-card"><div class="scout-head"><img src="${esc(p.avatar)}" alt=""><div><h3>${esc(p.team)}</h3><p>#${p.slot} · @${esc(p.display_name)} · ${p.drafts} drafts analyzed</p></div></div><div class="tendency-tags">${tagsFor(p).map((t,i)=>`<span class="tendency ${i%2?'alt':''}">${esc(t)}</span>`).join('')}</div><div class="scout-metrics"><div class="metric"><small>AVG QB1 RD</small><strong>${q?q.toFixed(1):'—'}</strong></div><div class="metric"><small>AVG TE1 RD</small><strong>${t?t.toFixed(1):'—'}</strong></div><div class="metric"><small>PAST PICKS</small><strong>${p.picks}</strong></div></div><div class="pos-bar">${bars}</div></article>`;
  }).join('');
}
$('#loadScouting').addEventListener('click',analyzeScouting);
