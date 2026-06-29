// ── Crown of Ashes — Game Engine ──────────────────────────────
const W = 900, H = 620;
let canvas, ctx;

// ── Game state ─────────────────────────────────────────────────
let gameState = "idle";   // idle | playing | paused | gameover | win
let mode = "classic";     // classic | endless

let playerX, playerY, playerHP, playerMaxHP, playerInv;
let playerScore, mouseX, mouseY;
let shootingHeld, shootTimer;
let dashDX, dashDY, dashFrames, dashCD;
let skillGauge, ultGauge, ultActive, ultTimer, ultAngle;
let overheat, overheatLock;
let attackBoost, attackBoostTimer, shieldActive, shieldTimer;
let animTick;

let bullets, enemyBullets, enemies, drops;
let wave, enemiesToSpawn, spawnTimer;

// Endless mode
let endlessScore, endlessKills, endlessDifficulty;

// Boss
let boss;
let bossDropCD;

// Input
const keysHeld = new Set();
let selectedWeapon = null;
let playerName = "Knight";

// upgrade slots (endless)
let upgrades = { damage: 0, speed: 0, cooldown: 0, hp: 0 };

const MAX_WAVES = 5;
const DASH_SPEED = 12, DASH_FRAMES = 7, DASH_CD = 80;
const SKILL_MAX = 100, ULT_MAX = 100, ULT_DURATION = 120;
const BEAM_DMG_CD = 6, BOSS_DROP_CD = 300;

// ── Init ───────────────────────────────────────────────────────
function initGame(m) {
  canvas = document.getElementById("gameCanvas");
  ctx    = canvas.getContext("2d");
  mode   = m || "classic";

  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  canvas.addEventListener("mousedown", () => shootingHeld = true);
  canvas.addEventListener("mouseup",   () => shootingHeld = false);
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup",   e => keysHeld.delete(e.key));

  resetGame();
  gameState = "playing";
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  const w = selectedWeapon || WEAPONS[0];
  playerX = W / 2; playerY = H / 2;
  playerHP = 5 + upgrades.hp * 2;
  playerMaxHP = playerHP;
  playerInv = 0; playerScore = 0;
  shootingHeld = false; shootTimer = 0;
  mouseX = W / 2; mouseY = H / 2;
  dashDX = dashDY = 0; dashFrames = dashCD = 0;
  skillGauge = 0; ultGauge = 0; ultActive = false;
  ultTimer = 0; ultAngle = 0;
  overheat = 0; overheatLock = 0;
  attackBoost = 1 + upgrades.damage;
  attackBoostTimer = 0;
  shieldActive = false; shieldTimer = 0;
  animTick = 0;
  bullets = []; enemyBullets = []; enemies = []; drops = [];
  wave = 1; enemiesToSpawn = 0; spawnTimer = 0;
  bossDropCD = BOSS_DROP_CD;
  endlessScore = 0; endlessKills = 0; endlessDifficulty = 1;
  boss = { alive: false, hp: 0, maxHP: 0, x: W/2, y: 100,
           dir: 1, speed: 2, shootCD: 80, phase: 1 };
  startWave(1);
}

function dist2(x1,y1,x2,y2) { return (x1-x2)**2+(y1-y2)**2; }

// ── Wave ───────────────────────────────────────────────────────
function startWave(n) {
  const base = mode === "endless"
    ? Math.floor(3 * n * endlessDifficulty + 2)
    : n * 3 + 2;
  enemiesToSpawn = base;
  spawnTimer = 0;
}

function spawnEnemy() {
  const side = Math.random() * 4 | 0;
  let x, y;
  if      (side===0) { x = 50+Math.random()*(W-100); y = -20; }
  else if (side===1) { x = 50+Math.random()*(W-100); y = H+20; }
  else if (side===2) { x = -20; y = 50+Math.random()*(H-100); }
  else               { x = W+20; y = 50+Math.random()*(H-100); }

  const diff = endlessDifficulty;
  const shooterChance = mode==="endless" ? Math.min(0.7, 0.3+wave*0.05) : (wave>=3?0.4:0);
  const kind = Math.random() < shooterChance ? "shooter" : "chaser";
  enemies.push({
    x, y,
    hp: (kind==="chaser" ? 2 : 3) + Math.floor(diff*0.5),
    maxHP: (kind==="chaser" ? 2 : 3) + Math.floor(diff*0.5),
    kind,
    shootCD: 60+Math.random()*60,
    animOff: Math.random()*30|0,
    speed: (kind==="chaser" ? 1.2 : 0.65) * (1 + diff*0.05)
  });
}

function spawnBoss() {
  const diff = endlessDifficulty;
  const hp = mode==="endless" ? Math.floor(80 * diff) : 80;
  boss = { alive:true, hp, maxHP:hp, x:W/2, y:100,
           dir:1, speed:2, shootCD:80, phase:1 };
}

// ── Drops ──────────────────────────────────────────────────────
function maybeDrop(x, y, forced=false) {
  if (forced || Math.random()<0.35) {
    const kinds = ["hp","atk","shield"];
    drops.push({ x, y, kind: kinds[Math.random()*3|0], age:0 });
  }
}

