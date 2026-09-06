// Live draft extras: shared command bar, position-run detector, team snapshots, and TV mode.
let bigScreenActive = false;

function ensureLiveDraftExtras(){
  const draftPage = document.querySelector('[data-page="draft"]');
  if(!draftPage || document.querySelector('#liveCommandBar')) return;

  const hero = draftPage.querySelector('.page-hero');
  hero.insertAdjacentHTML('afterend', `
    <section class="live-command-bar" id="liveCommandBar" aria-label="Live draft command bar">
      <div class="command-primary">
        <span class="command-label">ON THE CLOCK</span>
        <img id="commandAvatar" class="command-avatar" alt="">
        <div class="command-team">
          <strong id="commandTeam">Waiting for Sleeper…</strong>
          <small id="commandPick">Pick 1.01 · #1</small>
        </div>
      </div>
      <div class="command-meta">
        <div><span>LAST PICK</span><strong id="commandLast">—</strong></div>
        <div><span>NEXT UP</span><strong id="commandNext">—</strong></div>
      </div>
      <div class="run-chip" id="commandRun">NO RUN YET</div>
      <button class="tv-mode-btn" id="bigScreenToggle" type="button">▣ BIG SCREEN</button>
    </section>

    <section class="draft-insights-grid">
      <article class="draft-insight run-insight">
        <div class="micro">POSITION RUN DETECTOR</div>
        <div class="run-headline" id="runHeadline">WAITING FOR PICKS</div>
        <div class="run-recent" id="runRecent"></div>
        <p id="runCopy">Once picks start, this will flag position streaks across the shared room.</p>
      </article>

      <article class="draft-insight team-snapshot">
        <div class="snapshot-head">
          <div>
            <div class="micro">TEAM DRAFT SUMMARY</div>
            <h3 id="snapshotTeam">ON-CLOCK TEAM</h3>
          </div>
          <span class="snapshot-slot" id="snapshotSlot">#1</span>
        </div>
        <div class="snapshot-counts" id="snapshotCounts"></div>
        <div class="snapshot-roster" id="snapshotRoster"></div>
        <div class="snapshot-footer" id="snapshotFooter">0 drafted · 18 picks remaining</div>
      </article>
    </section>
  `);

  document.querySelector('#bigScreenToggle')?.addEventListener('click', toggleBigScreen);
}

function sortedLivePicks(){
  return [...(currentPicks || [])].sort((a,b)=>
    Number(a.pick_no || 0) - Number(b.pick_no || 0) ||
    Number(a.round || 0) - Number(b.round || 0)
  );
}

function slotManager(slot){
  return managers.find(m=>Number(m.slot)===Number(slot));
}

function currentDraftOrderPick(){
  const nextOverall = (currentPicks?.length || 0) + 1;
  return fullOrder.find(p=>p.overall===nextOverall) || null;
}

function runState(){
  const recent = sortedLivePicks().slice(-6);
  const counts = {QB:0,RB:0,WR:0,TE:0,OTHER:0};
  for(const p of recent){
    const pos = pickPos(p);
    counts[['QB','RB','WR','TE'].includes(pos) ? pos : 'OTHER']++;
  }
  const ranked = Object.entries(counts)
    .filter(([pos])=>pos!=='OTHER')
    .sort((a,b)=>b[1]-a[1]);
  const [pos='—', count=0] = ranked[0] || [];
  return {recent, counts, pos, count};
}

function renderLiveCommandBar(){
  ensureLiveDraftExtras();
  const bar = document.querySelector('#liveCommandBar');
  if(!bar) return;

  const current = currentDraftOrderPick();
  const currentManager = current ? slotManager(current.slot) : null;
  const complete = currentDraft?.status==='complete' || !current;

  const avatar = document.querySelector('#commandAvatar');
  const team = document.querySelector('#commandTeam');
  const pick = document.querySelector('#commandPick');

  if(complete){
    if(avatar) avatar.style.display='none';
    if(team) team.textContent='DRAFT COMPLETE';
    if(pick) pick.textContent=`${currentPicks.length} picks logged`;
  } else {
    if(avatar){
      avatar.style.display='';
      avatar.src=currentManager?.avatar || '';
      avatar.alt=currentManager ? `${currentManager.team} avatar` : '';
    }
    if(team) team.textContent=currentManager?.team || `Slot ${current.slot}`;
    if(pick) pick.textContent=`Pick ${current.round}.${String(current.slot).padStart(2,'0')} · #${current.overall}`;
  }

  const picks = sortedLivePicks();
  const last = picks.at(-1);
  const lastManager = last ? slotManager(last.draft_slot) : null;
  document.querySelector('#commandLast').textContent = last
    ? `${playerName(last)} · ${lastManager?.team || 'Unknown'}`
    : 'No picks yet';

  const nextOverall = (currentPicks?.length || 0) + 1;
  const nextTwo = fullOrder
    .filter(p=>p.overall>nextOverall)
    .slice(0,2)
    .map(p=>slotManager(p.slot)?.team || `Slot ${p.slot}`);
  document.querySelector('#commandNext').textContent = nextTwo.length ? nextTwo.join(' → ') : '—';

  const run = runState();
  const runChip = document.querySelector('#commandRun');
  if(run.count>=4){
    runChip.textContent=`⚠ ${run.count} ${run.pos} IN LAST 6`;
    runChip.className='run-chip hot';
  } else if(run.count===3){
    runChip.textContent=`${run.count} ${run.pos} IN LAST 6 · HEATING UP`;
    runChip.className='run-chip warm';
  } else {
    runChip.textContent=picks.length ? 'MIXED BOARD · NO RUN' : 'NO RUN YET';
    runChip.className='run-chip';
  }
}

