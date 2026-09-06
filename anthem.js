(() => {
  const audio = document.getElementById('leagueAnthem');
  const gate = document.getElementById('anthemGate');
  const play = document.getElementById('anthemPlay');
  const progress = document.getElementById('anthemProgress');
  const current = document.getElementById('anthemCurrent');
  const duration = document.getElementById('anthemDuration');
  const volume = document.getElementById('anthemVolume');
  const mini = document.getElementById('anthemMini');
  const miniPlay = document.getElementById('anthemMiniPlay');
  const miniProgress = document.getElementById('anthemMiniProgress');
  const miniTime = document.getElementById('anthemMiniTime');
  const expand = document.getElementById('anthemExpand');
  if (!audio || !play || !progress || !gate || !mini) return;

  const icon = play.querySelector('.anthem-enter-icon');
  const copy = play.querySelector('span:last-child');
  let collapseTimer;
  const fmt = seconds => {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const showMini = () => {
    gate.classList.add('collapsing');
    window.setTimeout(() => gate.classList.add('dismissed'), 560);
    mini.classList.add('visible');
    document.body.classList.add('anthem-active');
    try { sessionStorage.setItem('bapeAnthemEntered','1'); } catch (_) {}
    window.setTimeout(() => document.getElementById('leagueHome')?.scrollIntoView({behavior:'smooth',block:'start'}), 300);
  };
  const showGate = () => {
    clearTimeout(collapseTimer);
    gate.classList.remove('dismissed');
    requestAnimationFrame(() => gate.classList.remove('collapsing'));
    mini.classList.remove('visible');
    document.body.classList.remove('anthem-active');
    window.scrollTo({top:0,behavior:'smooth'});
  };

  audio.volume = .8;
  if (volume) volume.value = audio.volume;
  try {
    if (sessionStorage.getItem('bapeAnthemEntered') === '1') {
      gate.classList.add('dismissed');
      mini.classList.add('visible');
      document.body.classList.add('anthem-active');
    }
  } catch (_) {}

  play.addEventListener('click', async () => {
    if (audio.paused) {
      try { await audio.play(); collapseTimer = window.setTimeout(showMini, 2600); } catch (_) { return; }
    } else audio.pause();
  });
  miniPlay?.addEventListener('click', async () => {
    if (audio.paused) { try { await audio.play(); } catch (_) {} } else audio.pause();
  });
  expand?.addEventListener('click', showGate);

  audio.addEventListener('play', () => {
    play.classList.add('playing');
    if (icon) icon.textContent = 'Ⅱ';
    if (copy) copy.innerHTML = '<small>NOW PLAYING // 2026 LEAGUE ANTHEM</small>RIP GYROBALL';
    if (miniPlay) miniPlay.textContent = 'Ⅱ';
    play.setAttribute('aria-label','Pause RIP Gyroball');
  });
  audio.addEventListener('pause', () => {
    clearTimeout(collapseTimer);
    play.classList.remove('playing');
    if (icon) icon.textContent = '▶';
    if (copy) copy.innerHTML = '<small>2026 LEAGUE ANTHEM</small>PLAY THIS BEFORE ENTERING';
    if (miniPlay) miniPlay.textContent = '▶';
    play.setAttribute('aria-label','Play RIP Gyroball');
  });
  audio.addEventListener('loadedmetadata', () => {
    const max = audio.duration || 1;
    duration.textContent = fmt(audio.duration);
    progress.max = max;
    if (miniProgress) miniProgress.max = max;
  });
  audio.addEventListener('timeupdate', () => {
    current.textContent = fmt(audio.currentTime);
    progress.value = audio.currentTime;
    if (miniProgress) miniProgress.value = audio.currentTime;
    if (miniTime) miniTime.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('ended', () => { audio.currentTime = 0; });
  progress.addEventListener('input', () => { audio.currentTime = Number(progress.value); });
  miniProgress?.addEventListener('input', () => { audio.currentTime = Number(miniProgress.value); });
  volume?.addEventListener('input', () => { audio.volume = Number(volume.value); });
})();
