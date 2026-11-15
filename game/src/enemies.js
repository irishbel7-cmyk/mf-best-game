// EMBERFALL — enemies.js: the five enemy types, wave spawning, path walking,
// floating HP bars, and taking damage. Enemies walk the path waypoints from
// the ember gate to the crystal; reaching it damages the crystal.
import * as THREE from 'three';
import { ENEMY_TYPES, enemyHp, waveComposition, spawnInterval } from './config.js';
import { burst, floater } from './effects.js';
import { sfx } from './audio.js';

// ---- meshes --------------------------------------------------------------
// Each enemy is a small grouped mesh with emissive eyes, so its type reads
// from its silhouette and glow colour.
function buildEnemyMesh(type) {
  const def = ENEMY_TYPES[type];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: def.color, emissive: def.color, emissiveIntensity: 0.35, roughness: 0.7,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: def.eyeColor, emissive: def.eyeColor, emissiveIntensity: 2.2,
  });
  const s = def.scale;
  if (type === 'crawler') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s * 2, 10, 8), bodyMat);
    body.scale.y = 0.6;
    body.position.y = 0.35;
    group.add(body);
    for (let i = 0; i < 6; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 4), bodyMat);
      leg.position.set((i % 2 ? 0.5 : -0.5) * s, 0.2, (Math.floor(i / 2) - 1) * 0.4 * s);
      leg.rotation.z = (i % 2 ? -1 : 1) * 0.9;
      group.add(leg);
    }
  } else if (type === 'sprinter') {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.42 * s * 2, 1.1 * s * 2, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.4;
    group.add(body);
  } else if (type === 'brute') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3 * s, 1.1 * s, 1.1 * s), bodyMat);
    body.position.y = 0.7;
    group.add(body);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.5 * s, 1.2 * s),
      new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.9 }));
    plate.position.y = 1.35;
    group.add(plate);
  } else if (type === 'wisp') {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5 * s * 2, 1.2 * s * 2, 8), bodyMat);
    flame.position.y = 1.6;
    group.add(flame);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s * 2, 10, 8), eyeMat);
    core.position.y = 1.5;
    group.add(core);
  } else {
    // Magma Golem: huge rocky body with molten cracks (emissive seams).
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 * s, 0), bodyMat);
    body.position.y = 1.6;
    group.add(body);
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(2.6 * s, 0.8 * s, 1.4 * s), bodyMat);
    shoulder.position.y = 2.6;
    group.add(shoulder);
    const crack = new THREE.Mesh(new THREE.TorusGeometry(1.1 * s, 0.08, 6, 20),
      new THREE.MeshStandardMaterial({ color: 0x33150a, emissive: 0xffcc33, emissiveIntensity: 2 }));
    crack.position.y = 1.6;
    crack.rotation.x = Math.PI / 2.6;
    group.add(crack);
  }
  // Eyes: two small glowing spheres on the front (+x side).
  const eyeGeo = new THREE.SphereGeometry(0.09 * s * 2 + 0.04, 8, 8);
  for (const dz of [-0.16 * s * 2, 0.16 * s * 2]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.42 * s * 2, (type === 'wisp' ? 1.55 : 0.55) * (type === 'golem' ? 2.2 : 1), dz);
    group.add(eye);
  }
  return group;
}

// HP bar: a canvas sprite above the enemy, redrawn when HP changes.
function makeHpBar() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 10;
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.5, 0.24, 1);
  return { sprite, canvas: c, tex };
}

function drawHpBar(bar, frac) {
  const g = bar.canvas.getContext('2d');
  g.clearRect(0, 0, 64, 10);
  g.fillStyle = 'rgba(0,0,0,0.75)';
  g.fillRect(0, 0, 64, 10);
  g.fillStyle = frac > 0.5 ? '#58d858' : frac > 0.25 ? '#ffcf3f' : '#ff4a3d';
  g.fillRect(1, 1, 62 * Math.max(0, frac), 8);
  bar.tex.needsUpdate = true;
}

// ---- spawning ------------------------------------------------------------
export function startWave(G, wave) {
  G.wave = wave;
  G.phase = 'combat';
  G.spawnQueue = waveComposition(wave);
  G.spawnTimer = 0.4;
  G.spawned = 0;
  G.waveTotal = G.spawnQueue.length;
  sfx.waveHorn(G.audio);
  G.banner(`WAVE ${wave}`, wave === 12 ? 'THE MAGMA GOLEM AWAKENS' : `${G.waveTotal} enemies approach`, 2.2);
  G.hudDirty = true;
}

