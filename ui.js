// ── UI Logic ──────────────────────────────────────────────────

// ── Screen switching ───────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (id==="nameScreen")      loadPreviewLeaderboard();
  if (id==="leaderboardScreen") loadLeaderboard("endless");
  if (id==="weaponScreen")    buildWeaponGrid();
}

// ── Name entry ─────────────────────────────────────────────────
function submitName() {
  const input = document.getElementById("nameInput").value.trim();
  if (!input) { document.getElementById("nameInput").focus(); return; }
  playerName = input;
  showScreen("weaponScreen");
}

document.getElementById("nameInput").addEventListener("keydown", e=>{
  if (e.key==="Enter") submitName();
});

// ── Weapon grid ────────────────────────────────────────────────
function buildWeaponGrid() {
  const grid = document.getElementById("weaponGrid");
  grid.innerHTML = "";
  WEAPONS.forEach(w=>{
    const card = document.createElement("div");
    card.className = "weapon-card";
    card.innerHTML = `<div class="weapon-icon">${w.icon}</div><div class="weapon-name">${w.name}</div>`;
    card.addEventListener("mouseenter", ()=>showWeaponDesc(w));
    card.addEventListener("click", ()=>selectWeapon(w, card));
    grid.appendChild(card);
  });
}

function showWeaponDesc(w) {
  document.getElementById("weaponDescName").textContent = `${w.icon}  ${w.name.toUpperCase()}`;
  document.getElementById("weaponDescText").textContent = w.desc;
  const statsEl = document.getElementById("weaponStats");
  statsEl.innerHTML = Object.entries(w.stats)
    .map(([k,v])=>`<span class="stat-pill">${k}: ${v}</span>`).join("");
}

function selectWeapon(w, card) {
  selectedWeapon = w;
  document.querySelectorAll(".weapon-card").forEach(c=>c.classList.remove("selected"));
  card.classList.add("selected");
  const btn = document.getElementById("startBtn");
  btn.textContent = `Begin as ${w.name} — Choose Mode`;
  btn.disabled = false;
  showWeaponDesc(w);
  // Show mode selection
  showModeButtons();
}

function showModeButtons() {
  let modeDiv = document.getElementById("modeButtons");
  if (!modeDiv) {
    modeDiv = document.createElement("div");
    modeDiv.id = "modeButtons";
    modeDiv.style.cssText = "display:flex;gap:12px;justify-content:center;width:100%";
    document.getElementById("startBtn").insertAdjacentElement("afterend", modeDiv);
  }
  modeDiv.innerHTML = `
    <button onclick="startGame('classic')" style="flex:1">⚔ Classic Mode<br><small style="font-weight:normal;font-size:0.7rem;letter-spacing:1px">5 waves + boss</small></button>
    <button onclick="startGame('endless')" style="flex:1;background:#4A1A7A;border-color:#7A3AAA">♾ Endless Mode<br><small style="font-weight:normal;font-size:0.7rem;letter-spacing:1px">How far can you go?</small></button>
  `;
}

function startGame(m) {
  if (!selectedWeapon) return;
  mode = m || "classic";
  showScreen("gameScreen");
  initGame(mode);
}

// ── Leaderboard ────────────────────────────────────────────────
let currentTab = "endless";

function switchTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll(".lb-tab").forEach(t=>t.classList.remove("active"));
  el.classList.add("active");
  loadLeaderboard(tab);
}

async function loadLeaderboard(tab) {
  const el = document.getElementById("lbTable");
  if (!el) return;
  el.innerHTML = `<div class="lb-empty">Loading...</div>`;
  try {
    const res  = await fetch(`https://crown-of-ashes.onrender.com /api/scores?mode=${tab}`);
    const data = await res.json();
    renderLeaderboard(data.scores || [], el);
  } catch {
    el.innerHTML = `<div class="lb-empty">Could not connect to server.<br>Make sure the backend is running.</div>`;
  }
}

function renderLeaderboard(scores, el) {
  if (!scores.length) {
    el.innerHTML = `<div class="lb-empty">No scores yet — be the first knight!</div>`; return;
  }
  const rankClass = i => i===0?"rank-gold":i===1?"rank-silver":i===2?"rank-bronze":"";
  const badge     = i => i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`;
  el.innerHTML = `
    <table class="lb-table">
      <thead><tr>
        <th>#</th><th>Knight</th><th>Score</th><th>Wave</th><th>Weapon</th><th>Kills</th>
      </tr></thead>
      <tbody>
        ${scores.map((s,i)=>`
          <tr class="${rankClass(i)}">
            <td><span class="rank-badge">${badge(i)}</span></td>
            <td>${s.name}</td>
            <td>${s.score.toLocaleString()}</td>
            <td>${s.wave}</td>
            <td>${s.weapon||"—"}</td>
            <td>${s.kills||0}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

async function loadPreviewLeaderboard() {
  const el = document.getElementById("previewLb");
  if (!el) return;
  try {
    const res  = await fetch("https://crown-of-ashes.onrender.com /api/scores?mode=endless&limit=5");
    const data = await res.json();
    const scores = data.scores || [];
    if (!scores.length) { el.textContent = "No scores yet — be the first!"; return; }
    el.innerHTML = scores.map((s,i)=>
      `${["🥇","🥈","🥉","4.","5."][i]}  ${s.name}  —  ${s.score.toLocaleString()}`
    ).join("<br>");
  } catch {
    el.textContent = "Start playing to see scores here!";
  }
}

// ── Init on load ───────────────────────────────────────────────
window.addEventListener("load", ()=>{
  showScreen("nameScreen");
});
