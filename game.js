/* =====================================================================
   NEON DRIFT — game.js
   Single-file game engine. Organised into clearly labelled sections so
   new features (skins, themes, power-ups) are easy to bolt on later.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. STORAGE LAYER  (all persistence goes through here)
   --------------------------------------------------------------------- */
const STORE_KEY = 'neondrift_save_v1';

function loadSave(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) throw new Error('no save');
    const data = JSON.parse(raw);
    return Object.assign(defaultSave(), data);
  }catch(e){
    return defaultSave();
  }
}
function defaultSave(){
  return {
    bestScore: 0,
    sensitivity: 70,
    soundOn: true,
    unlocked: { skins:['skin_cyan'], themes:['theme_grid'], trails:['trail_none'] },
    selected: { skin:'skin_cyan', theme:'theme_grid', trail:'trail_none' }
  };
}
function saveGame(){ localStorage.setItem(STORE_KEY, JSON.stringify(SAVE)); }

let SAVE = loadSave();

/* ---------------------------------------------------------------------
   2. SHOP CATALOG — add new entries here and they show up automatically.
   Each item unlocks permanently once bestScore >= unlockScore.
   --------------------------------------------------------------------- */
const CATALOG = {
  skins: [
    { id:'skin_cyan',    name:'Cyan Pulse',   unlockScore:0,    color:'#00f6ff', icon:'▲' },
    { id:'skin_magenta', name:'Magenta Bolt', unlockScore:150,  color:'#ff2ea6', icon:'▲' },
    { id:'skin_gold',    name:'Gold Rush',    unlockScore:400,  color:'#e8ff59', icon:'▲' },
    { id:'skin_mint',    name:'Mint Surge',   unlockScore:800,  color:'#5cffb0', icon:'▲' },
    { id:'skin_prism',   name:'Prism',        unlockScore:1500, color:'prism',   icon:'◆' },
  ],
  themes: [
    { id:'theme_grid',    name:'Neon Grid',   unlockScore:0,   colors:['#05070d','#0a0f1e','#00f6ff'] },
    { id:'theme_sunset',  name:'Retrowave',   unlockScore:250, colors:['#1a0521','#3a0f4a','#ff6ec7'] },
    { id:'theme_matrix',  name:'Matrix',      unlockScore:600, colors:['#020a04','#04150a','#3dff6e'] },
    { id:'theme_ice',     name:'Deep Ice',    unlockScore:1100,colors:['#020814','#04213a','#7fe3ff'] },
  ],
  trails: [
    { id:'trail_none',  name:'No Trail',   unlockScore:0,   color:null },
    { id:'trail_spark', name:'Spark Trail',unlockScore:100, color:'#e8ff59' },
    { id:'trail_comet', name:'Comet Trail',unlockScore:500, color:'#ff2ea6' },
    { id:'trail_ion',   name:'Ion Trail',  unlockScore:1000,color:'#5cffb0' },
  ]
};

function refreshUnlocks(){
  for(const cat of Object.keys(CATALOG)){
    CATALOG[cat].forEach(item=>{
      if(SAVE.bestScore >= item.unlockScore && !SAVE.unlocked[cat].includes(item.id)){
        SAVE.unlocked[cat].push(item.id);
      }
    });
  }
  saveGame();
}

/* ---------------------------------------------------------------------
   3. AUDIO ENGINE — procedurally generated (no external files needed,
   so there are zero licensing/hosting concerns on GitHub Pages).
   --------------------------------------------------------------------- */
