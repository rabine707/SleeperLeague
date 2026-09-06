const CONFIG = {
  leagueId: '1382152189975199744',
  draftId: '1382152189979410432',
  rounds: 18,
  teams: 12,
  draftStart: 1788714009000,
  api: 'https://api.sleeper.app/v1',
};

const seedManagers = [
  {slot:1,user_id:'581704385252339712',display_name:'antbo',team:'Loser',avatar:'https://sleepercdn.com/images/v4/avatars/avatar_default_blue.webp'},
  {slot:2,user_id:'492598704423825408',display_name:'JG007',team:'Yoo Carloooos 🫦🙈',avatar:'https://sleepercdn.com/uploads/96782cae68557d1fd1945b27e15b7a47.jpg'},
  {slot:3,user_id:'469996624483971072',display_name:'liltonechi',team:'#QuestForTwo',avatar:'https://sleepercdn.com/uploads/600ac53f22ec0c6506cf4fb6326f8727.jpg'},
  {slot:4,user_id:'427019162729062400',display_name:'YouFeelMe510',team:'Hail Marys',avatar:'https://sleepercdn.com/uploads/696df2c7a0df9c79bc6392dac13bb894.jpg'},
  {slot:5,user_id:'469313911980552192',display_name:'TyCo11',team:'Njigba’s in Paris',avatar:'https://sleepercdn.com/uploads/42e48bf0cc752581881b7caa37be186c.jpg'},
  {slot:6,user_id:'469995600352374784',display_name:'Dallas-Mattson',team:'EastPalestinesMostWanted',avatar:'https://sleepercdn.com/uploads/d111173b2935ebe1a9f9b18517e8ebdf.jpg'},
  {slot:7,user_id:'1131706795183104000',display_name:'nelsonuqui',team:'HBZU',avatar:'https://sleepercdn.com/uploads/17a9193f566a392d5e5d1632b92a9973.jpg'},
  {slot:8,user_id:'885630199688007680',display_name:'matttmann',team:'matttmann',avatar:'https://sleepercdn.com/avatars/thumbs/c85a72fa040506ccfa91c3666d8420c0'},
  {slot:9,user_id:'469994930513637376',display_name:'maleeezy',team:'Love in this Chubb',avatar:'https://sleepercdn.com/uploads/a761c952ebe6b374201af6f3e1b54f83.jpg'},
  {slot:10,user_id:'636685844886925312',display_name:'rabine707',team:'Ra DK Hurts',avatar:'https://sleepercdn.com/uploads/dc86ea05225e0c880fa6093caa0a4dd4.jpg'},
  {slot:11,user_id:'579404548913803264',display_name:'adampeeen',team:'Saquon my Johnson',avatar:'https://sleepercdn.com/uploads/55b9fb67173da1c7b687d6b5b3592f26.jpg'},
  {slot:12,user_id:'542862350794276864',display_name:'austintrum',team:'Sex Panther',avatar:'https://sleepercdn.com/uploads/4c0a81edce094eea29998b7f2d6c7729.jpg'},
];

let managers = [...seedManagers];
let currentLeague = null;
let currentDraft = null;
let currentPicks = [];
let historyCache = null;
let pollHandle = null;
let focusSlot = 0; // 0 = shared league view; 1-12 = temporary visual focus only

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const fmt = n => Number(n || 0).toLocaleString(undefined,{maximumFractionDigits:1});
const posClass = p => ['QB','RB','WR','TE'].includes((p||'').toUpperCase()) ? `pos-${p.toLowerCase()}` : '';

async function fetchJSON(url, timeout = 9000){
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(),timeout);
  try{
    const res = await fetch(url,{signal:ctrl.signal});
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function api(path){ return fetchJSON(`${CONFIG.api}${path}`); }
function managerById(id){ return managers.find(m=>String(m.user_id)===String(id)); }
function avatarForUser(u){ return u?.metadata?.avatar || (u?.avatar ? `https://sleepercdn.com/avatars/thumbs/${u.avatar}` : 'https://sleepercdn.com/images/v2/icons/player_default.webp'); }
function teamNameForUser(u){ return u?.metadata?.team_name || u?.display_name || 'Unknown Team'; }

function route(name){
  $$('.page').forEach(p=>p.classList.toggle('active',p.dataset.page===name));
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.route===name));
  window.scrollTo({top:0,behavior:'smooth'});
  if(name==='draft') refreshDraft();
}
$$('[data-route]').forEach(b=>b.addEventListener('click',()=>route(b.dataset.route)));

function renderManagers(){
  $('#managerGrid').innerHTML = managers.map(m=>`
    <article class="manager-card" data-focus-slot="${m.slot}" title="Focus ${esc(m.team)} on the draft board">
      <div class="slot">${String(m.slot).padStart(2,'0')}</div>
      <img class="manager-avatar" src="${esc(m.avatar)}" alt="${esc(m.display_name)} avatar" loading="lazy">
      <h3>${esc(m.team)}</h3>
      <div class="handle">@${esc(m.display_name)}</div>
      <div class="manager-badges">
        <span class="badge">2026 PICK ${m.slot}</span>
        ${m.slot===5?'<span class="badge champ">DEFENDING CHAMP*</span>':''}
        <span class="badge focus-badge">FOCUS IN DRAFT</span>
      </div>
    </article>`).join('');
}

function renderOrder(){
  $('#draftOrderRail').innerHTML = [...managers].sort((a,b)=>a.slot-b.slot).map(m=>`
    <article class="order-card" data-focus-slot="${m.slot}" title="Focus ${esc(m.team)} on the draft board">
      <div class="order-num">${String(m.slot).padStart(2,'0')}</div>
      <img class="order-avatar" src="${esc(m.avatar)}" alt="" loading="lazy">
      <div class="order-team">${esc(m.team)}</div>
      <div class="order-user">${esc(m.display_name)}</div>
      ${m.slot===5?'<span class="champ-tag">CHAMP*</span>':''}
    </article>`).join('');
}

function buildTicker(){
  const items = [
    ['FORMAT','12-team Superflex'],['PASS TD','6 points'],['INT','-3 points'],['PPR','1 point'],['RUSH/REC 1D','+1'],['ROUNDS','18'],['PICKS','216 total'],['TIMER','60 seconds'],['PLAYOFFS','6 teams']
  ];
  const html=[...items,...items].map(([a,b])=>`<span class="ticker-item"><b>${a}</b>${b}</span>`).join('');
  $('#ticker').innerHTML=html;
}

function updateCountdown(){
  const now=Date.now(), diff=CONFIG.draftStart-now;
  const d=new Date(CONFIG.draftStart);
  $('#draftDate').textContent=d.toLocaleString([], {weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  if(diff<=0){ $('#countdown').textContent=currentDraft?.status==='complete'?'COMPLETE':'LIVE NOW'; return; }
  const days=Math.floor(diff/86400000), hrs=Math.floor(diff%86400000/3600000), min=Math.floor(diff%3600000/60000), sec=Math.floor(diff%60000/1000);
  $('#countdown').textContent=`${days?days+'D ':''}${String(hrs).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
setInterval(updateCountdown,1000);