function applyDrop(kind) {
  if (kind==="hp") playerHP = Math.min(playerMaxHP, playerHP+1);
  else if (kind==="atk") { attackBoost = 2+upgrades.damage; attackBoostTimer=600; }
  else if (kind==="shield") { shieldActive=true; shieldTimer=300; }
}

// ── Skills ─────────────────────────────────────────────────────
function fireSkill() {
  if (skillGauge < SKILL_MAX) return;
  skillGauge = 0;
  const w = selectedWeapon;

  if (w.skillType === "burst" || w.skillType === "nova") {
    const count = w.skillType==="nova" ? 16 : 8;
    for (let i=0;i<count;i++) {
      const a = (i/count)*Math.PI*2;
      bullets.push({ x:playerX, y:playerY,
        dx:Math.cos(a), dy:Math.sin(a), skill:true });
    }
  } else if (w.skillType === "pierce") {
    const adx=mouseX-playerX, ady=mouseY-playerY;
    const d=Math.hypot(adx,ady)||1;
    bullets.push({ x:playerX, y:playerY,
      dx:adx/d, dy:ady/d, skill:true, pierce:true });
  }
}

function fireUltimate() {
  if (ultGauge < ULT_MAX || ultActive) return;
  ultGauge = 0; ultActive = true; ultTimer = ULT_DURATION;
  const adx=mouseX-playerX, ady=mouseY-playerY;
  ultAngle = Math.atan2(ady, adx);

  if (selectedWeapon.ultType === "storm") {
    // dagger storm: spawn 12 bullets in circle immediately
    for (let i=0;i<12;i++) {
      const a=(i/12)*Math.PI*2;
      bullets.push({ x:playerX+Math.cos(a)*30, y:playerY+Math.sin(a)*30,
        dx:Math.cos(a), dy:Math.sin(a), skill:true });
    }
    ultActive = false; // storm is instant, no beam
  } else if (selectedWeapon.ultType === "volley") {
    // triple volley: 3 spread shots
    const base=Math.atan2(mouseY-playerY, mouseX-playerX);
    for (let i=-1;i<=1;i++) {
      const a=base+i*0.25;
      bullets.push({ x:playerX, y:playerY,
        dx:Math.cos(a), dy:Math.sin(a), skill:true });
    }
    ultActive = false;
  }
  // beam / default: handled in update loop
}

function beamHitsPoint(tx, ty) {
  const bLen=800, bHalf=20;
  const bx=Math.cos(ultAngle), by=Math.sin(ultAngle);
  const dx=tx-playerX, dy=ty-playerY;
  const along=dx*bx+dy*by;
  const perp=Math.abs(dx*(-by)+dy*bx);
  return along>=0 && along<=bLen && perp<=bHalf;
}

// ── Boss ───────────────────────────────────────────────────────
function updateBoss() {
  if (boss.hp <= boss.maxHP/2) { boss.phase=2; boss.speed=2.2; }
  boss.x += boss.dir * boss.speed;
  if (boss.x > W-60) boss.dir=-1;
  if (boss.x < 60)   boss.dir= 1;

  // Boss arena drops
  bossDropCD--;
  if (bossDropCD<=0) {
    maybeDrop(100+Math.random()*(W-200), 200+Math.random()*(H-350), true);
    bossDropCD = BOSS_DROP_CD;
  }

  boss.shootCD--;
  if (boss.shootCD<=0) {
    const base=Math.atan2(playerY-boss.y, playerX-boss.x);
    if (boss.phase===1) {
      for (let i=0;i<5;i++) {
        const t=(i/4)-0.5, a=base+t*0.7;
        enemyBullets.push({ x:boss.x, y:boss.y+30, dx:Math.cos(a), dy:Math.sin(a) });
      }
      boss.shootCD=90;
    } else {
      for (let i=0;i<7;i++) {
        const t=(i/6)-0.5, a=base+t*0.94;
        enemyBullets.push({ x:boss.x, y:boss.y+30, dx:Math.cos(a), dy:Math.sin(a) });
      }
      const d=Math.hypot(playerX-boss.x, playerY-boss.y)||1;
      enemyBullets.push({ x:boss.x, y:boss.y+30,
        dx:(playerX-boss.x)/d, dy:(playerY-boss.y)/d });
      boss.shootCD=60;
    }
  }
}