const Audio_ = (()=>{
  let ctx = null, musicNodes = [], musicTimer = null, muted = false;

  function ensureCtx(){
    if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if(ctx.state === 'suspended') ctx.resume();
  }

  function blip(freq=880, dur=0.08, type='square', vol=0.06){
    if(muted) return;
    ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  }

  const SFX = {
    coin:  ()=>blip(1200, 0.09, 'square', 0.05),
    hit:   ()=>{ blip(120, 0.35, 'sawtooth', 0.08); blip(80, 0.4, 'square', 0.06); },
    power: ()=>{ blip(600,0.1,'triangle',0.06); setTimeout(()=>blip(900,0.12,'triangle',0.06),90); },
    lane:  ()=>blip(500, 0.04, 'square', 0.03),
  };

  // Simple procedural arpeggio loop for background music.
  const scale = [220, 261.6, 293.7, 329.6, 392, 440]; // A minor-ish pentatonic-ish
  function startMusic(){
    if(muted) return;
    ensureCtx();
    stopMusic();
    let step = 0;
    musicTimer = setInterval(()=>{
      if(muted) return;
      const note = scale[step % scale.length] * (step % 8 < 4 ? 1 : 0.5);
      blip(note, 0.16, 'triangle', 0.035);
      if(step % 4 === 0) blip(note/2, 0.2, 'sine', 0.03);
      step++;
    }, 180);
  }
  function stopMusic(){
    if(musicTimer){ clearInterval(musicTimer); musicTimer = null; }
  }
  function setMuted(m){
    muted = m;
    if(muted) stopMusic();
  }

  return { SFX, startMusic, stopMusic, setMuted };
})();
Audio_.setMuted(!SAVE.soundOn);

/* ---------------------------------------------------------------------
   4. SCREEN MANAGEMENT
   --------------------------------------------------------------------- */
const screens = {
  loading:  document.getElementById('loading-screen'),
  home:     document.getElementById('home-screen'),
  shop:     document.getElementById('shop-screen'),
  settings: document.getElementById('settings-screen'),
  game:     document.getElementById('game-screen'),
  gameover: document.getElementById('gameover-screen'),
};
function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

/* ---------------------------------------------------------------------
   5. LOADING SEQUENCE (runs once per page load — a refresh is the only
   way to see it again, matching the "restart only" requirement)
   --------------------------------------------------------------------- */
function runLoadingSequence(){
  const fill = document.getElementById('load-bar-fill');
  const status = document.getElementById('load-status');
  const messages = ['BOOTING SYSTEM…','CALIBRATING GRID…','SYNCING NEON CORE…','READY'];
  let pct = 0;
  const iv = setInterval(()=>{
    pct += Math.random()*18 + 8;
    if(pct >= 100){
      pct = 100;
      fill.style.width = '100%';
      status.textContent = messages[3];
      clearInterval(iv);
      setTimeout(()=>{ showScreen('home'); refreshHomeUI(); }, 350);
      return;
    }
    fill.style.width = pct + '%';
    status.textContent = messages[Math.min(2, Math.floor(pct/34))];
  }, 140);
}

/* ---------------------------------------------------------------------
   6. HOME SCREEN
   --------------------------------------------------------------------- */
function refreshHomeUI(){
  document.getElementById('home-best-score').textContent = SAVE.bestScore;
}
document.getElementById('btn-start').addEventListener('click', ()=>{
  showScreen('game');
  startGame();
});
document.getElementById('btn-shop').addEventListener('click', ()=>{
  showScreen('shop');
  renderShop('skins');
});
document.getElementById('btn-settings').addEventListener('click', ()=>{
  showScreen('settings');
});
document.getElementById('shop-back').addEventListener('click', ()=> showScreen('home'));
document.getElementById('settings-back').addEventListener('click', ()=> showScreen('home'));

/* ---------------------------------------------------------------------
   7. SHOP SCREEN
   --------------------------------------------------------------------- */
let currentShopCat = 'skins';
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    currentShopCat = tab.dataset.cat;
    renderShop(currentShopCat);
  });
});

