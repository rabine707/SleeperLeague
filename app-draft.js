function makePickOrder(rounds=CONFIG.rounds, teams=CONFIG.teams){
  const out=[];
  for(let r=1;r<=rounds;r++){
    const slots=Array.from({length:teams},(_,i)=>i+1);
    if(r%2===0) slots.reverse();
    for(const s of slots) out.push({round:r,slot:s,overall:out.length+1});
  }
  return out;
}
const fullOrder=makePickOrder();
function roundPickNumber(seq){ return seq ? ((Number(seq.overall)-1)%CONFIG.teams)+1 : 0; }
function draftPickLabel(seq){ return seq ? `${seq.round}.${String(roundPickNumber(seq)).padStart(2,'0')}` : '—'; }

function pickForCell(round,slot){ return currentPicks.find(p=>Number(p.round)===round && Number(p.draft_slot)===slot); }
function playerName(p){ return p?.metadata?.first_name ? `${p.metadata.first_name} ${p.metadata.last_name||''}`.trim() : (p?.metadata?.player_name || p?.player_id || 'Unknown'); }
function pickPos(p){ return (p?.metadata?.position || '').toUpperCase(); }

function renderDraftBoard(){
  const ordered=[...managers].sort((a,b)=>a.slot-b.slot);
  const heads = ordered.map(m=>`
    <div class="board-cell header ${m.slot===focusSlot?'focus-col':''}" data-focus-slot="${m.slot}">
      <div class="board-team"><img src="${esc(m.avatar)}" alt=""><div>${esc(m.team)}<small>${m.slot}. @${esc(m.display_name)}</small></div></div>
    </div>`).join('');
  let cells=`<div class="board-cell header round">RD</div>${heads}`;
  const nextOverall=currentPicks.length+1;
  for(let r=1;r<=CONFIG.rounds;r++){
    cells+=`<div class="board-cell round">R${r}</div>`;
    for(let slot=1;slot<=CONFIG.teams;slot++){
      const p=pickForCell(r,slot);
      const seq=fullOrder.find(x=>x.round===r&&x.slot===slot);
      const isClock=seq?.overall===nextOverall && currentDraft?.status!=='complete';
      cells+=`<div class="board-cell ${slot===focusSlot?'focus-col':''} ${isClock?'on-clock':''}" data-focus-slot="${slot}">
        ${p?`<div class="pick-card ${posClass(pickPos(p))}"><div class="pick-no">${draftPickLabel(seq)} · #${p.pick_no||seq.overall}</div><div class="player">${esc(playerName(p))}</div><div class="meta">${esc(pickPos(p)||'—')} · ${esc(p.metadata?.team||'FA')}</div></div>`:`<span class="empty-pick">${draftPickLabel(seq)}</span>`}
      </div>`;
    }
  }
  $('#draftBoard').innerHTML=`<div class="board-grid">${cells}</div>`;
  $('#picksLogged').textContent=`${currentPicks.length} / ${CONFIG.rounds*CONFIG.teams} picks`;
  updateWarRoom();
}

function populateFocusSelect(){
  const select=$('#teamFocus');
  if(!select) return;
  const selected=String(focusSlot||'');
  select.innerHTML='<option value="">League View — all teams equal</option>'+[...managers].sort((a,b)=>a.slot-b.slot).map(m=>`<option value="${m.slot}">#${m.slot} · ${esc(m.team)} (@${esc(m.display_name)})</option>`).join('');
  select.value=selected;
}

function setFocusSlot(slot, jump=false){
  focusSlot=Number(slot)||0;
  populateFocusSelect();
  renderDraftBoard();
  if(jump) route('draft');
}

function updateWarRoom(){
  const made = new Set(currentPicks.map(p=>Number(p.pick_no)||fullOrder.find(x=>x.round===Number(p.round)&&x.slot===Number(p.draft_slot))?.overall));
  const nextOverall=currentPicks.length+1;
  const current=fullOrder.find(x=>x.overall===nextOverall);
  const focused=managers.find(m=>m.slot===focusSlot);

  if(!focusSlot){
    $('#boardFocusLabel').textContent='LEAGUE VIEW';
    $('#focusNote').textContent='Showing the next picks across the room. Choose any team only as a visual focus.';
    $('#trafficLabel').textContent='UP NEXT';
    $('#nextPickLabel').textContent=current?`CURRENT: ${draftPickLabel(current)} · #${current.overall}`:'DRAFT COMPLETE';
    const upcoming=fullOrder.filter(p=>p.overall>=nextOverall).slice(0,5);
    $('#pickSequence').innerHTML=upcoming.map((p,i)=>`<div class="seq-pick ${i===0?'current':''}"><span>${p.round}.${String(p.slot).padStart(2,'0')} · ${esc(managers.find(m=>m.slot===p.slot)?.team||`Slot ${p.slot}`)}</span><b>#${p.overall}</b></div>`).join('');
    $('#turnTraffic').innerHTML=upcoming.slice(0,4).map(p=>{const m=managers.find(x=>x.slot===p.slot);return m?`<div class="traffic-item"><img src="${esc(m.avatar)}" alt=""><span><b>#${p.overall} · ${esc(m.team)}</b><br>@${esc(m.display_name)}</span></div>`:''}).join('');
    $('#homeWarStat').textContent=current?`${draftPickLabel(current)}`:'DONE';
    $('#homeWarCopy').textContent=current?`${managers.find(m=>m.slot===current.slot)?.team||'The room'} is next on the shared board. Everyone sees the same live state.`:'The 2026 draft is complete. The shared board remains the league receipt.';
    return;
  }

  const teamPicks=fullOrder.filter(x=>x.slot===focusSlot);
  const next=teamPicks.find(p=>!made.has(p.overall));
  $('#boardFocusLabel').textContent=`FOCUS: #${focusSlot} ${focused?.team||''}`.trim();
  $('#focusNote').textContent=`Visual focus only — every manager can select any team and sees the exact same league data.`;
  $('#trafficLabel').textContent='BEFORE THIS TEAM PICKS';
  $('#nextPickLabel').textContent=next?`NEXT: ${draftPickLabel(next)} · #${next.overall}`:'TEAM DRAFT COMPLETE';
  const idx=teamPicks.findIndex(p=>p.overall===next?.overall);
  const seq=next?teamPicks.slice(Math.max(0,idx),Math.max(0,idx)+5):teamPicks.slice(-5);
  $('#pickSequence').innerHTML=seq.map((p,i)=>`<div class="seq-pick ${i===0&&next?'current':''}"><span>Round ${p.round}</span><b>#${p.overall}</b></div>`).join('');
  const traffic=next?fullOrder.filter(p=>p.overall>=nextOverall && p.overall<next.overall).slice(-6):[];
  $('#turnTraffic').innerHTML=traffic.length?traffic.map(p=>{const m=managers.find(x=>x.slot===p.slot);return m?`<div class="traffic-item"><img src="${esc(m.avatar)}" alt=""><span><b>#${p.overall} · ${esc(m.team)}</b><br>@${esc(m.display_name)}</span></div>`:''}).join(''):'<div class="traffic-empty">No remaining picks before this team.</div>';
}

async function refreshDraft(){
  $('#draftSyncDot').style.background='var(--gold)';
  try{
    const [draft,picks,users,league] = await Promise.all([
      api(`/draft/${CONFIG.draftId}`), api(`/draft/${CONFIG.draftId}/picks`), api(`/league/${CONFIG.leagueId}/users`), api(`/league/${CONFIG.leagueId}`)
    ]);
    currentDraft=draft; currentPicks=Array.isArray(picks)?picks:[]; currentLeague=league;
    mergeLiveUsers(users,draft);
    $('#apiStatus').className='live-pill online';
    $('#draftStatus').textContent=(draft.status||'unknown').replace('_',' ').toUpperCase();
    $('#draftSyncDot').style.background=draft.status==='drafting'?'var(--lime)':draft.status==='complete'?'var(--purple)':'var(--gold)';
    renderDraftBoard(); renderManagers(); renderOrder(); populateFocusSelect(); renderChampion();
    configurePolling();
  }catch(err){
    console.warn('Sleeper refresh failed; using seeded league data.',err);
    $('#apiStatus').className='live-pill offline';
    $('#apiStatus').innerHTML='<span></span> Seed mode';
    $('#draftStatus').textContent='SEED MODE';
    renderDraftBoard();
  }
}

function mergeLiveUsers(users,draft){
  if(!Array.isArray(users)) return;
  const order=draft?.draft_order||{};
  managers = users.map(u=>{
    const seed=seedManagers.find(m=>m.user_id===u.user_id);
    return {
      slot:Number(order[u.user_id] || seed?.slot || 99),
      user_id:u.user_id,
      display_name:u.display_name||seed?.display_name||'Unknown',
      team:teamNameForUser(u),
      avatar:avatarForUser(u)
    };
  }).filter(m=>m.slot<=CONFIG.teams).sort((a,b)=>a.slot-b.slot);
}

function configurePolling(){
  if(pollHandle) clearInterval(pollHandle);
  const ms=currentDraft?.status==='drafting'?4000:30000;
  pollHandle=setInterval(refreshDraft,ms);
}
$('#refreshDraft').addEventListener('click',refreshDraft);

function renderChampion(){
  const rosterId=Number(currentLeague?.metadata?.latest_league_winner_roster_id || 3);
  let champ=null;
  if(currentDraft?.slot_to_roster_id){
    const slot=Number(Object.keys(currentDraft.slot_to_roster_id).find(s=>Number(currentDraft.slot_to_roster_id[s])===rosterId));
    champ=managers.find(m=>m.slot===slot);
  }
  champ ||= managers.find(m=>m.slot===5);
  $('#championCard').innerHTML=`<div class="micro">DEFENDING CHAMPION</div><div class="feature-content"><img class="avatar-xl" src="${esc(champ.avatar)}" alt=""><div><h3>${esc(champ.team)}</h3><p>@${esc(champ.display_name)} · 2025 champion</p></div></div><div class="shine"></div>`;
}
