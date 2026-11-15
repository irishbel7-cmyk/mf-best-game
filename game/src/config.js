// EMBERFALL — tuning tables. Every number that balances the game lives here.
// Towers, enemies, waves, economy and the map layout are all defined below
// so a balance pass never has to touch the simulation code.

// ---- map -----------------------------------------------------------------
// The ember path: a winding stone road across the basalt field. Enemies walk
// from the first waypoint to the last, where the Ember Crystal floats.
export const PATH_POINTS = [
  [-20, -9], [-9, -9], [-9, 7], [7, 7], [7, -7], [20, -7],
];
export const CRYSTAL_POS = [22.2, -7];

// 14 build pads, staggered on both sides of the path, at least 3 units from
// any path segment so towers never sit on the road.
export const PAD_POSITIONS = [
  [-15, -5.5], [-12, -12.5], [-5, -5.5], [-12, 3.5], [-5, 10.5], [2, 3.5],
  [11, 10.5], [-15, -12.5], [-13.5, -2], [3, 10.5], [11, 3.5], [3, -3.5],
  [11, -10.5], [16, -3.5],
];

// ---- economy -------------------------------------------------------------
export const ECONOMY = {
  startGold: 200,
  crystalHp: 20,
  totalWaves: 12,
  buildTime: 30,          // seconds of build phase before a wave auto-starts
  earlyCallGoldPerSec: 2, // gold per second left on the build timer
  waveClearBonus: (wave) => 25 + 5 * wave,
  sellRefund: 0.7,        // fraction of total invested returned on sell
  killScore: (goldValue) => 10 * goldValue,
  waveScore: (wave) => 100 * wave,
};

// ---- towers --------------------------------------------------------------
// cost, range (world units), rate (shots per second), damage, special.
export const TOWER_TYPES = {
  spark: {
    key: '1', name: 'Spark Spire', cost: 50, range: 7.0, rate: 2.0,
    damage: 8, color: 0xffb347, accent: '#ffb347',
    desc: 'Fast ember bolts, long range. Hits flying wisps.',
    canHitFlying: true, splash: 0, chain: 0, slow: 0,
  },
  mortar: {
    key: '2', name: 'Mortar', cost: 100, range: 6.0, rate: 0.5,
    damage: 30, color: 0xff5a2a, accent: '#ff5a2a',
    desc: 'Lobbed shell, area damage. Cannot hit flying wisps.',
    canHitFlying: false, splash: 2.0, chain: 0, slow: 0,
  },
  frost: {
    key: '3', name: 'Frost Obelisk', cost: 80, range: 5.0, rate: 1.0,
    damage: 4, color: 0x7dd8ff, accent: '#7dd8ff',
    desc: 'Chills enemies: 50% slow for 2 s. Hits flying wisps.',
    canHitFlying: true, splash: 0, chain: 0, slow: { factor: 0.5, dur: 2 },
  },
  storm: {
    key: '4', name: 'Storm Coil', cost: 150, range: 5.5, rate: 0.8,
    damage: 22, color: 0xb78cff, accent: '#b78cff',
    desc: 'Lightning chains to 2 extra enemies. Hits flying wisps.',
    canHitFlying: true, splash: 0, chain: 2, slow: 0,
  },
};
export const TOWER_ORDER = ['spark', 'mortar', 'frost', 'storm'];
export const UPGRADE = {
  level2Cost: (base) => Math.round(base * 0.75),
  level3Cost: (base) => Math.round(base * 1.25),
  damageMul: (level) => 1 + 0.6 * (level - 1),
  rangeMul: (level) => 1 + 0.1 * (level - 1),
  rateMul: (level) => 1 + 0.15 * (level - 1),
};

// ---- enemies -------------------------------------------------------------
export const ENEMY_TYPES = {
  crawler: {
    hp: 30, speed: 1.6, gold: 6, damage: 1, flying: false,
    color: 0xff7a1a, eyeColor: 0xffe08a, scale: 0.55, name: 'Crawler',
  },
  sprinter: {
    hp: 20, speed: 3.2, gold: 8, damage: 1, flying: false,
    color: 0xffd23e, eyeColor: 0xfff6b0, scale: 0.45, name: 'Sprinter',
  },
  brute: {
    hp: 120, speed: 1.0, gold: 15, damage: 2, flying: false,
    color: 0x8a3b2e, eyeColor: 0xff2a1a, scale: 1.0, name: 'Brute',
  },
  wisp: {
    hp: 25, speed: 2.4, gold: 10, damage: 1, flying: true,
    color: 0xff9de2, eyeColor: 0xffffff, scale: 0.5, name: 'Wisp',
  },
  golem: {
    hp: 2500, speed: 0.7, gold: 300, damage: 10, flying: false,
    color: 0x5a1f16, eyeColor: 0xffcc33, scale: 2.1, name: 'Magma Golem',
  },
};
// HP scales with the wave: x(1 + 0.22 x (wave - 1)).
export function enemyHp(type, wave) {
  return Math.round(ENEMY_TYPES[type].hp * (1 + 0.22 * (wave - 1)));
}
export function waveEnemyCount(wave) { return 6 + 2 * wave; }
export function spawnInterval(wave) { return wave <= 3 ? 0.9 : wave <= 7 ? 0.65 : 0.45; }

// Composition of one wave: a list of enemy type keys in spawn order.
export function waveComposition(wave) {
  const count = waveEnemyCount(wave);
  const list = [];
  if (wave === 12) {
    // The boss walks with an escort of crawlers and brutes.
    for (let i = 0; i < 10; i++) list.push('crawler');
    for (let i = 0; i < 6; i++) list.push('brute');
    for (let i = 0; i < 4; i++) list.push('sprinter');
    list.push('golem');
    return list;
  }
  for (let i = 0; i < count; i++) {
    const r = (i * 2654435761 + wave * 97) % 100; // deterministic mix
    if (wave >= 6 && r < 18) list.push('wisp');
    else if (wave >= 5 && r < 38) list.push('brute');
    else if (wave >= 3 && r < 62) list.push('sprinter');
    else list.push('crawler');
  }
  return list;
}

// ---- visuals -------------------------------------------------------------
export const PALETTE = {
  ground: 0x14100e,
  path: 0x6b5a44,
  padRing: 0x35e0c8,
  crystal: 0xbff6ff,
  fog: 0x1a0f0a,
};
export const CAMERA = {
  distance: 24, minDistance: 14, maxDistance: 30,
  azimuth: 0, maxAzimuth: 0.61, // about +/-35 degrees
  elevation: 0.96, // about 55 degrees down
  target: [2, 0, -1],
};