// ── Main update ────────────────────────────────────────────────
let beamDMGcd=0;
function update() {
  if (gameState!=="playing") return;
  animTick++;
  const w = selectedWeapon;
  const spd = 2.5 + upgrades.speed * 0.3;

  // Timers
  if (attackBoostTimer>0) { attackBoostTimer--; if(!attackBoostTimer) attackBoost=1+upgrades.damage; }
  if (shieldTimer>0)      { shieldTimer--;       if(!shieldTimer) shieldActive=false; }

  // Beam
  if (ultActive && (w.ultType==="beam")) {
    ultTimer--;
    beamDMGcd--;
    if (beamDMGcd<=0) {
      beamDMGcd=BEAM_DMG_CD;
      enemies.forEach(e=>{ if(beamHitsPoint(e.x,e.y)) { e.hp-=2; ultGauge=Math.min(ULT_MAX,ultGauge+1); if(e.hp<=0){e.dead=true;playerScore+=10+(mode==="endless"?wave*2:0);endlessKills++;maybeDrop(e.x,e.y);skillGauge=Math.min(SKILL_MAX,skillGauge+20);}} });
      enemies=enemies.filter(e=>!e.dead);
      if (boss.alive&&beamHitsPoint(boss.x,boss.y)) { boss.hp-=3; if(boss.hp<=0){boss.alive=false;playerScore+=300;} }
    }
    if (ultTimer<=0) ultActive=false;
  }

  // Movement
  if (dashFrames>0) {
    playerX=Math.max(20,Math.min(W-20,playerX+dashDX*DASH_SPEED));
    playerY=Math.max(20,Math.min(H-20,playerY+dashDY*DASH_SPEED));
    dashFrames--;
  } else {
    let dx=0, dy=0;
    if (keysHeld.has("w")||keysHeld.has("ArrowUp"))    dy-=1;
    if (keysHeld.has("s")||keysHeld.has("ArrowDown"))  dy+=1;
    if (keysHeld.has("a")||keysHeld.has("ArrowLeft"))  dx-=1;
    if (keysHeld.has("d")||keysHeld.has("ArrowRight")) dx+=1;
    if (dx&&dy) { dx*=0.707; dy*=0.707; }
    playerX=Math.max(20,Math.min(W-20,playerX+dx*spd));
    playerY=Math.max(20,Math.min(H-20,playerY+dy*spd));
  }
  if (dashCD>0) dashCD--;

  // Overheat
  if (w.heatPerShot>0) {
    if (overheatLock>0) overheatLock--;
    else if (!shootingHeld&&overheat>0) overheat=Math.max(0,overheat-w.heatCool);
  }

  // Shoot
  if (!ultActive && shootingHeld && shootTimer===0 && overheatLock===0) {
    const adx=mouseX-playerX, ady=mouseY-playerY;
    const d=Math.hypot(adx,ady)||1;
    const fr = Math.max(3, w.fireRate - upgrades.cooldown*2);

    if (w.spread) {
      for (let s=-1;s<=1;s+=2) {
        const a=Math.atan2(ady,adx)+s*0.12;
        bullets.push({ x:playerX, y:playerY, dx:Math.cos(a), dy:Math.sin(a), skill:false });
      }
    } else {
      bullets.push({ x:playerX, y:playerY, dx:adx/d, dy:ady/d, skill:false });
    }

    shootTimer = fr;
    if (w.heatPerShot>0) {
      overheat=Math.min(100,overheat+w.heatPerShot);
      if (overheat>=100) { overheatLock=w.overheatLock; overheat=100; }
    }
  }
  if (shootTimer>0) shootTimer--;

  // Homing (spellstaff)
  if (w.homing) {
    bullets.forEach(b=>{
      if (b.skill) return;
      let nearest=null, nd=Infinity;
      enemies.forEach(e=>{ const d=dist2(b.x,b.y,e.x,e.y); if(d<nd){nd=d;nearest=e;} });
      if (nearest&&nd<90000) {
        const ad=Math.atan2(nearest.y-b.y,nearest.x-b.x);
        const ca=Math.atan2(b.dy,b.dx);
        let diff=ad-ca; while(diff>Math.PI)diff-=2*Math.PI; while(diff<-Math.PI)diff+=2*Math.PI;
        const na=ca+Math.sign(diff)*Math.min(0.08,Math.abs(diff));
        b.dx=Math.cos(na); b.dy=Math.sin(na);
      }
    });
  }

  // Spawn
  if (enemiesToSpawn>0) {
    spawnTimer++;
    const spawnInterval = Math.max(30, 55 - wave);
    if (spawnTimer>=spawnInterval) { spawnEnemy(); enemiesToSpawn--; spawnTimer=0; }
  }

  // Move enemies
  enemies.forEach(e=>{
    const edx=playerX-e.x, edy=playerY-e.y;
    const d=Math.hypot(edx,edy)||1;
    e.x+=(edx/d)*e.speed; e.y+=(edy/d)*e.speed;
    if (e.kind==="shooter") {
      e.shootCD--;
      if (e.shootCD<=0&&d>0) {
        enemyBullets.push({ x:e.x, y:e.y, dx:edx/d, dy:edy/d });
        e.shootCD=80+Math.random()*60;
      }
    }
  });

  if (boss.alive) updateBoss();

  // Move bullets
  const bspd = (w.bulletSpeed * 0.6) + upgrades.speed*0.3;
  bullets.forEach(b=>{      b.x+=b.dx*bspd; b.y+=b.dy*bspd; });
  enemyBullets.forEach(b=>{ b.x+=b.dx*3.5;  b.y+=b.dy*3.5;  });
  bullets      =bullets.filter(b=>b.x>-10&&b.x<W+10&&b.y>-10&&b.y<H+10);
  enemyBullets =enemyBullets.filter(b=>b.x>-10&&b.x<W+10&&b.y>-10&&b.y<H+10);

  // Collisions: player bullets vs enemies
  const dmg = attackBoost;
  bullets.forEach(b=>{
    if (b.hit) return;
    enemies.forEach(e=>{
      if (e.dead||b.hit) return;
      if (dist2(b.x,b.y,e.x,e.y)<400) {
        if (!b.pierce) b.hit=true;
        e.hp-=dmg;
        skillGauge=Math.min(SKILL_MAX,skillGauge+5);
        ultGauge  =Math.min(ULT_MAX,  ultGauge+3);
        if (e.hp<=0) {
          e.dead=true;
          playerScore+=10+(mode==="endless"?wave*2:0);
          endlessKills++;
          skillGauge=Math.min(SKILL_MAX,skillGauge+20);
          ultGauge  =Math.min(ULT_MAX,  ultGauge+12);
          maybeDrop(e.x,e.y);
        }
      }
    });
  });
  bullets  =bullets.filter(b=>!b.hit);
  enemies  =enemies.filter(e=>!e.dead);

  // Collisions: bullets vs boss
  if (boss.alive) {
    bullets.forEach(b=>{
      if (b.hit) return;
      if (dist2(b.x,b.y,boss.x,boss.y)<1600) {
        if (!b.pierce) b.hit=true;
        boss.hp-=dmg;
        skillGauge=Math.min(SKILL_MAX,skillGauge+5);
        ultGauge  =Math.min(ULT_MAX,  ultGauge+3);
        if (boss.hp<=0) { boss.alive=false; playerScore+=300; }
      }
    });
    bullets=bullets.filter(b=>!b.hit);
  }

  // Enemy bullets vs player
  if (playerInv===0&&dashFrames===0&&!ultActive) {
    for (const b of enemyBullets) {
      if (b.hit) continue;
      if (dist2(b.x,b.y,playerX,playerY)<324) {
        b.hit=true;
        if (shieldActive) { shieldActive=false; shieldTimer=0; }
        else { playerHP--; playerInv=60; }
        break;
      }
    }
    enemyBullets=enemyBullets.filter(b=>!b.hit);
  }

  // Enemy body vs player
  if (playerInv===0&&dashFrames===0&&!ultActive) {
    for (const e of enemies) {
      if (dist2(e.x,e.y,playerX,playerY)<625) {
        if (shieldActive) { shieldActive=false; shieldTimer=0; }
        else playerHP--;
        playerInv=60; break;
      }
    }
  }
  if (playerInv>0) playerInv--;

  // Drops pickup
  drops.forEach(d=>{ d.age++; if(dist2(d.x,d.y,playerX,playerY)<625){applyDrop(d.kind);d.collected=true;} });
  drops=drops.filter(d=>!d.collected&&d.age<600);

  // Wave progression
  if (enemies.length===0&&enemiesToSpawn===0) {
    if (!boss.alive&&boss.maxHP===0) {
      if (mode==="classic") {
        if (wave<MAX_WAVES) { wave++; startWave(wave); }
        else spawnBoss();
      } else {
        // Endless: every 5 waves is a boss wave
        wave++;
        if (wave%5===0) { endlessDifficulty+=0.3; spawnBoss(); }
        else startWave(wave);
      }
    }
  }

  // Win / lose
  if (!boss.alive&&boss.maxHP>0) {
    if (mode==="classic") { gameState="win"; submitScore(); }
    else { boss={alive:false,hp:0,maxHP:0,x:W/2,y:100,dir:1,speed:2,shootCD:80,phase:1}; startWave(wave); }
  }
  if (playerHP<=0) { gameState="gameover"; submitScore(); }
}

