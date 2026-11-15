// EMBERFALL — hud.js: the DOM heads-up display, tower cards, selection
// panel, banners and the title / pause / victory / defeat screens.
// All layout and styling live in index.html; this module owns the text,
// the buttons and the show/hide logic.
import { TOWER_TYPES, TOWER_ORDER, ECONOMY } from './config.js';
import { towerStats, upgradeCost } from './towers.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    gold: $('hud-gold'), hpFill: $('hud-hp-fill'), hpText: $('hud-hp-text'),
    wave: $('hud-wave'), score: $('hud-score'), enemies: $('hud-enemies'),
    buildBar: $('build-bar'), buildFill: $('build-fill'), buildText: $('build-text'),
    cards: $('tower-cards'), panel: $('tower-panel'), banner: $('banner'),
    bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    title: $('screen-title'), pause: $('screen-pause'), victory: $('screen-victory'),
    defeat: $('screen-defeat'), best: $('best-score'),
    victoryLines: $('victory-lines'), defeatLines: $('defeat-lines'),
    startWaveBtn: $('btn-start-wave'), pauseBtn: $('btn-pause'),
    muteBtn: $('btn-mute'), restartBtn: $('btn-restart'),
  };

  // Tower cards along the bottom bar.
  hud.cardEls = {};
  for (const type of TOWER_ORDER) {
    const def = TOWER_TYPES[type];
    const card = document.createElement('div');
    card.className = 'tower-card';
    card.id = `card-${type}`;
    card.innerHTML =
      `<div class="card-key">${def.key}</div>` +
      `<div class="card-dot" style="background:${def.accent}"></div>` +
      `<div class="card-name">${def.name}</div>` +
      `<div class="card-cost">${def.cost}g</div>` +
      `<div class="card-desc">${def.desc}</div>`;
    card.addEventListener('click', () => G.selectTowerType(type));
    hud.cards.appendChild(card);
    hud.cardEls[type] = card;
  }

  // Wire the buttons.
  $('btn-start').addEventListener('click', () => G.startGame());
  hud.startWaveBtn.addEventListener('click', () => G.callWave());
  hud.pauseBtn.addEventListener('click', () => G.togglePause());
  hud.muteBtn.addEventListener('click', () => G.toggleMute());
  hud.restartBtn.addEventListener('click', () => G.restart());
  $('btn-resume').addEventListener('click', () => G.togglePause());
  $('btn-restart-pause').addEventListener('click', () => G.restart());
  $('btn-play-again').addEventListener('click', () => G.restart());
  $('btn-try-again').addEventListener('click', () => G.restart());
  $('panel-upgrade').addEventListener('click', () => G.upgradeSelected());
  $('panel-sell').addEventListener('click', () => G.sellSelected());
  $('panel-target').addEventListener('click', () => G.toggleTargeting());
  $('panel-close').addEventListener('click', () => G.deselect());

  return hud;
}

