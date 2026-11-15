// EMBERFALL — main.js: bootstrap, the fixed-step game loop and the state
// machine (title → build → combat → build … → victory / defeat).
import * as THREE from 'three';
import { ECONOMY, TOWER_TYPES, TOWER_ORDER } from './config.js';
import { createWorld, animateWorld } from './world.js';
import { createParticles, createTracers, createFloaters, updateParticles,
  updateTracers, updateFloaters, createShake, addShake, shakeOffset } from './effects.js';
import { createAudio, sfx } from './audio.js';
import { createHud, refreshHud, showBanner, showScreen } from './hud.js';
import { createInput, updateCamera } from './input.js';
import { placeTower, upgradeTower, sellTower, updateTowers, updatePadRings,
  towerStats } from './towers.js';
import { startWave, updateEnemies } from './enemies.js';
import { applyShot } from './shots.js';

const BEST_KEY = 'emberfall-best-score';

function freshState() {
  return {
    phase: 'title', prevPhase: null,
    gold: ECONOMY.startGold, crystalHp: ECONOMY.crystalHp, score: 0,
    wave: 0, waveScore: 0, kills: 0, buildTimer: ECONOMY.buildTime,
    time: 0, enemies: [], towers: [], shells: [], spawnQueue: [],
    spawned: 0, waveTotal: 0, selectedType: 'spark', selectedTower: null,
    hoverTower: null, bestScore: 0, hudDirty: true, shakeAmt: 0,
    segLens: null, totalPathLen: null,
  };
}