// ── Input ──────────────────────────────────────────────────────
function keyDown(e) {
  keysHeld.add(e.key);
  if (gameState!=="playing") {
    if ((e.key==="r"||e.key==="R")&&(gameState==="gameover"||gameState==="win")) {
      resetGame(); gameState="playing";
    }
    if (e.key==="Escape") showScreen("nameScreen");
    return;
  }
  if ((e.key==="Shift"||e.key==="ShiftLeft"||e.key==="ShiftRight")&&dashCD===0&&dashFrames===0) {
    let dx=0,dy=0;
    if(keysHeld.has("w")||keysHeld.has("ArrowUp"))   dy-=1;
    if(keysHeld.has("s")||keysHeld.has("ArrowDown")) dy+=1;
    if(keysHeld.has("a")||keysHeld.has("ArrowLeft")) dx-=1;
    if(keysHeld.has("d")||keysHeld.has("ArrowRight"))dx+=1;
    if(!dx&&!dy) dx=1;
    const d=Math.hypot(dx,dy)||1;
    dashDX=dx/d; dashDY=dy/d; dashFrames=DASH_FRAMES; dashCD=DASH_CD;
  }
  if (e.key==="e"||e.key==="E") fireSkill();
  if (e.key==="q"||e.key==="Q") fireUltimate();
  if (e.key==="Escape") { gameState="gameover"; showScreen("nameScreen"); }
}

// ── Submit score ───────────────────────────────────────────────
async function submitScore() {
  try {
    await fetch("http://localhost:5000/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: playerName,
        score: playerScore,
        wave,
        weapon: selectedWeapon?.id || "longbow",
        mode,
        kills: endlessKills
      })
    });
  } catch(err) { /* backend offline — silent fail */ }
}

// ── Game loop (fixed 60 fps timestep) ─────────────────────────
// This ensures the game runs at the same speed on all monitors
// (60Hz, 120Hz, 144Hz, etc.) by accumulating real elapsed time
// and only ticking the logic forward in fixed 16.67ms steps.
const FIXED_DT = 1000 / 60;   // 16.667 ms per logic tick
let lastTime   = 0;
let accumulator = 0;

