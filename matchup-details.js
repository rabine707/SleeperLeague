// Clickable Sleeper matchup detail overlay.
// Uses the player-level points already returned on each Sleeper matchup row.
(function(){
  const state={players:null,loading:null};
  const slotNames=()=>weeklyHQ?.league?.roster_positions||[];
  async function loadPlayers(){
    if(state.players)return state.players;
    if(!state.loading)state.loading=api('/players/nfl').then(x=>state.players=x||{}).catch(()=>state.players={});
    return state.loading;
  }
  function points(row,id){return Number(row?.players_points?.[id]??0)}
  function playerName(p,id){return p?.full_name||[p?.first_name,p?.last_name].filter(Boolean).join(' ')||('Player '+id)}
  function playerMeta(p){return [p?.position,p?.team].filter(Boolean).join(' · ')||'NFL'}
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
  function slotLabel(slot){
    return slot==='SUPER_FLEX'?'SUPER<br>FLEX':esc(slot);
  }
  function playerRow(item,row,players,mvp){
    const p=players[item.id]||{}, pts=points(row,item.id), isMvp=String(item.id)===String(mvp)&&pts>0;
    const cls=['md-player',pts===0?'md-zero':'',pts>=25?'md-hot':'',isMvp?'md-mvp':''].filter(Boolean).join(' ');
    return '<div class="'+cls+'"><span class="md-slot">'+slotLabel(item.slot)+'</span><img class="md-player-img" src="'+playerImg(item.id)+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'"><div class="md-player-copy"><strong>'+esc(playerName(p,item.id))+(isMvp?'<em class="md-mvp-badge">MVP</em>':'')+'</strong><small>'+esc(playerMeta(p))+'</small></div><b class="md-points">'+pts.toFixed(2)+'</b></div>';
  }
  function teamPanel(row,players,leading){
    const m=wManagerId(row.roster_id), l=lineup(row), mvp=mvpId(row);
    return '<section class="md-team '+(leading?'md-leading':'')+'"><header><div><small>'+esc(m.handle)+'</small><h3>'+esc(m.team)+'</h3></div><div class="md-team-score">'+(leading?'<span>LEADING</span>':'')+'<strong>'+Number(row.points||0).toFixed(2)+'</strong></div></header><div class="md-lineup">'+l.start.map(x=>playerRow(x,row,players,mvp)).join('')+'</div>'+(l.bench.length?'<details class="md-bench"><summary>BENCH <span>'+l.bench.length+' PLAYERS</span></summary>'+l.bench.map(x=>playerRow(x,row,players,null)).join('')+'</details>':'')+'</section>';
  }
  function matchupState(a,b){
    const ap=Number(a?.points||0),bp=Number(b?.points||0),diff=Math.abs(ap-bp),current=wWeek(weeklyHQ.nfl?.week||1);
    const status=weeklyHQ.selected<current?'FINAL':weeklyHQ.selected===current&&(ap||bp)?'LIVE':'UPCOMING';
    let label=status;
    if(ap||bp){
      if(diff>=100)label='CRIME SCENE';
      else if(diff>=60)label='BODY BAG';
      else if(diff>=35)label='GETTING UGLY';
      else if(diff<=5)label='PHOTO FINISH';
    }
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
    const close=()=>{modal.hidden=true;document.body.classList.remove('md-open')};
    modal.querySelector('.md-close').addEventListener('click',close);
    modal.querySelector('.md-backdrop').addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close()});
  }
  async function openMatchup(id){
    ensureModal();
    const modal=document.querySelector('#matchupDetailModal'), body=document.querySelector('#mdBody');
    modal.hidden=false;document.body.classList.add('md-open');
    document.querySelector('#mdKicker').textContent='WEEK '+weeklyHQ.selected+' // GAME '+id;
    body.innerHTML='<div class="md-loading">Loading lineups…</div>';
    const rows=weeklyHQ.weeks.get(weeklyHQ.selected)||[], group=wGroups(rows).find(g=>String(g.id)===String(id));
    if(!group||group.teams.length<2){body.innerHTML='<div class="md-loading">Matchup data is not available yet.</div>';return}
    const players=await loadPlayers(),a=group.teams[0],b=group.teams[1],ap=Number(a.points||0),bp=Number(b.points||0);
    body.innerHTML=scoreHero(a,b)+'<div class="md-grid">'+teamPanel(a,players,ap>bp)+'<div class="md-vs">VS</div>'+teamPanel(b,players,bp>ap)+'</div>';
  }
  function wireCards(){
    document.querySelectorAll('#weeklyMatchups .matchup-card').forEach(card=>{
      if(card.dataset.mdReady)return;
      const id=card.querySelector('.matchup-top span')?.textContent?.replace(/^GAME\s+/,'');
      if(!id)return;
      card.dataset.mdReady='1';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','Open matchup '+id+' player scores');
      card.insertAdjacentHTML('beforeend','<div class="md-open-hint">VIEW LINEUPS →</div>');
      card.addEventListener('click',()=>openMatchup(id));
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openMatchup(id)}});
    });
  }
  const obs=new MutationObserver(wireCards);
  function init(){ensureModal();wireCards();const root=document.querySelector('#weeklyMatchups');if(root)obs.observe(root,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();