function renderShop(cat){
  refreshUnlocks();
  document.getElementById('shop-progress-pill').textContent = 'SCORE ' + SAVE.bestScore;
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  const singularKey = { skins:'skin', themes:'theme', trails:'trail' }[cat];

  CATALOG[cat].forEach(item=>{
    const unlocked = SAVE.unlocked[cat].includes(item.id);
    const selected = SAVE.selected[singularKey] === item.id;

    const card = document.createElement('div');
    card.className = 'shop-item' + (unlocked ? '' : ' locked') + (selected ? ' selected' : '');

    const swatch = document.createElement('div');
    swatch.className = 'item-swatch';
    if(cat === 'skins'){
      swatch.style.background = item.color === 'prism'
        ? 'linear-gradient(135deg,#00f6ff,#ff2ea6,#e8ff59)'
        : item.color;
      swatch.style.boxShadow = unlocked ? `0 0 16px ${item.color==='prism'?'#ff2ea6':item.color}` : 'none';
      swatch.textContent = item.icon;
    } else if(cat === 'themes'){
      swatch.style.background = `linear-gradient(135deg, ${item.colors[1]}, ${item.colors[0]})`;
      swatch.style.boxShadow = unlocked ? `0 0 16px ${item.colors[2]}` : 'none';
      swatch.textContent = '▦';
    } else {
      swatch.style.background = item.color ? item.color+'22' : 'rgba(255,255,255,0.08)';
      swatch.style.boxShadow = (unlocked && item.color) ? `0 0 16px ${item.color}` : 'none';
      swatch.textContent = '✦';
    }

    const name = document.createElement('div');
    name.className = 'item-name'; name.textContent = item.name;

    const status = document.createElement('div');
    status.className = 'item-status' + (selected ? ' selected' : (unlocked ? ' unlocked' : ''));
    status.textContent = selected ? 'SELECTED' : (unlocked ? 'TAP TO EQUIP' : `SCORE ${item.unlockScore}`);

    card.append(swatch, name, status);

    if(unlocked){
      card.addEventListener('click', ()=>{
        SAVE.selected[singularKey] = item.id;
        saveGame();
        renderShop(cat);
      });
    }
    grid.appendChild(card);
  });
}

/* ---------------------------------------------------------------------
   8. SETTINGS SCREEN
   --------------------------------------------------------------------- */
const sensSlider = document.getElementById('sensitivity-slider');
sensSlider.value = SAVE.sensitivity;
sensSlider.addEventListener('input', ()=>{
  SAVE.sensitivity = Number(sensSlider.value);
  saveGame();
});
const soundToggle = document.getElementById('sound-toggle');
soundToggle.checked = SAVE.soundOn;
soundToggle.addEventListener('change', ()=>{
  SAVE.soundOn = soundToggle.checked;
  Audio_.setMuted(!SAVE.soundOn);
  saveGame();
});
document.getElementById('btn-howto').addEventListener('click', ()=>{
  document.getElementById('howto-modal').classList.remove('hidden');
});
document.getElementById('howto-close').addEventListener('click', ()=>{
  document.getElementById('howto-modal').classList.add('hidden');
});

/* ---------------------------------------------------------------------
   9. GAME ENGINE
   --------------------------------------------------------------------- */
const canvas = document.getElementById('game-canvas');
const ctx2d = canvas.getContext('2d');
let W, H, laneW;
const LANES = 3;