function gameLoop(ts) {
  const elapsed = ts - lastTime;
  lastTime = ts;

  // Cap elapsed to 200ms so a tab-switch / freeze doesn't cause
  // a huge burst of catch-up ticks when the player returns.
  accumulator += Math.min(elapsed, 200);

  while (accumulator >= FIXED_DT) {
    update();
    accumulator -= FIXED_DT;
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ── Drawing ────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0,0,W,H);
  drawFloor();

  if (gameState==="playing"||gameState==="gameover"||gameState==="win") {
    drops.forEach(drawDrop);
    enemies.forEach(e=>{ if(e.kind==="chaser") drawGoblin(e); else drawArcher(e); });
    if (boss.alive) drawBoss();
    if (ultActive && selectedWeapon.ultType==="beam") drawBeam();
    bullets.forEach(drawBullet);
    enemyBullets.forEach(drawEnemyBullet);
    if (playerInv===0||(animTick/4|0)%2===0) drawPlayer();
    drawHUD();
  }

  if (gameState==="gameover") drawOverlay("gameover");
  if (gameState==="win")      drawOverlay("win");
}

function drawFloor() {
  const T=40;
  for (let r=0;r<Math.ceil(H/T)+1;r++) {
    for (let c=0;c<Math.ceil(W/T)+1;c++) {
      ctx.fillStyle=(r+c)%2===0?"#1c1208":"#201508";
      ctx.fillRect(c*T,r*T,T,T);
      ctx.strokeStyle="#2a1c0a"; ctx.lineWidth=0.5;
      ctx.strokeRect(c*T,r*T,T,T);
    }
  }
}

function drawPlayer() {
  const t=animTick, bob=Math.sin(t*0.15)*2|0;
  const px=playerX|0, py=(playerY+bob)|0;
  const outline=dashFrames>0?"#ffe066":"#a08030";

  // Legs
  ctx.strokeStyle="#5a4a20"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(px-5,py+10); ctx.lineTo(px-5,py+10+((t/8|0)%2===0?8:4)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+5,py+10); ctx.lineTo(px+5,py+10+((t/8|0)%2===0?4:8)); ctx.stroke();

  // Body / shield
  ctx.fillStyle="#3a2a10"; ctx.strokeStyle=outline; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(px,py,13,9,0,0,Math.PI*2); ctx.fill(); ctx.stroke();

  // Shield cross
  ctx.strokeStyle=outline; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(px,py-5); ctx.lineTo(px,py+8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px-7,py+1); ctx.lineTo(px+7,py+1); ctx.stroke();

  // Helmet
  ctx.fillStyle="#5a4a20"; ctx.strokeStyle=outline; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(px,py-14,8,6,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle=outline; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(px-5,py-14); ctx.lineTo(px+5,py-14); ctx.stroke();

  // Shield glint
  if ((t/5|0)%3===0) {
    ctx.fillStyle="#fff8cc";
    ctx.beginPath(); ctx.ellipse(px-3,py-1,2,3,0,0,Math.PI*2); ctx.fill();
  }

  // Shield aura (if shield active)
  if (shieldActive) {
    const r=20+Math.sin(t*0.2)*3;
    ctx.strokeStyle="#4466ff"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.stroke();
  }
}

function drawGoblin(e) {
  const t=animTick+e.animOff;
  const cx=e.x|0, cy=(e.y+Math.sin(t*0.2)*3)|0;
  const arm=Math.sin(t*0.2)*6;

  ctx.fillStyle="#2a4a10"; ctx.strokeStyle="#5aaa20"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(cx,cy,12,9,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx,cy-15,8,7,0,0,Math.PI*2); ctx.fill(); ctx.stroke();

  // Ears
  ctx.beginPath(); ctx.ellipse(cx-10,cy-17,4,3,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx+10,cy-17,4,3,0,0,Math.PI*2); ctx.fill(); ctx.stroke();

  // Eyes
  const eyeH=(t/30|0)%10===0?1:3;
  ctx.fillStyle="#ffee00";
  ctx.beginPath(); ctx.ellipse(cx-4,cy-16,2,eyeH,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+4,cy-16,2,eyeH,0,0,Math.PI*2); ctx.fill();

  // Arms
  ctx.strokeStyle="#2a4a10"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(cx-12,cy-2); ctx.lineTo(cx-18,cy-2+arm); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+12,cy-2); ctx.lineTo(cx+18,cy-2-arm); ctx.stroke();
}

function drawArcher(e) {
  const t=animTick+e.animOff;
  const cx=e.x|0, cy=e.y|0;
  const sway=Math.sin(t*0.1)*2|0;
  const drawPhase=(t/15|0)%2;

  ctx.fillStyle="#1a0830"; ctx.strokeStyle="#8844cc"; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(cx-14+sway,cy+12); ctx.lineTo(cx+14+sway,cy+12);
  ctx.lineTo(cx+10,cy-10); ctx.lineTo(cx-10,cy-10);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.beginPath(); ctx.ellipse(cx,cy,10,10,0,0,Math.PI*2);
  ctx.fillStyle="#2a1040"; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx,cy-15,8,7,0,0,Math.PI*2);
  ctx.fillStyle="#1a0830"; ctx.fill(); ctx.stroke();

  // Eye slit
  ctx.strokeStyle="#cc44ff"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx-4,cy-15); ctx.lineTo(cx+4,cy-15); ctx.stroke();

  // Bow
  const bowX=cx+(drawPhase===0?12:16);
  ctx.strokeStyle="#8a6020"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(bowX,cy,8,-Math.PI/2,Math.PI/2); ctx.stroke();
  if (drawPhase===1) {
    ctx.strokeStyle="#c8a060"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bowX,cy); ctx.lineTo(cx+8,cy); ctx.stroke();
  }
}