function renderPositionRun(){
  const headline=document.querySelector('#runHeadline');
  const recentEl=document.querySelector('#runRecent');
  const copy=document.querySelector('#runCopy');
  if(!headline || !recentEl || !copy) return;

  const {recent,pos,count}=runState();
  if(!recent.length){
    headline.textContent='WAITING FOR PICKS';
    recentEl.innerHTML='<span class="recent-empty">The last six picks will appear here.</span>';
    copy.textContent='Once picks start, this will flag position streaks across the shared room.';
    return;
  }

  if(count>=4){
    headline.textContent=`⚠ ${pos} RUN ACTIVE`;
    copy.textContent=`${count} of the last ${recent.length} selections are ${pos}s. The room is hammering the position.`;
  } else if(count===3){
    headline.textContent=`${pos} RUN HEATING UP`;
    copy.textContent=`Three of the last ${recent.length} picks are ${pos}s. Not a full stampede yet, but the room is leaning.`;
  } else {
    headline.textContent='BOARD IS MIXED';
    copy.textContent='No position owns at least half of the last six selections.';
  }

  recentEl.innerHTML=recent.map(p=>{
    const pos=pickPos(p)||'—';
    return `<span class="recent-pos ${posClass(pos)}" title="${esc(playerName(p))}">${esc(pos)}</span>`;
  }).join('');
}

function renderTeamSnapshot(){
  const current=currentDraftOrderPick();
  const slot=focusSlot || current?.slot || 1;
  const manager=slotManager(slot);
  const teamPicks=sortedLivePicks().filter(p=>Number(p.draft_slot)===Number(slot));

  const counts={QB:0,RB:0,WR:0,TE:0,OTHER:0};
  for(const p of teamPicks){
    const pos=pickPos(p);
    counts[['QB','RB','WR','TE'].includes(pos)?pos:'OTHER']++;
  }

  const teamEl=document.querySelector('#snapshotTeam');
  const slotEl=document.querySelector('#snapshotSlot');
  const countsEl=document.querySelector('#snapshotCounts');
  const rosterEl=document.querySelector('#snapshotRoster');
  const footerEl=document.querySelector('#snapshotFooter');
  if(!teamEl || !slotEl || !countsEl || !rosterEl || !footerEl) return;

  teamEl.textContent=manager?.team || `Slot ${slot}`;
  slotEl.textContent=`#${slot}`;

  countsEl.innerHTML=['QB','RB','WR','TE'].map(pos=>
    `<div class="snapshot-count ${posClass(pos)}"><span>${pos}</span><strong>${counts[pos]}</strong></div>`
  ).join('');

  if(teamPicks.length){
    rosterEl.innerHTML=teamPicks.slice(-8).reverse().map(p=>
      `<div class="snapshot-player"><span class="snapshot-pos ${posClass(pickPos(p))}">${esc(pickPos(p)||'—')}</span><b>${esc(playerName(p))}</b><small>R${p.round}</small></div>`
    ).join('');
  } else {
    rosterEl.innerHTML='<div class="snapshot-empty">No players drafted yet.</div>';
  }

  const remaining=Math.max(0,CONFIG.rounds-teamPicks.length);
  footerEl.textContent=`${teamPicks.length} drafted · ${remaining} picks remaining · ${focusSlot ? 'focused team' : 'on-clock team'}`;
}

function renderLiveExtras(){
  ensureLiveDraftExtras();
  renderLiveCommandBar();
  renderPositionRun();
  renderTeamSnapshot();
}

async function toggleBigScreen(){
  bigScreenActive=!bigScreenActive;
  document.body.classList.toggle('big-screen',bigScreenActive);
  const btn=document.querySelector('#bigScreenToggle');
  if(btn) btn.textContent=bigScreenActive?'✕ EXIT BIG SCREEN':'▣ BIG SCREEN';

  if(bigScreenActive && document.documentElement.requestFullscreen && !document.fullscreenElement){
    try{ await document.documentElement.requestFullscreen(); }catch{}
  } else if(!bigScreenActive && document.fullscreenElement && document.exitFullscreen){
    try{ await document.exitFullscreen(); }catch{}
  }
}

document.addEventListener('fullscreenchange',()=>{
  if(!document.fullscreenElement && bigScreenActive){
    bigScreenActive=false;
    document.body.classList.remove('big-screen');
    const btn=document.querySelector('#bigScreenToggle');
    if(btn) btn.textContent='▣ BIG SCREEN';
  }
});

document.addEventListener('keydown',e=>{
  if((e.key==='b' || e.key==='B') && document.querySelector('[data-page="draft"].active')) toggleBigScreen();
});

setInterval(renderLiveExtras,1000);
ensureLiveDraftExtras();
renderLiveExtras();