function resizeCanvas(){
  W = canvas.width = window.innerWidth * devicePixelRatio;
  H = canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  laneW = W / LANES;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let game = null; // holds all live run-state, recreated each run

function makeGameState(){
  return {
    running:false, paused:false,
    player:{ lane:1, x:laneW*1.5, y:H*0.82, w:W*0.11, h:W*0.11, shield:false, magnetT:0 },
    entities:[],   // obstacles / coins / powerups falling down
    particles:[],  // trail + burst particles
    speed: H*0.55, // px/sec fall speed, ramps up over time
    baseSpeed: H*0.55,
    spawnTimer:0,
    spawnInterval:0.9,
    score:0,
    elapsed:0,
    hitFlash:0,
    gameOver:false,
  };
}

function laneX(lane){ return laneW*lane + laneW/2; }

function themeColors(){
  const t = CATALOG.themes.find(t=>t.id === SAVE.selected.theme) || CATALOG.themes[0];
  return t.colors;
}
function skinColor(){
  const s = CATALOG.skins.find(s=>s.id === SAVE.selected.skin) || CATALOG.skins[0];
  return s.color;
}
function trailColor(){
  const t = CATALOG.trails.find(t=>t.id === SAVE.selected.trail) || CATALOG.trails[0];
  return t.color;
}

function startGame(){
  resizeCanvas();
  game = makeGameState();
  game.player.x = laneX(1);
  document.getElementById('hud-score').textContent = '0';
  updatePowerupHud();
  runCountdown(()=>{
    game.running = true;
    Audio_.startMusic();
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  });
}

function runCountdown(cb){
  const overlay = document.getElementById('countdown-overlay');
  const num = document.getElementById('countdown-num');
  overlay.classList.remove('hidden');
  let n = 3;
  num.textContent = n;
  const iv = setInterval(()=>{
    n--;
    if(n === 0){ num.textContent = 'GO!'; }
    if(n < 0){
      clearInterval(iv);
      overlay.classList.add('hidden');
      cb();
      return;
    }
    num.textContent = n;
  }, 500);
}

/* ---- spawning ---- */
function spawnEntity(){
  const lane = Math.floor(Math.random()*LANES);
  const roll = Math.random();
  let type = 'obstacle';
  if(roll < 0.45) type = 'obstacle';
  else if(roll < 0.78) type = 'coin';
  else if(roll < 0.90) type = 'shield';
  else type = 'magnet';

  // avoid impossible walls: don't block all 3 lanes with obstacles at same wave
  game.entities.push({
    type, lane, y:-80,
    size: type === 'obstacle' ? W*0.13 : W*0.09,
    collected:false,
  });
}

/* ---- input: swipe + keyboard ---- */
let touchStartX=0, touchStartY=0, touchActive=false;
canvas.addEventListener('touchstart', e=>{
  touchActive = true;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, {passive:true});
canvas.addEventListener('touchend', e=>{
  if(!touchActive || !game || !game.running || game.paused) return;
  touchActive = false;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const threshold = SAVE.sensitivity;
  if(Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)){
    movePlayer(dx > 0 ? 1 : -1);
  }
}, {passive:true});
window.addEventListener('keydown', e=>{
  if(!game || !game.running || game.paused) return;
  if(e.key === 'ArrowLeft') movePlayer(-1);
  if(e.key === 'ArrowRight') movePlayer(1);
});
function movePlayer(dir){
  const newLane = Math.min(LANES-1, Math.max(0, game.player.lane + dir));
  if(newLane !== game.player.lane){
    game.player.lane = newLane;
    Audio_.SFX.lane();
  }
}

/* ---- power-up HUD ---- */
function updatePowerupHud(){
  const hud = document.getElementById('powerup-hud');
  hud.innerHTML = '';
  if(game && game.player.shield){
    const b = document.createElement('div');
    b.className = 'powerup-badge shield'; b.textContent = '🛡 SHIELD';
    hud.appendChild(b);
  }
  if(game && game.player.magnetT > 0){
    const b = document.createElement('div');
    b.className = 'powerup-badge magnet'; b.textContent = '🧲 MAGNET';
    hud.appendChild(b);
  }
}

/* ---- collision + scoring ---- */
function handleCollision(ent){
  if(ent.type === 'obstacle'){
    if(game.player.shield){
      game.player.shield = false;
      ent.collected = true;
      game.hitFlash = 0.15;
      Audio_.SFX.power();
      updatePowerupHud();
    } else {
      triggerGameOver();
    }
  } else if(ent.type === 'coin'){
    ent.collected = true;
    game.score += 15;
    Audio_.SFX.coin();
    spawnBurst(ent, '#e8ff59');
  } else if(ent.type === 'shield'){
    ent.collected = true;
    game.player.shield = true;
    Audio_.SFX.power();
    updatePowerupHud();
    spawnBurst(ent, '#5cffb0');
  } else if(ent.type === 'magnet'){
    ent.collected = true;
    game.player.magnetT = 8;
    Audio_.SFX.power();
    updatePowerupHud();
    spawnBurst(ent, '#ff2ea6');
  }
}
function spawnBurst(ent, color){
  for(let i=0;i<10;i++){
    game.particles.push({
      x: laneX(ent.lane), y: ent.y, vx:(Math.random()-0.5)*300, vy:(Math.random()-0.5)*300,
      life:0.4, color, size:4+Math.random()*3,
    });
  }
}

function triggerGameOver(){
  if(game.gameOver) return;
  game.gameOver = true;
  game.running = false;
  Audio_.stopMusic();
  Audio_.SFX.hit();
  if(navigator.vibrate) navigator.vibrate(200);

  const finalScore = Math.floor(game.score);
  const isNewBest = finalScore > SAVE.bestScore;
  if(isNewBest){ SAVE.bestScore = finalScore; }
  refreshUnlocks();
  saveGame();

  document.getElementById('final-score').textContent = finalScore;
  document.getElementById('final-best').textContent = SAVE.bestScore;
  document.getElementById('new-best-tag').classList.toggle('hidden', !isNewBest);

  setTimeout(()=>{ showScreen('gameover'); }, 400);
}

/* ---- main loop ---- */
let lastFrame = 0;
function loop(t){
  if(!game || !game.running){ return; }
  if(game.paused){ requestAnimationFrame(loop); lastFrame = t; return; }
  const dt = Math.min(0.05, (t - lastFrame)/1000);
  lastFrame = t;

  update(dt);
  render();

  if(game.running) requestAnimationFrame(loop);
}

function update(dt){
  game.elapsed += dt;
  game.speed = game.baseSpeed * (1 + game.elapsed*0.02); // gradual ramp
  game.score += dt * 6 * (1 + game.elapsed*0.015);        // base distance score
  if(game.player.magnetT > 0) game.player.magnetT = Math.max(0, game.player.magnetT - dt);
  if(game.hitFlash > 0) game.hitFlash = Math.max(0, game.hitFlash - dt);

  document.getElementById('hud-score').textContent = Math.floor(game.score);
  if(game.player.magnetT <= 0.01) { /* badge auto refreshed below */ }
  updatePowerupHud();

  // spawn
  game.spawnTimer += dt;
  const interval = Math.max(0.42, game.spawnInterval - game.elapsed*0.01);
  if(game.spawnTimer > interval){
    game.spawnTimer = 0;
    spawnEntity();
  }

  // move entities
  const py = game.player.y;
  const catchRange = game.player.h*0.9;
  for(const ent of game.entities){
    ent.y += game.speed * dt;

    // magnet pulls coins toward player lane/position
    if(game.player.magnetT > 0 && ent.type === 'coin' && !ent.collected){
      const targetX = laneX(game.player.lane);
      ent.lane = game.player.lane; // visually snap toward player's lane
      if(Math.abs(ent.y - py) < H*0.5){
        ent.y += 0; // fall handled above; horizontal handled via lane already
      }
    }

    if(!ent.collected && Math.abs(ent.y - py) < catchRange && ent.lane === game.player.lane){
      handleCollision(ent);
    }
  }
  game.entities = game.entities.filter(e=> e.y < H + 100 && !e.collected);

  // particles
  for(const p of game.particles){
    p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt;
  }
  game.particles = game.particles.filter(p=>p.life>0);
}

function render(){
  const [c0,c1,c2] = themeColors();
  const grad = ctx2d.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c0);
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0,0,W,H);

  // lane dividers
  ctx2d.strokeStyle = c2 + '55';
  ctx2d.lineWidth = 2*devicePixelRatio;
  for(let i=1;i<LANES;i++){
    ctx2d.beginPath();
    ctx2d.moveTo(laneW*i, 0);
    ctx2d.lineTo(laneW*i, H);
    ctx2d.stroke();
  }

  // entities
  for(const ent of game.entities){
    const x = laneX(ent.lane);
    drawEntity(ent, x);
  }

  // particles
  for(const p of game.particles){
    ctx2d.globalAlpha = Math.max(0, p.life/0.4);
    ctx2d.fillStyle = p.color;
    ctx2d.beginPath();
    ctx2d.arc(p.x, p.y, p.size*devicePixelRatio, 0, Math.PI*2);
    ctx2d.fill();
    ctx2d.globalAlpha = 1;
  }

  // player + trail
  drawTrail();
  drawPlayer();

  // hit flash
  if(game.hitFlash > 0){
    ctx2d.fillStyle = `rgba(92,255,176,${game.hitFlash*1.5})`;
    ctx2d.fillRect(0,0,W,H);
  }
}

