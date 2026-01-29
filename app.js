/* Strong Verbs — Flashcards only
   Put these files in the same folder:
   - index.html
   - style.css
   - app.js
   - verbs.json
*/
const STORAGE_KEY = "strong-verbs-flashcards-v1";

let deck = [];
let order = [];
let idx = 0;

const state = { weights:{}, orderSeed:null };

const el = (id) => document.getElementById(id);
const clamp = (n,a,b) => Math.max(a, Math.min(b,n));

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && typeof parsed === "object"){
      state.weights = parsed.weights || {};
      state.orderSeed = parsed.orderSeed ?? null;
    }
  }catch(_){}
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(_){}
}
function resetState(){
  state.weights = {};
  state.orderSeed = null;
  saveState();
}

function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWithSeed(arr, seed){
  const rnd = mulberry32(seed);
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rnd()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function buildOrder(){
  const expanded = [];
  for(const v of deck){
    const key = v.infinitiv;
    const w = clamp(Number(state.weights[key] ?? 1), 1, 6);
    for(let i=0;i<w;i++) expanded.push(key);
  }
  const seed = state.orderSeed ?? Math.floor(Math.random()*1e9);
  state.orderSeed = seed; saveState();
  shuffleWithSeed(expanded, seed);

  const byKey = new Map(deck.map((v,i)=>[v.infinitiv,i]));
  order = expanded.map(k => byKey.get(k)).filter(i => i !== undefined);
  idx = 0;
}

function currentVerb(){
  if(order.length === 0) return null;
  return deck[order[idx]];
}

function render(){
  const v = currentVerb();
  if(!v){
    el("frontWord").textContent = "No data";
    el("backPraet").textContent = "";
    el("backPart").textContent = "";
    el("progressText").textContent = "0 / 0";
    el("progressFill").style.width = "0%";
    return;
  }
  el("card").classList.remove("flipped");

  el("frontWord").textContent = v.infinitiv;
  const tr = v.translation?.en;
  el("frontTranslation").textContent = tr ? `EN: ${tr}` : "";

  el("backPraet").textContent = v.praeteritum;
  el("backPart").textContent = v.partizipII;
  el("backTranslation").textContent = tr ? `EN: ${tr}` : "";

  const pos = idx + 1;
  const total = order.length;
  el("progressText").textContent = `${pos} / ${total}`;
  el("progressFill").style.width = `${Math.round((pos/total)*100)}%`;
}

function next(){ if(order.length){ idx = (idx+1)%order.length; render(); } }
function prev(){ if(order.length){ idx = (idx-1+order.length)%order.length; render(); } }
function flip(){ el("card").classList.toggle("flipped"); }

function markKnown(){
  const v = currentVerb(); if(!v) return;
  const w = Number(state.weights[v.infinitiv] ?? 1);
  state.weights[v.infinitiv] = clamp(w-1, 1, 6);
  saveState();
  next();
}
function markAgain(){
  const v = currentVerb(); if(!v) return;
  const w = Number(state.weights[v.infinitiv] ?? 1);
  state.weights[v.infinitiv] = clamp(w+1, 1, 6);
  saveState();
  const keep = v.infinitiv;
  buildOrder();
  const newIndex = order.findIndex(i => deck[i].infinitiv === keep);
  if(newIndex >= 0) idx = newIndex;
  render();
}

async function init(){
  loadState();
  let json;
  try{
    const res = await fetch("verbs.json", { cache:"no-store" });
    json = await res.json();
  }catch(e){
    // If you opened index.html via file://, fetch() is blocked.
    // Fallback to verbs.js (window.VERBS).
    json = window.VERBS || [];
  }
  deck = Array.isArray(json) ? json : (json.verbs || []);
  deck = deck.filter(v => v?.infinitiv && v?.praeteritum && v?.partizipII);
  buildOrder();
  render();

  el("card").addEventListener("click", flip);
  el("card").addEventListener("keydown", (e) => {
    if(e.key === " " || e.key === "Enter"){ e.preventDefault(); flip(); }
  });
  el("nextBtn").addEventListener("click", next);
  el("prevBtn").addEventListener("click", prev);
  el("shuffleBtn").addEventListener("click", () => {
    state.orderSeed = Math.floor(Math.random()*1e9);
    saveState();
    buildOrder(); render();
  });
  el("resetBtn").addEventListener("click", () => { resetState(); buildOrder(); render(); });

  el("knownBtn").addEventListener("click", markKnown);
  el("againBtn").addEventListener("click", markAgain);

  window.addEventListener("keydown", (e) => {
    if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if(e.key === "ArrowRight") next();
    else if(e.key === "ArrowLeft") prev();
    else if(e.key === " ") { e.preventDefault(); flip(); }
    else if(e.key.toLowerCase() === "k") markKnown();
    else if(e.key.toLowerCase() === "a") markAgain();
  });
}

init().catch(err => {
  console.error(err);
  el("frontWord").textContent = "Failed to load verbs.json";
});