export function boot() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 200);

  const G = {
    ...freshState(),
    renderer, scene, camera,
    world: createWorld(scene),
    fxParticles: createParticles(scene),
    fxTracers: createTracers(scene),
    fxFloaters: createFloaters(scene),
    shake: createShake(),
    audio: createAudio(),
  };
  G.bestScore = Number(localStorage.getItem(BEST_KEY) || 0);
  G.hud = createHud(G);
  G.input = createInput(G);
  G.banner = (title, sub, s) => showBanner(G, title, sub, s);
  G.shakeOffset = () => shakeOffset(G.shake, 1 / 60);

  // ---- actions -----------------------------------------------------------
  G.startGame = () => {
    G.audio.ensure();
    resetRun(G);
    G.phase = 'build';
    G.wave = 0;
    G.buildTimer = ECONOMY.buildTime;
    showScreen(G, null);
    G.banner('DEFEND THE CRYSTAL', 'Build towers, then press Space to start wave 1', 2.6);
    G.hudDirty = true;
  };

  G.restart = () => {
    G.audio.ensure();
    sfx.click(G.audio);
    G.startGame();
  };

  G.callWave = () => {
    if (G.phase !== 'build') return;
    const bonus = Math.floor(G.buildTimer) * ECONOMY.earlyCallGoldPerSec;
    if (bonus > 0) {
      G.gold += bonus;
      showBanner(G, `EARLY CALL +${bonus}g`, '', 1.2);
    }
    startWave(G, G.wave + 1);
  };

  G.togglePause = () => {
    if (G.phase === 'build' || G.phase === 'combat') {
      G.prevPhase = G.phase;
      G.phase = 'paused';
      showScreen(G, 'pause');
    } else if (G.phase === 'paused') {
      G.phase = G.prevPhase || 'build';
      showScreen(G, null);
    }
    G.hudDirty = true;
  };

  G.toggleMute = () => {
    G.audio.setMuted(!G.audio.muted);
    G.hudDirty = true;
  };

  G.selectTowerType = (type) => {
    G.selectedType = type;
    G.selectedTower = null;
    sfx.click(G.audio);
    G.hudDirty = true;
  };

  G.deselect = () => {
    G.selectedTower = null;
    G.hudDirty = true;
  };

  G.upgradeSelected = () => {
    if (G.selectedTower) upgradeTower(G, G.selectedTower);
  };
  G.sellSelected = () => {
    if (G.selectedTower) sellTower(G, G.selectedTower);
  };
  G.toggleTargeting = () => {
    if (!G.selectedTower) return;
    G.selectedTower.targeting = G.selectedTower.targeting === 'first' ? 'strongest' : 'first';
    sfx.click(G.audio);
    G.hudDirty = true;
  };

  G.handleClick = (hit) => {
    G.audio.ensure();
    if (G.phase !== 'build' && G.phase !== 'combat') return;
    if (hit.kind === 'pad') {
      if (hit.pad.tower) {
        G.selectedTower = hit.pad.tower;
        G.selectedType = null;
        sfx.click(G.audio);
      } else if (G.selectedType) {
        const t = placeTower(G, hit.pad, G.selectedType);
        if (!t) sfx.error(G.audio);
      } else {
        sfx.error(G.audio);
      }
      G.hudDirty = true;
    } else if (hit.kind === 'tower') {
      G.selectedTower = hit.tower;
      G.selectedType = null;
      sfx.click(G.audio);
      G.hudDirty = true;
    } else {
      G.deselect();
    }
  };

  G.victory = () => {
    G.phase = 'victory';
    G.score += G.crystalHp * 25 + G.gold;
    saveBest(G);
    sfx.victory(G.audio);
    showScreen(G, 'victory');
    G.hudDirty = true;
  };

  G.defeat = () => {
    G.phase = 'defeat';
    saveBest(G);
    sfx.defeat(G.audio);
    showScreen(G, 'defeat');
    G.hudDirty = true;
  };

  function saveBest(G2) {
    if (G2.score > G2.bestScore) {
      G2.bestScore = G2.score;
      try { localStorage.setItem(BEST_KEY, String(G2.score)); } catch (e) { /* ignore */ }
    }
  }

  function resetRun(G2) {
    // Remove every tower, enemy, shell, tracer and floater from the scene.
    for (const t of [...G2.towers]) {
      G2.scene.remove(t.mesh); G2.scene.remove(t.ring);
      t.pad.tower = null;
      t.pad.ringMat.emissiveIntensity = 0.9;
    }
    for (const e of [...G2.enemies]) {
      G2.scene.remove(e.mesh); G2.scene.remove(e.bar.sprite);
    }
    for (const s of G2.shells) if (s.mesh) G2.scene.remove(s.mesh);
    for (const t of G2.fxTracers.list) G2.scene.remove(t.line);
    for (const f of G2.fxFloaters.list) G2.scene.remove(f.sprite);
    Object.assign(G2, freshState(), {
      bestScore: G2.bestScore, selectedType: 'spark',
    });
    G2.fxTracers.list.length = 0;
    G2.fxFloaters.list.length = 0;
    G2.shells.length = 0;
  }

  // ---- wave-clear check --------------------------------------------------
  function checkWaveCleared() {
    if (G.phase !== 'combat') return;
    if (G.spawnQueue.length > 0 || G.enemies.length > 0) return;
    const bonus = ECONOMY.waveClearBonus(G.wave);
    G.gold += bonus;
    G.score += ECONOMY.waveScore(G.wave);
    G.waveScore += ECONOMY.waveScore(G.wave);
    if (G.wave >= ECONOMY.totalWaves) {
      G.victory();
      return;
    }
    G.phase = 'build';
    G.buildTimer = ECONOMY.buildTime;
    G.banner(`WAVE ${G.wave} CLEARED`, `+${bonus} gold bonus`, 2.2);
    sfx.coin(G.audio);
    G.hudDirty = true;
  }

  // ---- per-frame ---------------------------------------------------------
  function step(dt) {
    G.time += dt;
    animateWorld(G.world, G.time, dt);
    if (G.phase === 'build') {
      G.buildTimer -= dt;
      if (G.buildTimer <= 0) G.callWave();
    } else if (G.phase === 'combat') {
      updateEnemies(G, dt);
      updateTowers(G, dt);
      checkWaveCleared();
    }
    updateParticles(G.fxParticles, dt);
    updateTracers(G.fxTracers, dt);
    updateFloaters(G.fxFloaters, dt);
    if (G.shakeAmt > 0) {
      addShake(G.shake, G.shakeAmt);
      G.shakeAmt = 0;
    }
    // Range ring: show it for the selected or hovered tower.
    for (const t of G.towers) {
      const show = t === G.selectedTower || t === G.hoverTower;
      t.ring.visible = show;
      if (show) {
        const stats = towerStats(t.type, t.level);
        t.ring.scale.setScalar(stats.range);
      }
    }
    updatePadRings(G);
    if (G.hudDirty) { refreshHud(G); G.hudDirty = false; }
  }

  const STEP = 1 / 60;
  let acc = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    if (G.phase !== 'paused') {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 20) { step(STEP); acc -= STEP; n++; }
      if (n === 20) acc = 0;
    }
    updateCamera(G);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Test / screenshot hooks: state for the driver, and a query-param debug
  // jump (not reachable from normal play).
  window.__emberfall = {
    get phase() { return G.phase; },
    get wave() { return G.wave; },
    get gold() { return G.gold; },
    get hp() { return G.crystalHp; },
    get score() { return G.score; },
    get enemies() { return G.enemies.length; },
    get towers() { return G.towers.length; },
    start: () => G.startGame(),
    callWave: () => G.callWave(),
    victory: () => G.victory(),
    defeat: () => G.defeat(),
    place: (padIndex, type) => placeTower(G, G.world.pads[padIndex], type),
    selectType: (type) => G.selectTowerType(type),
  };
  window.__game = G;

  showScreen(G, 'title');
  refreshHud(G);
  G.hudDirty = false;

  const params = new URLSearchParams(location.search);
  if (params.has('shot')) {
    applyShot(G, params.get('shot'));
  } else if (params.get('debug') === 'victory') {
    G.startGame(); G.victory();
  } else if (params.get('debug') === 'defeat') {
    G.startGame(); G.defeat();
  }

  requestAnimationFrame(frame);
  return G;
}

boot();
