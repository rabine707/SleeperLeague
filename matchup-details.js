// Clickable Sleeper matchup detail overlay.
// Uses the player-level points already returned on each Sleeper matchup row.
(function(){
  const state={players:null,loading:null,week:1,request:0,opener:null,id:null};
  const slotNames=()=>weeklyHQ?.league?.roster_positions||[];
  async function loadPlayers(){
    if(state.players)return state.players;
    if(!state.loading)state.loading=api('/players/nfl').then(x=>state.players=x||{}).catch(()=>{state.loading=null;return {}});
    return state.loading;
  }
  function points(row,id){return Number(row?.players_points?.[id]??0)}
  function playerName(p,id){return p?.full_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||('Player '+id)}
  function playerMeta(p){return [p?.position,p?.team,seasonPlayerMeta(p,state.week),p?.injury_status].filter(Boolean).join(' · ')}
  function playerImg(id){return 'https://sleepercdn.com/content/nfl/players/'+encodeURIComponent(id)+'.jpg'}
  function lineup(row){
    const starters=row?.starters||[], all=row?.players||[], positions=slotNames();
    const start=starters.map((id,i)=>({id,slot:positions[i]||'START',starter:true}));
    const used=new Set(starters.map(String));
    const bench=all.filter(id=>!used.has(String(id))).map(id=>({id,slot:'BN',starter:false}));
    return {start,bench};
  }
  function mvpId(row){
    const starters=row?.starters||[];
    if(!starters.length)return null;
    return starters.reduce((best,id)=>points(row,id)>points(row,best)?id:best,starters[0]);
  }
  function lvpId(row,mvp){
    const scored=(row?.starters||[]).filter(id=>points(row,id)>0&&String(id)!==String(mvp));
    if(!scored.length)return null;
    return scored.reduce((worst,id)=>points(row,id)<points(row,worst)?id:worst,scored[0]);
  }
  function slotLabel(slot){return slot==='SUPER_FLEX'?'SUPER<br>FLEX':esc(slot)}
  function playerRow(item,row,players,mvp,lvp){
    const p=players[item.id]||{}, pts=points(row,item.id), isMvp=String(item.id)===String(mvp)&&pts>0, isLvp=String(item.id)===String(lvp)&&pts>0;
    const cls=['md-player',pts===0?'md-zero':'',pts>=25?'md-hot':'',isMvp?'md-mvp':'',isLvp?'md-lvp':''].filter(Boolean).join(' ');
    return '<div class="'+cls+'"><span class="md-slot">'+slotLabel(item.slot)+'</span><img class="md-player-img" src="'+playerImg(item.id)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"><div class="md-player-copy"><strong>'+esc(playerName(p,item.id))+(isMvp?'<em class="md-mvp-badge">MVP</em>':'')+(isLvp?'<em class="md-lvp-badge">LVP</em>':'')+'</strong><small>'+esc(playerMeta(p))+'</small></div><b class="md-points">'+pts.toFixed(2)+'</b></div>';
  }
  function managerIdentity(m,side){
    return '<div class="md-manager '+side+'"><img src="'+esc(m.avatar)+'" alt="" onerror="this.style.visibility=\'hidden\'"><div><strong>'+esc(m.handle)+'</strong><small>'+esc(m.team)+'</small></div></div>';
  }
  function teamPanel(row,players,leading){
    const m=wManagerId(row.roster_id), l=lineup(row), mvp=mvpId(row), lvp=lvpId(row,mvp);
    return '<section class="md-team '+(leading?'md-leading':'')+'"><header>'+managerIdentity(m,'panel')+'<div class="md-team-score">'+(leading?'<span>LEADING</span>':'')+'<strong>'+Number(row.points||0).toFixed(2)+'</strong></div></header><div class="md-lineup">'+l.start.map(x=>playerRow(x,row,players,mvp,lvp)).join('')+'</div>'+(l.bench.length?'<details class="md-bench"><summary>BENCH <span>'+l.bench.length+' PLAYERS</span></summary>'+l.bench.map(x=>playerRow(x,row,players,null,null)).join('')+'</details>':'')+'</section>';
  }
  function mobilePlayer(item,row,players,mvp,lvp,side){
    const p=players[item.id]||{},pts=points(row,item.id),isMvp=String(item.id)===String(mvp)&&pts>0,isLvp=String(item.id)===String(lvp)&&pts>0;
    const cls=['md-h2h-player',side,isMvp?'md-mvp':'',isLvp?'md-lvp':'',pts===0?'md-zero':''].filter(Boolean).join(' ');
    const badge=isMvp?'<em class="md-mvp-badge">MVP</em>':isLvp?'<em class="md-lvp-badge">LVP</em>':'';
    return '<div class="'+cls+'"><img src="'+playerImg(item.id)+'" alt="" onerror="this.style.visibility=\'hidden\'"><div class="md-h2h-copy"><strong>'+esc(playerName(p,item.id))+badge+'</strong><small>'+esc(playerMeta(p))+'</small></div><b>'+pts.toFixed(2)+'</b></div>';
  }
  function mobileHeadToHead(a,b,players){
    const am=wManagerId(a.roster_id),bm=wManagerId(b.roster_id),al=lineup(a),bl=lineup(b),amvp=mvpId(a),bmvp=mvpId(b),alvp=lvpId(a,amvp),blvp=lvpId(b,bmvp),len=Math.max(al.start.length,bl.start.length);
    let rows='';
    for(let i=0;i<len;i++){
      const ai=al.start[i],bi=bl.start[i],slot=ai?.slot||bi?.slot||'START';
      rows+='<div class="md-h2h-row">'+(ai?mobilePlayer(ai,a,players,amvp,alvp,'left'):'<div></div>')+'<span class="md-h2h-slot">'+slotLabel(slot)+'</span>'+(bi?mobilePlayer(bi,b,players,bmvp,blvp,'right'):'<div></div>')+'</div>';
    }
    return '<div class="md-mobile-h2h"><div class="md-mobile-managers">'+managerIdentity(am,'left')+'<span class="md-manager-vs">VS</span>'+managerIdentity(bm,'right')+'</div><div class="md-mobile-totals"><strong>'+Number(a.points||0).toFixed(2)+'</strong><span>MATCHUP</span><strong>'+Number(b.points||0).toFixed(2)+'</strong></div><div class="md-h2h-list">'+rows+'</div></div>';
  }
  function matchupState(a,b){
    const ap=Number(a?.points||0),bp=Number(b?.points||0),diff=Math.abs(ap-bp),current=season.current;
    const status=seasonMode(state.week);
    let label=status==='PREP'?'SET YOUR LINEUP':status;
    if(ap||bp){if(diff>=100)label='CRIME SCENE';else if(diff>=60)label='BODY BAG';else if(diff>=35)label='GETTING UGLY';else if(diff<=5)label='PHOTO FINISH'}
    return {ap,bp,diff,status,label};
  }
  function scoreHero(a,b){
    const x=matchupState(a,b),am=wManagerId(a.roster_id),bm=wManagerId(b.roster_id);
    return '<div class="md-score-hero"><div class="md-score-side '+(x.ap>x.bp?'ahead':'')+'"><small>'+esc(am.team)+'</small><strong>'+x.ap.toFixed(2)+'</strong></div><div class="md-score-center"><span class="md-status '+x.status.toLowerCase()+'">'+x.status+'</span><b>'+x.label+'</b><small>Δ '+x.diff.toFixed(2)+' PTS</small></div><div class="md-score-side right '+(x.bp>x.ap?'ahead':'')+'"><small>'+esc(bm.team)+'</small><strong>'+x.bp.toFixed(2)+'</strong></div></div>';
  }
  function ensureModal(){
    if(document.querySelector('#matchupDetailModal'))return;
    document.body.insertAdjacentHTML('beforeend','<div class="md-modal" id="matchupDetailModal" hidden><button class="md-backdrop" aria-label="Close matchup"></button><div class="md-dialog" role="dialog" aria-modal="true" aria-labelledby="mdTitle"><div class="md-head"><div><small id="mdKicker">MATCHUP</small><h2 id="mdTitle">GAME DETAILS</h2></div><button class="md-close" type="button" aria-label="Close">×</button></div><div class="md-body" id="mdBody"></div></div></div>');
    const modal=document.querySelector('#matchupDetailModal');
    const close=()=>{state.request++;modal.hidden=true;document.body.classList.remove('md-open');state.opener?.focus()};
    modal.querySelector('.md-close').addEventListener('click',close);modal.querySelector('.md-backdrop').addEventListener('click',close);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close();if(e.key==='Tab'&&!modal.hidden){const nodes=[...modal.querySelectorAll('.md-dialog button,.md-dialog summary')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  }
  async function openMatchup(id,week=weeklyHQ.selected){
    state.week=Number(week);state.id=id;const request=++state.request;
    state.opener=document.activeElement;ensureModal();const modal=document.querySelector('#matchupDetailModal'),body=document.querySelector('#mdBody');modal.hidden=false;document.body.classList.add('md-open');modal.querySelector('.md-close').focus();document.querySelector('#mdKicker').textContent='WEEK '+state.week+' LINEUP // GAME '+id;body.innerHTML='<div class="md-loading">Loading lineups…</div>';
    const rows=await wLoadWeek(state.week,false),group=wGroups(rows).find(g=>String(g.id)===String(id));if(!group||group.teams.length<2){body.innerHTML='<div class="md-loading">Matchup data is not available yet.</div>';return}
    await seasonSchedule(state.week);const players=await loadPlayers();if(request!==state.request||modal.hidden)return;const a=group.teams[0],b=group.teams[1],ap=Number(a.points||0),bp=Number(b.points||0);
    body.classList.toggle('md-prep',seasonMode(state.week)==='PREP');
    body.innerHTML='<p class="md-lineup-note">Week '+state.week+' lineup · '+(seasonMode(state.week)==='PREP'?'Scores have not started. Projections unavailable from the connected feed.':'Actual Sleeper points; stat corrections may apply.')+'</p>'+scoreHero(a,b)+'<div class="md-desktop-matchup"><div class="md-grid">'+teamPanel(a,players,ap>bp)+'<div class="md-vs">VS</div>'+teamPanel(b,players,bp>ap)+'</div></div>'+mobileHeadToHead(a,b,players);
  }
  function wireCards(){document.querySelectorAll('#weeklyMatchups .matchup-card').forEach(card=>{if(card.dataset.mdReady)return;const id=card.querySelector('.matchup-top span')?.textContent?.replace(/^GAME\s+/,'');if(!id)return;card.dataset.mdReady='1';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Open matchup '+id+' player scores');card.insertAdjacentHTML('beforeend','<div class="md-open-hint">VIEW LINEUPS →</div>');card.addEventListener('click',()=>openMatchup(id));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMatchup(id)}})})}
  document.addEventListener('click',e=>{const card=e.target.closest('[data-matchup]');if(card)openMatchup(card.dataset.matchup,Number(card.dataset.week)).catch(()=>{document.querySelector('#mdBody').textContent='Could not load this matchup. Close and try again.'})});
  document.addEventListener('keydown',e=>{const card=e.target.closest('[data-matchup]');if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();card.click()}});
  const obs=new MutationObserver(wireCards);function init(){ensureModal();wireCards();const root=document.querySelector('#weeklyMatchups');if(root)obs.observe(root,{childList:true,subtree:true})}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();