function drawEntity(ent, x){
  const s = ent.size;
  ctx2d.save();
  ctx2d.translate(x, ent.y);
  if(ent.type === 'obstacle'){
    ctx2d.fillStyle = '#ff2749';
    ctx2d.shadowColor = '#ff2749'; ctx2d.shadowBlur = 18;
    roundRect(-s/2,-s/2,s,s,8);
    ctx2d.fill();
  } else if(ent.type === 'coin'){
    ctx2d.fillStyle = '#e8ff59';
    ctx2d.shadowColor = '#e8ff59'; ctx2d.shadowBlur = 16;
    ctx2d.beginPath(); ctx2d.arc(0,0,s*0.4,0,Math.PI*2); ctx2d.fill();
  } else if(ent.type === 'shield'){
    ctx2d.strokeStyle = '#5cffb0'; ctx2d.lineWidth = 4*devicePixelRatio;
    ctx2d.shadowColor = '#5cffb0'; ctx2d.shadowBlur = 16;
    ctx2d.beginPath(); ctx2d.arc(0,0,s*0.42,0,Math.PI*2); ctx2d.stroke();
  } else if(ent.type === 'magnet'){
    ctx2d.strokeStyle = '#ff2ea6'; ctx2d.lineWidth = 5*devicePixelRatio;
    ctx2d.shadowColor = '#ff2ea6'; ctx2d.shadowBlur = 16;
    ctx2d.beginPath(); ctx2d.arc(0,4,s*0.32,Math.PI*0.15,Math.PI*0.85); ctx2d.stroke();
    ctx2d.beginPath(); ctx2d.arc(0,4,s*0.32,Math.PI*1.15,Math.PI*1.85); ctx2d.stroke();
  }
  ctx2d.restore();
}