export function spawnEnemy(G, type) {
  const def = ENEMY_TYPES[type];
  const hp = enemyHp(type, G.wave);
  const mesh = buildEnemyMesh(type);
  const start = G.world.pathPoints[0];
  mesh.position.copy(start);
  G.scene.add(mesh);
  const bar = makeHpBar();
  bar.sprite.position.set(start.x, def.flying ? 2.9 : 1.9, start.z);
  G.scene.add(bar.sprite);
  drawHpBar(bar, 1);
  const enemy = {
    type, def, hp, maxHp: hp, dist: 0, segment: 0, segDist: 0,
    pos: mesh.position, mesh, bar, dead: false, reached: false,
    slowUntil: 0, slowFactor: 1, bob: Math.random() * 6,
  };
  G.enemies.push(enemy);
  G.spawned++;
  return enemy;
}

// ---- damage / death ------------------------------------------------------
export function damageEnemy(G, enemy, amount) {
  if (enemy.dead) return;
  enemy.hp -= amount;
  drawHpBar(enemy.bar, enemy.hp / enemy.maxHp);
  if (enemy.hp <= 0) killEnemy(G, enemy);
}

export function killEnemy(G, enemy) {
  enemy.dead = true;
  const { x, y, z } = enemy.pos;
  const gold = enemy.def.gold;
  G.gold += gold;
  G.score += 10 * gold;
  G.kills++;
  burst(G.fxParticles, x, y + 0.6, z, enemy.def.color, enemy.type === 'golem' ? 70 : 18, 5, 3.5, 0.7, 6);
  floater(G.fxFloaters, x, y + 1.4, z, `+${gold}`, '#ffd76a');
  sfx.death(G.audio);
  if (enemy.type === 'golem') {
    G.banner('GOLEM SLAIN', `+${gold} gold`, 2.0);
  }
  G.scene.remove(enemy.mesh);
  G.scene.remove(enemy.bar.sprite);
  enemy.bar.tex.dispose();
  const i = G.enemies.indexOf(enemy);
  if (i >= 0) G.enemies.splice(i, 1);
  G.hudDirty = true;
}

// ---- per-frame update ----------------------------------------------------
export function updateEnemies(G, dt) {
  // Spawn from the queue on a timer.
  if (G.spawnQueue.length > 0) {
    G.spawnTimer -= dt;
    if (G.spawnTimer <= 0) {
      spawnEnemy(G, G.spawnQueue.shift());
      G.spawnTimer = spawnInterval(G.wave);
    }
  }
  const pts = G.world.pathPoints;
  // Segment lengths, computed once per wave.
  if (!G.segLens) {
    G.segLens = [];
    for (let i = 0; i < pts.length - 1; i++) G.segLens.push(pts[i].distanceTo(pts[i + 1]));
  }
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.dead) continue;
    const slowed = G.time < e.slowUntil;
    const speed = e.def.speed * (slowed ? e.slowFactor : 1);
    e.dist += speed * dt;
    // Walk the segments by travelled distance.
    let remaining = e.dist;
    let idx = 0;
    while (idx < G.segLens.length - 1 && remaining > G.segLens[idx]) {
      remaining -= G.segLens[idx];
      idx++;
    }
    if (idx >= G.segLens.length) idx = G.segLens.length - 1;
    const a = pts[idx], b = pts[idx + 1];
    const k = G.segLens[idx] > 0 ? remaining / G.segLens[idx] : 0;
    const x = a.x + (b.x - a.x) * k;
    const z = a.z + (b.z - a.z) * k;
    const y = e.def.flying ? 0.4 + Math.sin(G.time * 3 + e.bob) * 0.15 : 0;
    e.mesh.position.set(x, y, z);
    e.mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    e.bar.sprite.position.set(x, (e.def.flying ? 2.9 : 1.9) + e.def.scale * 0.4, z);
    // Reached the end of the path: damage the crystal.
    if (e.dist >= totalPathLength(G)) {
      e.reached = true;
      G.crystalHp -= e.def.damage;
      burst(G.fxParticles, e.pos.x, 1.5, e.pos.z, 0x9fe8ff, 30, 4, 3, 0.6, 5);
      sfx.crystalHit(G.audio);
      G.shakeAmt = 0.5;
      G.scene.remove(e.mesh);
      G.scene.remove(e.bar.sprite);
      G.enemies.splice(i, 1);
      G.hudDirty = true;
      if (G.crystalHp <= 0) {
        G.crystalHp = 0;
        G.defeat();
      }
    }
  }
}

function totalPathLength(G) {
  if (G.totalPathLen) return G.totalPathLen;
  let len = 0;
  const pts = G.world.pathPoints;
  for (let i = 0; i < pts.length - 1; i++) len += pts[i].distanceTo(pts[i + 1]);
  G.totalPathLen = len;
  return len;
}

export function enemiesLeft(G) {
  return G.enemies.length + G.spawnQueue.length;
}
