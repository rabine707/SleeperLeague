$('#teamFocus').addEventListener('change',e=>setFocusSlot(e.target.value));
document.addEventListener('click',e=>{
  const target=e.target.closest('[data-focus-slot]');
  if(!target) return;
  const slot=Number(target.dataset.focusSlot);
  if(!slot) return;
  const jump=Boolean(target.closest('.manager-card,.order-card'));
  setFocusSlot(slot,jump);
});
$('#orderPrev').addEventListener('click',()=>$('#draftOrderRail').scrollBy({left:-520,behavior:'smooth'}));
$('#orderNext').addEventListener('click',()=>$('#draftOrderRail').scrollBy({left:520,behavior:'smooth'}));

async function boot(){
  renderManagers(); renderOrder(); buildTicker(); populateFocusSelect(); renderDraftBoard(); updateCountdown(); renderChampion();
  try{ await refreshDraft(); }catch{}
  $('#turnSpotlight').innerHTML=`<div class="spot-card"><div><small>SHARED INTEL</small><strong>All 12 managers</strong><span style="color:var(--muted);font-size:10px">Nobody gets a private scouting view.</span></div></div><div class="spot-card"><div><small>PAST DRAFTS</small><strong>Behavior, not identity</strong><span style="color:var(--muted);font-size:10px">Tendencies come from completed Sleeper drafts.</span></div></div><div class="spot-card"><div><small>LIVE FOCUS</small><strong>Any team, anytime</strong><span style="color:var(--muted);font-size:10px">Focus changes presentation only.</span></div></div>`;
}
boot();
