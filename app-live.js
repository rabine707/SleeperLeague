// Live draft extras: shared command bar, position-run detector, team snapshots, and TV mode.
let bigScreenActive = false;
let lastTakeoverSignature = '';
let takeoverTimer = null;
const demoRunParam = new URLSearchParams(location.search).get('demoRun');

function demoRunEvent(){
  if(!demoRunParam) return null;
  const match=String(demoRunParam).toUpperCase().match(/^(QB|RB|WR|TE)([4-6])$/);
  if(!match) return null;
  const [,pos,countText]=match;
  const count=Number(countText);
  const copy={
    QB:{title:'QUARTERBACK FOMO HAS ENTERED THE CHAT',joke:'Apparently everyone remembered this is Superflex at the exact same time.'},
    RB:{title:'RUNNING BACK EXTINCTION EVENT',joke:'The room has decided knees are a renewable resource.'},
    WR:{title:'WIDE RECEIVER PANIC',joke:'Apparently running the football has been canceled until further notice.'},
    TE:{title:'TIGHT END FEVER',joke:'Medical professionals recommend not drafting six of them.'}
  }[pos];
  return {
    pos,
    stat:`${count} STRAIGHT ${pos} PICKS`,
    severity:count>=6?'nuclear':count===5?'huge':'major',
    proof:'DEMO MODE — simulated locally for visual testing only.',
    signature:`DEMO|${pos}|${count}`,
    title:copy.title,
    joke:copy.joke,
    lastPick:count
  };
}

function ensureLiveDraftExtras(){
  const draftPage = document.querySelector('[data-page="draft"]');
  if(!draftPage || document.querySelector('#liveCommandBar')) return;

  const hero = draftPage.querySelector('.page-hero');
  hero.insertAdjacentHTML('afterend', `
    <div class="draft-takeover" id="draftTakeover" aria-live="polite" aria-atomic="true">
      <div class="takeover-stripe"></div>
      <div class="takeover-kicker">LIVE DRAFT ALERT</div>
      <div class="takeover-title" id="takeoverTitle">POSITION RUN</div>
      <div class="takeover-stat" id="takeoverStat">—</div>
      <div class="takeover-joke" id="takeoverJoke"></div>
      <div class="takeover-proof" id="takeoverProof"></div>
    </div>

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
    if(pick) pick.textContent=`Pick ${draftPickLabel(current)} · #${current.overall}`;
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

function trailingPositionStreak(){
  const picks=sortedLivePicks();
  if(!picks.length) return {pos:'',count:0};
  const lastPos=pickPos(picks.at(-1));
  if(!['QB','RB','WR','TE'].includes(lastPos)) return {pos:'',count:0};
  let count=0;
  for(let i=picks.length-1;i>=0;i--){
    if(pickPos(picks[i])!==lastPos) break;
    count++;
  }
  return {pos:lastPos,count};
}

function majorRunEvent(){
  const demo=demoRunEvent();
  if(demo) return demo;
  const picks=sortedLivePicks();
  if(picks.length<4) return null;

  const recent=picks.slice(-6);
  const counts={QB:0,RB:0,WR:0,TE:0};
  for(const p of recent){
    const pos=pickPos(p);
    if(counts[pos]!=null) counts[pos]++;
  }
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const [windowPos,windowCount]=ranked[0] || ['',0];
  const streak=trailingPositionStreak();

  let pos='', stat='', severity='major', proof='';
  if(streak.count>=4){
    pos=streak.pos;
    stat=`${streak.count} STRAIGHT ${pos} PICKS`;
    severity=streak.count>=6?'nuclear':streak.count>=5?'huge':'major';
    proof=`Current trailing streak: ${streak.count} consecutive ${pos}s.`;
  } else if(windowCount>=4 && recent.length>=6){
    pos=windowPos;
    stat=`${windowCount} OF THE LAST 6 PICKS ARE ${pos}`;
    severity=windowCount===6?'nuclear':windowCount===5?'huge':'major';
    proof=`Verified from picks #${Number(recent[0].pick_no||0) || Math.max(1,picks.length-5)}–#${Number(recent.at(-1).pick_no||0) || picks.length}.`;
  } else {
    return null;
  }

  const copy={
    QB:{
      title:'QUARTERBACK FOMO HAS ENTERED THE CHAT',
      joke:'Apparently everyone remembered this is Superflex at the exact same time.'
    },
    RB:{
      title:'RUNNING BACK EXTINCTION EVENT',
      joke:'The room has decided knees are a renewable resource.'
    },
    WR:{
      title:'WIDE RECEIVER PANIC',
      joke:'Apparently running the football has been canceled until further notice.'
    },
    TE:{
      title:'TIGHT END FEVER',
      joke:'Medical professionals recommend not drafting six of them.'
    }
  }[pos];

  const last=picks.at(-1);
  const signature=`${pos}|${stat}|${severity}`;
  return {pos,stat,severity,proof,signature,title:copy.title,joke:copy.joke,lastPick:Number(last?.pick_no||picks.length)};
}

function hideRunTakeover(){
  const el=document.querySelector('#draftTakeover');
  if(el) el.classList.remove('show','major','huge','nuclear');
  if(takeoverTimer){ clearTimeout(takeoverTimer); takeoverTimer=null; }
}

function maybeShowRunTakeover(force=false){
  if(!bigScreenActive) return;
  const event=majorRunEvent();
  if(!event){
    lastTakeoverSignature='';
    hideRunTakeover();
    return;
  }
  if(!force && event.signature===lastTakeoverSignature) return;

  lastTakeoverSignature=event.signature;
  const el=document.querySelector('#draftTakeover');
  if(!el) return;

  document.querySelector('#takeoverTitle').textContent=event.title;
  document.querySelector('#takeoverStat').textContent=event.stat;
  document.querySelector('#takeoverJoke').textContent=event.joke;
  document.querySelector('#takeoverProof').textContent=event.signature.startsWith('DEMO|') ? event.proof : `${event.proof} · Triggered after pick #${event.lastPick}.`;

  el.className=`draft-takeover show ${event.severity}`;
  if(takeoverTimer) clearTimeout(takeoverTimer);
  takeoverTimer=setTimeout(()=>hideRunTakeover(), event.severity==='nuclear'?5500:4000);
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
  maybeShowRunTakeover();
}

async function toggleBigScreen(){
  bigScreenActive=!bigScreenActive;
  document.body.classList.toggle('big-screen',bigScreenActive);
  const btn=document.querySelector('#bigScreenToggle');
  if(btn) btn.textContent=bigScreenActive?'✕ EXIT BIG SCREEN':'▣ BIG SCREEN';

  if(bigScreenActive){
    setTimeout(()=>maybeShowRunTakeover(true),220);
  } else {
    hideRunTakeover();
  }

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
    hideRunTakeover();
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

if(demoRunParam){
  const bar=document.querySelector('#liveCommandBar');
  if(bar){
    bar.insertAdjacentHTML('beforeend','<span class="demo-mode-badge">DEMO MODE</span>');
  }
}