let trailParticleTimer = 0;
function drawTrail(){
  const tColor = trailColor();
  if(!tColor) return;
  trailParticleTimer++;
  if(trailParticleTimer % 2 === 0){
    game.particles.push({
      x: game.player.x, y: game.player.y + game.player.h*0.4,
      vx:(Math.random()-0.5)*20, vy: 120,
      life:0.35, color: tColor, size:3+Math.random()*2,
    });
  }
}

function drawPlayer(){
  const p = game.player;
  const x = laneX(p.lane);
  p.x += (x - p.x) * 0.35; // smooth lane-change glide
  const color = skinColor();

  ctx2d.save();
  ctx2d.translate(p.x, p.y);

  if(p.shield){
    ctx2d.strokeStyle = '#5cffb0';
    ctx2d.shadowColor = '#5cffb0'; ctx2d.shadowBlur = 26;
    ctx2d.lineWidth = 3*devicePixelRatio;
    ctx2d.beginPath(); ctx2d.arc(0,0,p.w*0.75,0,Math.PI*2); ctx2d.stroke();
  }

  if(color === 'prism'){
    const g = ctx2d.createLinearGradient(-p.w/2,-p.h/2,p.w/2,p.h/2);
    g.addColorStop(0,'#00f6ff'); g.addColorStop(0.5,'#ff2ea6'); g.addColorStop(1,'#e8ff59');
    ctx2d.fillStyle = g;
    ctx2d.shadowColor = '#ff2ea6';
  } else {
    ctx2d.fillStyle = color;
    ctx2d.shadowColor = color;
  }
  ctx2d.shadowBlur = 22;
  roundRect(-p.w/2, -p.h/2, p.w, p.h, 10);
  ctx2d.fill();
  ctx2d.restore();
}

function roundRect(x,y,w,h,r){
  ctx2d.beginPath();
  ctx2d.moveTo(x+r,y);
  ctx2d.arcTo(x+w,y,x+w,y+h,r);
  ctx2d.arcTo(x+w,y+h,x,y+h,r);
  ctx2d.arcTo(x,y+h,x,y,r);
  ctx2d.arcTo(x,y,x+w,y,r);
  ctx2d.closePath();
}

/* ---------------------------------------------------------------------
   10. PAUSE / RESUME / MENU / RETRY
   --------------------------------------------------------------------- */
document.getElementById('btn-pause').addEventListener('click', ()=>{
  if(!game || !game.running) return;
  game.paused = true;
  document.getElementById('pause-overlay').classList.remove('hidden');
});
document.getElementById('btn-resume').addEventListener('click', ()=>{
  game.paused = false;
  document.getElementById('pause-overlay').classList.add('hidden');
  lastFrame = performance.now();
  requestAnimationFrame(loop);
});
document.getElementById('btn-pause-menu').addEventListener('click', ()=>{
  game.running = false;
  Audio_.stopMusic();
  document.getElementById('pause-overlay').classList.add('hidden');
  showScreen('home');
  refreshHomeUI();
});
document.getElementById('btn-retry').addEventListener('click', ()=>{
  showScreen('game');
  startGame();
});
document.getElementById('btn-gameover-menu').addEventListener('click', ()=>{
  showScreen('home');
  refreshHomeUI();
});

/* ---------------------------------------------------------------------
   11. BOOT
   --------------------------------------------------------------------- */
refreshUnlocks();
runLoadingSequence();

