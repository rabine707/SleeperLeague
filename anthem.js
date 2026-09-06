(() => {
  const audio = document.getElementById('leagueAnthem');
  const play = document.getElementById('anthemPlay');
  const progress = document.getElementById('anthemProgress');
  const current = document.getElementById('anthemCurrent');
  const duration = document.getElementById('anthemDuration');
  const volume = document.getElementById('anthemVolume');
  if (!audio || !play || !progress) return;

  const fmt = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  audio.volume = .8;
  volume.value = audio.volume;
  play.addEventListener('click', async () => {
    if (audio.paused) {
      try { await audio.play(); } catch (_) { return; }
    } else audio.pause();
  });
  audio.addEventListener('play', () => { play.textContent = 'Ⅱ'; play.setAttribute('aria-label','Pause RIP Gyroball'); });
  audio.addEventListener('pause', () => { play.textContent = '▶'; play.setAttribute('aria-label','Play RIP Gyroball'); });
  audio.addEventListener('loadedmetadata', () => { duration.textContent = fmt(audio.duration); progress.max = audio.duration || 1; });
  audio.addEventListener('timeupdate', () => { current.textContent = fmt(audio.currentTime); progress.value = audio.currentTime; });
  audio.addEventListener('ended', () => { audio.currentTime = 0; });
  progress.addEventListener('input', () => { audio.currentTime = Number(progress.value); });
  volume.addEventListener('input', () => { audio.volume = Number(volume.value); });
})();
