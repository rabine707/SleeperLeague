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
  function lineup(row){
    const starters=row?.starters||[], all=row?.players||[], positions=slotNames();
    const start=starters.map((id,i)=>({id,slot:positions[i]||'START',starter:true}));
    const used=new Set(starters.map(String));
    const bench=all.filter(id=>!used.has(String(id))).map(id=>({id,slot:'BN',starter:false}));
    return {start,bench};
  }
  function playerRow(item,row,players){
    const p=players[item.id]||{}, pts=points(row,item.id);
    return '<div class="md-player"><span class="md-slot">'+esc(item.slot)+'</span><div class="md-player-copy"><strong>'+esc(playerName(p,item.id))+'</strong><small>'+esc(playerMeta(p))+'</small></div><b class="md-points">'+pts.toFixed(2)+'</b></div>';
  }
  function teamPanel(row,players){
    const m=wManagerId(row.roster_id), l=lineup(row);
    return '<section class="md-team"><header><div><small>'+esc(m.handle)+'</small><h3>'+esc(m.team)+'</h3></div><strong>'+Number(row.points||0).toFixed(2)+'</strong></header><div class="md-lineup">'+l.start.map(x=>playerRow(x,row,players)).join('')+'</div>'+(l.bench.length?'<details class="md-bench"><summary>BENCH <span>'+l.bench.length+' PLAYERS</span></summary>'+l.bench.map(x=>playerRow(x,row,players)).join('')+'</details>':'')+'</section>';
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
    const players=await loadPlayers();
    body.innerHTML='<div class="md-grid">'+group.teams.slice(0,2).map(r=>teamPanel(r,players)).join('<div class="md-vs">VS</div>')+'</div>';
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