export function refreshHud(G) {
  const h = G.hud;
  if (!h) return;
  h.gold.textContent = `${G.gold}g`;
  const hpFrac = Math.max(0, G.crystalHp / ECONOMY.crystalHp);
  h.hpFill.style.width = `${hpFrac * 100}%`;
  h.hpFill.style.background = hpFrac > 0.5 ? '#58d858' : hpFrac > 0.25 ? '#ffcf3f' : '#ff4a3d';
  h.hpText.textContent = `${G.crystalHp}/${ECONOMY.crystalHp}`;
  h.wave.textContent = G.phase === 'title' ? '—/12' : `${Math.max(1, G.wave)}/12`;
  h.score.textContent = `${G.score}`;
  const left = G.phase === 'combat' ? G.enemies.length + G.spawnQueue.length : 0;
  h.enemies.textContent = `Enemies: ${left}`;
  // Build timer bar, only during the build phase.
  if (G.phase === 'build') {
    h.buildBar.style.display = 'block';
    h.buildFill.style.width = `${(G.buildTimer / ECONOMY.buildTime) * 100}%`;
    h.buildText.textContent = `Wave ${G.wave + 1} in ${Math.ceil(G.buildTimer)}s — Space to call early (+${Math.floor(G.buildTimer) * 2}g)`;
  } else {
    h.buildBar.style.display = 'none';
  }
  // Tower card affordability + selection highlight.
  for (const type of TOWER_ORDER) {
    const def = TOWER_TYPES[type];
    const card = h.cardEls[type];
    card.classList.toggle('afford', G.gold >= def.cost);
    card.classList.toggle('selected', G.selectedType === type);
  }
  // Selection panel.
  const t = G.selectedTower;
  if (t) {
    h.panel.style.display = 'block';
    const stats = towerStats(t.type, t.level);
    document.getElementById('panel-name').textContent = `${t.def.name} — Lv ${t.level}`;
    document.getElementById('panel-stats').textContent =
      `Damage ${Math.round(stats.damage)}  ·  Range ${stats.range.toFixed(1)}  ·  Rate ${stats.rate.toFixed(2)}/s`;
    const up = upgradeCost(t.type, t.level);
    const upBtn = document.getElementById('panel-upgrade');
    if (up === null) {
      upBtn.textContent = 'MAX LEVEL';
      upBtn.disabled = true;
    } else {
      upBtn.textContent = `Upgrade — ${up}g`;
      upBtn.disabled = G.gold < up;
    }
    document.getElementById('panel-sell').textContent =
      `Sell — ${Math.floor(t.invested * 0.7)}g`;
    document.getElementById('panel-target').textContent =
      `Targeting: ${t.targeting === 'first' ? 'First' : 'Strongest'} (T)`;
  } else {
    h.panel.style.display = 'none';
  }
  // Mute button label.
  h.muteBtn.textContent = G.audio.muted ? 'Unmute (M)' : 'Mute (M)';
  h.startWaveBtn.style.display =
    (G.phase === 'build' || G.phase === 'combat') ? 'block' : 'none';
  h.startWaveBtn.textContent = G.phase === 'build' ? 'Start Wave (Space)' : 'Wave Running…';
  h.startWaveBtn.disabled = G.phase !== 'build';
}

let bannerTimer = null;
export function showBanner(G, title, sub, seconds = 2.2) {
  const h = G.hud;
  h.bannerTitle.textContent = title;
  h.bannerSub.textContent = sub || '';
  h.banner.style.display = 'block';
  h.banner.classList.remove('banner-pop');
  void h.banner.offsetWidth; // restart the pop animation
  h.banner.classList.add('banner-pop');
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { h.banner.style.display = 'none'; }, seconds * 1000);
}

export function showScreen(G, which) {
  const h = G.hud;
  for (const s of [h.title, h.pause, h.victory, h.defeat]) s.style.display = 'none';
  if (which === 'title') {
    h.best.textContent = G.bestScore > 0 ? `Best score: ${G.bestScore}` : 'No runs yet — be the first to defend the crystal!';
    h.title.style.display = 'flex';
  } else if (which === 'pause') h.pause.style.display = 'flex';
  else if (which === 'victory') {
    const killPts = G.score - G.waveScore - G.crystalHp * 25 - G.gold;
    h.victoryLines.innerHTML =
      `<div>Wave bonus: ${G.waveScore} pts</div>` +
      `<div>Kill points: ${killPts} pts (${G.kills} enemies slain)</div>` +
      `<div>Crystal bonus: ${G.crystalHp} HP × 25 = ${G.crystalHp * 25} pts</div>` +
      `<div>Gold bonus: ${G.gold}g × 1 = ${G.gold} pts</div>` +
      `<div class="total">TOTAL SCORE: ${G.score}</div>` +
      `<div>Best score: ${Math.max(G.bestScore, G.score)}</div>`;
    h.victory.style.display = 'flex';
  } else if (which === 'defeat') {
    h.defeatLines.innerHTML =
      `<div>Waves survived: ${Math.max(0, G.wave - 1)} / 12</div>` +
      `<div>Kills: ${G.kills} enemies slain</div>` +
      `<div class="total">SCORE: ${G.score}</div>` +
      `<div>Best score: ${Math.max(G.bestScore, G.score)}</div>`;
    h.defeat.style.display = 'flex';
  }
}
