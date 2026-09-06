(() => {
  const audio=document.getElementById('leagueAnthem'),play=document.getElementById('anthemMiniPlay'),progress=document.getElementById('anthemMiniProgress'),time=document.getElementById('anthemMiniTime');
  if(!audio||!play)return;
  let ready=false;
  const fmt=s=>{if(!Number.isFinite(s))return'0:00';return`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`};
  audio.volume=.8;
  play.addEventListener('click',async()=>{if(audio.paused){try{await audio.play()}catch(_){}}else audio.pause()});
  audio.addEventListener('play',()=>{play.textContent='Ⅱ';play.setAttribute('aria-label','Pause RIP Gyroball')});
  audio.addEventListener('pause',()=>{play.textContent='▶';play.setAttribute('aria-label','Play RIP Gyroball')});
  audio.addEventListener('loadedmetadata',()=>{if(!Number.isFinite(audio.duration)||audio.duration<=0)return;ready=true;if(progress){progress.max=String(audio.duration);progress.step='0.1'}});
  audio.addEventListener('timeupdate',()=>{if(time)time.textContent=fmt(audio.currentTime);if(progress&&ready)progress.value=String(audio.currentTime)});
  audio.addEventListener('ended',()=>{audio.currentTime=0;if(progress)progress.value='0'});
  progress?.addEventListener('input',()=>{if(!ready)return;const n=Math.min(audio.duration,Math.max(0,Number(progress.value)));if(Number.isFinite(n))audio.currentTime=n});
})();