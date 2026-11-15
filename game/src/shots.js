// EMBERFALL — shots.js: deterministic staging presets for the four
// screenshots, driven by ?shot=<name>. Each preset puts the live game into
// a fixed state and sets window.__shotReady once it has rendered, so the
// screenshot driver can capture a real render of the actual game code.
import { placeTower } from './towers.js';
import { startWave, spawnEnemy } from './enemies.js';

function ready(delayMs = 1400) {
  setTimeout(() => { window.__shotReady = true; }, delayMs);
}

function titleShot(G) {
  // Title screen over the live field, with a few idle towers already built.
  G.gold = 9999;
  placeTower(G, G.world.pads[0], 'spark');
  placeTower(G, G.world.pads[4], 'mortar');
  placeTower(G, G.world.pads[10], 'storm');
  G.gold = 200;
  G.hudDirty = true;
  ready();
}

function buildShot(G) {
  // Build phase, wave 4 staged: several towers, one selected showing its
  // range ring and the upgrade panel, tower cards along the bottom.
  G.startGame();
  G.wave = 3;
  G.buildTimer = 18;
  G.gold = 9999;
  const built = [
    [0, 'spark'], [1, 'mortar'], [2, 'frost'], [4, 'storm'],
    [5, 'spark'], [9, 'frost'], [11, 'mortar'],
  ];
  for (const [pad, type] of built) placeTower(G, G.world.pads[pad], type);
  const chosen = G.world.pads[1].tower;
  if (chosen) {
    // Upgrade the mortar once so the panel shows level 2 stats.
    G.selectedTower = chosen;
    chosen.level = 2;
    chosen.invested += 75;
    chosen.mesh.scale.setScalar(1.12);
  }
  G.gold = 265;
  G.hudDirty = true;
  ready();
}

function battleShot(G) {
  // Mid-wave combat, wave 7: many enemies on the path, towers firing.
  G.startGame();
  G.gold = 9999;
  const built = [
    [0, 'spark'], [1, 'mortar'], [2, 'frost'], [3, 'storm'],
    [5, 'spark'], [6, 'mortar'], [9, 'frost'], [11, 'storm'],
  ];
  for (const [pad, type] of built) placeTower(G, G.world.pads[pad], type);
  G.gold = 180;
  startWave(G, 7);
  // Pre-place a spread of enemies along the path so the frame is full.
  const types = ['crawler', 'sprinter', 'crawler', 'brute', 'wisp', 'crawler',
    'sprinter', 'brute', 'crawler', 'wisp'];
  types.forEach((type, i) => {
    const e = spawnEnemy(G, type);
    e.dist = 3 + i * 4.0;
  });
  // Keep a few more in the spawn queue so the HUD shows enemies left.
  G.spawnQueue = ['crawler', 'sprinter', 'brute', 'wisp'];
  G.spawnTimer = 2.5;
  G.hudDirty = true;
  ready(1800);
}

function victoryShot(G) {
  // Victory screen after wave 12: score breakdown, Play Again, the crystal
  // intact and glowing with towers behind it.
  G.startGame();
  G.gold = 9999;
  const built = [
    [0, 'spark'], [1, 'mortar'], [2, 'frost'], [4, 'storm'],
    [5, 'spark'], [9, 'frost'], [11, 'mortar'],
  ];
  for (const [pad, type] of built) placeTower(G, G.world.pads[pad], type);
  G.wave = 12;
  G.kills = 214;
  G.waveScore = 1200;
  G.score = 2840;
  G.gold = 320;
  G.crystalHp = 14;
  G.victory();
  ready();
}

export function applyShot(G, name) {
  if (name === 'title') titleShot(G);
  else if (name === 'build') buildShot(G);
  else if (name === 'battle') battleShot(G);
  else if (name === 'victory') victoryShot(G);
  else ready(500);
}