function drawBoss() {
  const t=animTick;
  const bx=boss.x|0, by=boss.y|0;
  const pulse=Math.sin(t*0.12)*3|0;
  const billow=Math.sin(t*0.08)*5|0;
  const p=boss.phase;
  const bodyCol=p===2?"#cc2200":"#6622aa";
  const eyeCol =p===2?"#ff6600":"#cc44ff";

  // Cloak
  ctx.fillStyle="#0a0408"; ctx.strokeStyle=bodyCol; ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(bx-44,by+28); ctx.lineTo(bx-50+billow,by+55);
  ctx.lineTo(bx+50-billow,by+55); ctx.lineTo(bx+44,by+28);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Body
  ctx.fillStyle="#100808"; ctx.strokeStyle=bodyCol; ctx.lineWidth=3;
  ctx.beginPath(); ctx.ellipse(bx,by+pulse,44,28,0,0,Math.PI*2); ctx.fill(); ctx.stroke();

  // Crown spikes
  for (let i=0;i<5;i++) {
    const sx=bx-32+i*16;
    const tipY=by-44-pulse-(i===2?4:0);
    ctx.fillStyle="#ffd700"; ctx.strokeStyle="#aa8800"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(sx,by-28+pulse); ctx.lineTo(sx-6,tipY); ctx.lineTo(sx+6,tipY); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // Eyes
  const glowR=8+Math.sin(t*0.2)*2;
  [-18,0,18].forEach(ex=>{
    ctx.fillStyle=eyeCol;
    ctx.beginPath(); ctx.ellipse(bx+ex,by-2+pulse,glowR,glowR,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="white";
    ctx.beginPath(); ctx.ellipse(bx+ex,by-2+pulse,3,3,0,0,Math.PI*2); ctx.fill();
  });

  // Arms
  ctx.strokeStyle=bodyCol; ctx.lineWidth=2;
  for (let i=0;i<4;i++) {
    const tx=bx-28+i*18, wig=Math.sin(t*0.15+i)*5|0;
    ctx.beginPath(); ctx.moveTo(tx,by+28+pulse); ctx.lineTo(tx+wig,by+50); ctx.stroke();
  }

  // Phase 2 fire sparks
  if (p===2) {
    const sparks=["#ff4400","#ff8800","#ffcc00"];
    for (let i=0;i<8;i++) {
      ctx.fillStyle=sparks[i%3];
      const ax=bx+(Math.random()*110-55)|0, ay=by+(Math.random()*75-37)|0;
      const r=2+Math.random()*4;
      ctx.beginPath(); ctx.arc(ax,ay,r,0,Math.PI*2); ctx.fill();
    }
  }

  // HP bar
  const bw=W-40, filled=(bw*Math.max(0,boss.hp)/boss.maxHP)|0;
  ctx.fillStyle="#1a0505"; ctx.fillRect(20,8,bw,14);
  ctx.fillStyle=p===2?"#cc2200":"#6622aa"; ctx.fillRect(20,8,filled,14);
  ctx.strokeStyle="#553333"; ctx.lineWidth=1; ctx.strokeRect(20,8,bw,14);
  ctx.fillStyle="#ffd700"; ctx.font="bold 8px 'Courier New'"; ctx.textAlign="center";
  ctx.fillText("THE SHADOW KING",W/2,19);
}

function drawBeam() {
  const t=animTick;
  const blen=800;
  const ex=playerX+Math.cos(ultAngle)*blen;
  const ey=playerY+Math.sin(ultAngle)*blen;

  ctx.strokeStyle="#ffaa0044"; ctx.lineWidth=30;
  ctx.beginPath(); ctx.moveTo(playerX,playerY); ctx.lineTo(ex,ey); ctx.stroke();
  ctx.strokeStyle="#ffe06688"; ctx.lineWidth=14;
  ctx.beginPath(); ctx.moveTo(playerX,playerY); ctx.lineTo(ex,ey); ctx.stroke();
  ctx.strokeStyle="#ffffff"; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(playerX,playerY); ctx.lineTo(ex,ey); ctx.stroke();

  // Flare
  const fr=18+Math.sin(t*0.4)*6;
  ctx.strokeStyle="#ffe066"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(playerX,playerY,fr,0,Math.PI*2); ctx.stroke();

  // Sparkles
  const sparks=["#ffffff","#ffe066","#ffcc00"];
  for (let i=0;i<5;i++) {
    const dist=30+Math.random()*(blen-20);
    const perp=(Math.random()-0.5)*24;
    const sx=playerX+Math.cos(ultAngle)*dist+Math.cos(ultAngle+Math.PI/2)*perp;
    const sy=playerY+Math.sin(ultAngle)*dist+Math.sin(ultAngle+Math.PI/2)*perp;
    ctx.fillStyle=sparks[i%3];
    ctx.beginPath(); ctx.arc(sx,sy,1+Math.random()*3,0,Math.PI*2); ctx.fill();
  }

  ctx.fillStyle="#ffe066"; ctx.font="bold 13px 'Courier New'"; ctx.textAlign="center";
  ctx.fillText("✦ SACRED BEAM ✦",W/2,H/2-60);
}

function drawBullet(b) {
  const cx=b.x|0, cy=b.y|0;
  const angle=Math.atan2(b.dy,b.dx);
  const col=b.skill?"#ffe066":(selectedWeapon?.bulletColor||"#ffd700");
  const sz =selectedWeapon?.bulletSize||5;

  ctx.strokeStyle=col; ctx.lineWidth=sz-1;
  ctx.beginPath();
  ctx.moveTo(cx-Math.cos(angle)*sz,cy-Math.sin(angle)*sz);
  ctx.lineTo(cx+Math.cos(angle)*sz,cy+Math.sin(angle)*sz);
  ctx.stroke();
  ctx.fillStyle="#ffaa00";
  ctx.beginPath(); ctx.arc(cx,cy,2,0,Math.PI*2); ctx.fill();
}

function drawEnemyBullet(b) {
  ctx.fillStyle="#cc2266"; ctx.strokeStyle="#ff44aa"; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(b.x|0,b.y|0,5,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle="#ffaacc";
  ctx.beginPath(); ctx.arc(b.x|0,b.y|0,2,0,Math.PI*2); ctx.fill();
}

function drawDrop(d) {
  const t=animTick, bob=Math.sin(t*0.1+d.age*0.05)*3|0;
  const dx=d.x|0, dy=d.y+bob|0;
  if (d.kind==="hp") {
    ctx.fillStyle="#cc2222"; ctx.strokeStyle="#ff4444"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(dx-4,dy-3,4,4,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(dx+4,dy-3,4,4,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx-7,dy); ctx.lineTo(dx,dy+8); ctx.lineTo(dx+7,dy); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (d.kind==="atk") {
    ctx.strokeStyle="#ffd700"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(dx,dy-10); ctx.lineTo(dx,dy+8); ctx.stroke();
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(dx-6,dy-4); ctx.lineTo(dx+6,dy-4); ctx.stroke();
    ctx.fillStyle="#aa8800";
    ctx.beginPath(); ctx.arc(dx,dy+9,2,0,Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle="#2244cc"; ctx.strokeStyle="#6688ff"; ctx.lineWidth=1;
    ctx.beginPath();
    const pts=[[0,-10],[9,-4],[9,4],[0,10],[-9,4],[-9,-4]];
    ctx.moveTo(dx+pts[0][0],dy+pts[0][1]);
    pts.slice(1).forEach(p=>ctx.lineTo(dx+p[0],dy+p[1]));
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle="#6688ff"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(dx,dy-6); ctx.lineTo(dx,dy+6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(dx-5,dy); ctx.lineTo(dx+5,dy); ctx.stroke();
  }
}

function drawHUD() {
  const hudY=boss.alive?32:10;
  const w=selectedWeapon;

  // HP hearts
  for (let i=0;i<playerMaxHP;i++) {
    const col=i<playerHP?"#cc2222":"#2a1010";
    const hx=12+i*22, hy=hudY;
    ctx.fillStyle=col; ctx.strokeStyle="#884444"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(hx+4,hy+4,4,4,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx+10,hy+4,4,4,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx,hy+5); ctx.lineTo(hx+7,hy+14); ctx.lineTo(hx+14,hy+5); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }

  // Status badges
  let badgeY=hudY+20;
  if (shieldActive) {
    ctx.fillStyle="#6688ff"; ctx.font="bold 9px 'Courier New'";
    ctx.textAlign="left"; ctx.fillText(`SHIELD ${(shieldTimer/60+1)|0}s`,12,badgeY); badgeY+=14;
  }
  if (attackBoostTimer>0) {
    ctx.fillStyle="#ffd700"; ctx.font="bold 9px 'Courier New'";
    ctx.textAlign="left"; ctx.fillText(`ATK x2 ${(attackBoostTimer/60+1)|0}s`,12,badgeY);
  }

  // Score / wave
  ctx.fillStyle="#ffd700"; ctx.font="bold 11px 'Courier New'"; ctx.textAlign="right";
  ctx.fillText(`SCORE: ${playerScore}`,W-12,hudY+12);
  if (mode==="endless") {
    ctx.fillStyle="#c8a060"; ctx.font="bold 10px 'Courier New'"; ctx.textAlign="right";
    ctx.fillText(`KILLS: ${endlessKills}  WAVE: ${wave}`,W-12,hudY+26);
  } else if (!boss.alive&&boss.maxHP===0) {
    ctx.fillStyle="#e8c060"; ctx.font="bold 11px 'Courier New'"; ctx.textAlign="center";
    ctx.fillText(`WAVE ${wave} / ${MAX_WAVES}`,W/2,14);
  }

  // Skill gauge (E)
  const sg_x=W/2-60, sg_y=H-60;
  ctx.fillStyle="#1a1205"; ctx.fillRect(sg_x,sg_y,120,11);
  ctx.strokeStyle="#6a4a10"; ctx.lineWidth=1; ctx.strokeRect(sg_x,sg_y,120,11);
  ctx.fillStyle=skillGauge>=SKILL_MAX?"#ffe066":"#aa7700";
  ctx.fillRect(sg_x,sg_y,120*skillGauge/SKILL_MAX,11);
  ctx.fillStyle=skillGauge>=SKILL_MAX?"#ffe066":"#806040";
  ctx.font="bold 8px 'Courier New'"; ctx.textAlign="center";
  ctx.fillText(skillGauge>=SKILL_MAX?"E — READY!":`SKILL [${skillGauge}%]`,W/2,sg_y-5);

  // Ult gauge (Q)
  const ug_x=W/2-60, ug_y=H-44;
  ctx.fillStyle="#0a0818"; ctx.fillRect(ug_x,ug_y,120,11);
  ctx.strokeStyle="#442266"; ctx.lineWidth=1; ctx.strokeRect(ug_x,ug_y,120,11);
  const ultReady=ultGauge>=ULT_MAX&&!ultActive;
  ctx.fillStyle=ultReady?"#cc88ff":"#6622aa";
  ctx.fillRect(ug_x,ug_y,120*ultGauge/ULT_MAX,11);
  ctx.fillStyle=ultActive?"#ffffff":ultReady?"#cc88ff":"#553377";
  ctx.font="bold 8px 'Courier New'"; ctx.textAlign="center";
  ctx.fillText(ultActive?`BEAM ${(ultTimer/10+1)|0}`:ultReady?"Q — BEAM READY!":`BEAM [${ultGauge}%]`,W/2,ug_y-5);

  // Overheat gauge (only if weapon uses heat)
  if (w.heatPerShot>0) {
    const oh_x=W-134, oh_y=H-44;
    ctx.fillStyle="#1a0a05"; ctx.fillRect(oh_x,oh_y,122,11);
    ctx.strokeStyle="#553311"; ctx.lineWidth=1; ctx.strokeRect(oh_x,oh_y,122,11);
    ctx.fillStyle=overheatLock>0?"#ff2200":overheat>60?"#ff6600":"#cc3300";
    ctx.fillRect(oh_x,oh_y,122*overheat/100,11);
    ctx.fillStyle=overheatLock>0?"#ff2200":"#804030";
    ctx.font="bold 8px 'Courier New'"; ctx.textAlign="center";
    ctx.fillText(overheatLock>0?"OVERHEATED!":"HEAT",oh_x+61,oh_y-5);
  }

  // Dash bar
  const dash_x=W-134, dash_y=H-28;
  const dashPct=1-(dashCD/DASH_CD);
  ctx.fillStyle="#1a1205"; ctx.fillRect(dash_x,dash_y,122,11);
  ctx.strokeStyle="#554422"; ctx.lineWidth=1; ctx.strokeRect(dash_x,dash_y,122,11);
  ctx.fillStyle="#e8a020"; ctx.fillRect(dash_x,dash_y,122*dashPct,11);
  ctx.fillStyle="#806040"; ctx.font="8px 'Courier New'"; ctx.textAlign="center";
  ctx.fillText("ROLL [SHIFT]",dash_x+61,dash_y-4);

  // Controls hint
  ctx.fillStyle="#604830"; ctx.font="8px 'Courier New'"; ctx.textAlign="left";
  ctx.fillText("WASD:Move  Click:Shoot  Shift:Roll  E:Skill  Q:Beam  Esc:Exit",10,H-8);

  // Endless mode: upgrade prompt
  if (mode==="endless"&&enemies.length===0&&enemiesToSpawn===0&&!boss.alive) {
    ctx.fillStyle="#ffd70099"; ctx.font="bold 13px 'Courier New'"; ctx.textAlign="center";
    ctx.fillText("Wave clear! Next wave incoming...",W/2,H/2);
  }
}

function drawOverlay(type) {
  ctx.fillStyle="rgba(0,0,0,0.72)";
  ctx.fillRect(0,0,W,H);

  if (type==="gameover") {
    ctx.fillStyle="#cc2222"; ctx.font="bold 36px 'Courier New'"; ctx.textAlign="center";
    ctx.fillText("THOU HAST FALLEN",W/2,H/2-80);
    ctx.fillStyle="#8844cc"; ctx.font="12px 'Courier New'";
    ctx.fillText("SAGE: ...Sir Aerin? Can you hear me?",W/2,H/2-40);
    ctx.fillStyle="#e0c080"; ctx.font="bold 15px 'Courier New'";
    ctx.fillText(`Score: ${playerScore}`,W/2,H/2);
    ctx.fillStyle="#664422"; ctx.font="12px 'Courier New'";
    ctx.fillText(`Wave reached: ${wave}`,W/2,H/2+30);
  } else {
    ctx.fillStyle="#ffd700"; ctx.font="bold 36px 'Courier New'"; ctx.textAlign="center";
    ctx.fillText("THE REALM IS SAVED!",W/2,H/2-80);
    ctx.fillStyle="#80ddaa"; ctx.font="12px 'Courier New'";
    ctx.fillText("SAGE: The Shadow King is no more.",W/2,H/2-40);
    ctx.fillStyle="#ffd700"; ctx.font="bold 17px 'Courier New'";
    ctx.fillText(`Final Score: ${playerScore}`,W/2,H/2+10);
  }

  ctx.fillStyle="#ff8c1e"; ctx.font="bold 12px 'Courier New'"; ctx.textAlign="center";
  ctx.fillText("R — Try Again       Esc — Exit",W/2,H/2+70);
}
