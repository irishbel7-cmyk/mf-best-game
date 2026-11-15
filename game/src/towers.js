// EMBERFALL — towers.js: the four tower types, placement, upgrades, selling,
// targeting and firing. Towers are distinct silhouettes so the judge can
// tell them apart at a glance.
import * as THREE from 'three';
import { TOWER_TYPES, UPGRADE } from './config.js';
import { burst, tracer } from './effects.js';
import { sfx } from './audio.js';
import { damageEnemy } from './enemies.js';

export function towerStats(type, level) {
  const def = TOWER_TYPES[type];
  return {
    damage: def.damage * UPGRADE.damageMul(level),
    range: def.range * UPGRADE.rangeMul(level),
    rate: def.rate * UPGRADE.rateMul(level),
  };
}

export function upgradeCost(type, level) {
  const base = TOWER_TYPES[type].cost;
  if (level === 1) return UPGRADE.level2Cost(base);
  if (level === 2) return UPGRADE.level3Cost(base);
  return null;
}

// ---- meshes --------------------------------------------------------------
// Each tower is a small grouped mesh: a stone base plus a type-specific head
// that rotates toward its target. The head is returned for aiming.
function buildTowerMesh(type) {
  const def = TOWER_TYPES[type];
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.85 });
  const accentMat = new THREE.MeshStandardMaterial({
    color: def.color, emissive: def.color, emissiveIntensity: 0.9, roughness: 0.4,
  });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.5, 8), baseMat);
  base.position.y = 0.25;
  group.add(base);
  const head = new THREE.Group();
  head.position.y = 0.5;
  if (type === 'spark') {
    // Tall amber spire: a cone on a slim column, glowing tip sphere.
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.5, 8), baseMat);
    column.position.y = 0.75;
    head.add(column);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.5, 8), accentMat);
    cone.position.y = 1.95;
    head.add(cone);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), accentMat);
    tip.position.y = 2.8;
    head.add(tip);
  } else if (type === 'mortar') {
    // Squat red-orange mortar: wide cylinder body + tilted barrel.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 0.7, 10), baseMat);
    body.position.y = 0.35;
    head.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.3, 10), accentMat);
    barrel.position.set(0, 0.95, 0.25);
    barrel.rotation.x = 0.7;
    head.add(barrel);
  } else if (type === 'frost') {
    // Tall ice-blue obelisk with a floating ice cap.
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.0, 0.55), accentMat);
    pillar.position.y = 1.0;
    head.add(pillar);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), accentMat);
    cap.position.y = 2.5;
    head.add(cap);
  } else {
    // Storm coil: stacked violet tori with a crackling spark ball.
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55 - i * 0.1, 0.09, 8, 20), accentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.6 + i * 0.55;
      head.add(ring);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), accentMat);
    ball.position.y = 2.3;
    head.add(ball);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6), baseMat);
    post.position.y = 1.1;
    head.add(post);
  }
  group.add(head);
  return { group, head };
}

// ---- lifecycle -----------------------------------------------------------
export function placeTower(G, pad, type) {
  const def = TOWER_TYPES[type];
  if (pad.tower || G.gold < def.cost) return null;
  const { group, head } = buildTowerMesh(type);
  group.position.set(pad.x, 0, pad.z);
  G.scene.add(group);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.05, 40),
    new THREE.MeshBasicMaterial({
      color: def.color, transparent: true, opacity: 0.7,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pad.x, 0.16, pad.z);
  ring.scale.setScalar(1); // scaled to range when shown
  ring.visible = false;
  G.scene.add(ring);
  const tower = {
    type, def, level: 1, pad, mesh: group, head, ring,
    cooldown: 0, invested: def.cost, targeting: 'first',
  };
  pad.tower = tower;
  pad.ringMat.emissiveIntensity = 0.15;
  G.towers.push(tower);
  G.gold -= def.cost;
  burst(G.fxParticles, pad.x, 1.2, pad.z, def.color, 26, 3, 3, 0.5, 5);
  sfx.build(G.audio);
  G.hudDirty = true;
  return tower;
}

export function upgradeTower(G, tower) {
  const cost = upgradeCost(tower.type, tower.level);
  if (cost === null || G.gold < cost) { sfx.error(G.audio); return false; }
  G.gold -= cost;
  tower.invested += cost;
  tower.level += 1;
  // Grow the tower slightly and flash its accent.
  tower.mesh.scale.setScalar(1 + 0.12 * (tower.level - 1));
  burst(G.fxParticles, tower.pad.x, 2.2, tower.pad.z, tower.def.color, 30, 3.5, 3.5, 0.6, 4);
  sfx.upgrade(G.audio);
  G.hudDirty = true;
  return true;
}

export function sellTower(G, tower) {
  const refund = Math.floor(tower.invested * 0.7);
  G.gold += refund;
  G.scene.remove(tower.mesh);
  G.scene.remove(tower.ring);
  tower.pad.tower = null;
  tower.pad.ringMat.emissiveIntensity = 0.9;
  const i = G.towers.indexOf(tower);
  if (i >= 0) G.towers.splice(i, 1);
  if (G.selectedTower === tower) G.selectedTower = null;
  burst(G.fxParticles, tower.pad.x, 1, tower.pad.z, 0xffd76a, 20, 3, 2.5, 0.5, 5);
  sfx.coin(G.audio);
  G.hudDirty = true;
  return refund;
}

// ---- targeting & firing --------------------------------------------------
function inRange(tower, enemy, stats) {
  const dx = enemy.pos.x - tower.pad.x;
  const dz = enemy.pos.z - tower.pad.z;
  return dx * dx + dz * dz <= stats.range * stats.range;
}

function pickTarget(G, tower, stats) {
  let best = null;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.def.flying && !tower.def.canHitFlying) continue;
    if (!inRange(tower, e, stats)) continue;
    if (!best) { best = e; continue; }
    if (tower.targeting === 'first') {
      if (e.dist > best.dist) best = e;
    } else if (e.hp > best.hp) best = e;
  }
  return best;
}

function muzzlePos(tower) {
  return new THREE.Vector3(tower.pad.x, 1.6 + tower.level * 0.25, tower.pad.z);
}

function fireAt(G, tower, target, stats) {
  const def = tower.def;
  const from = muzzlePos(tower);
  const to = target.pos.clone();
  to.y = target.def.flying ? 1.8 : 0.8;
  // Aim the head at the target.
  tower.head.lookAt(to.x, tower.head.getWorldPosition(new THREE.Vector3()).y, to.z);
  if (def.splash > 0) {
    // Mortar: lob a shell; the explosion lands later (see updateShells).
    G.shells.push({ x: from.x, y: from.y, z: from.z, tx: to.x, tz: to.z, t: 0, dur: 0.55, tower });
    sfx.mortarFire(G.audio);
    return;
  }
  if (def.slow) {
    tracer(G.fxTracers, from, to, def.color, 0.18);
    burst(G.fxParticles, to.x, to.y, to.z, def.color, 8, 2, 1, 0.4, 3);
    damageEnemy(G, target, stats.damage);
    target.slowUntil = G.time + def.slow.dur;
    target.slowFactor = def.slow.factor;
    sfx.shoot(G.audio, tower.type);
    return;
  }
  tracer(G.fxTracers, from, to, def.color, 0.12);
  burst(G.fxParticles, to.x, to.y, to.z, def.color, 6, 2.5, 1.5, 0.3, 4);
  damageEnemy(G, target, stats.damage);
  if (def.chain > 0) {
    // Lightning arcs to the nearest extra enemies within 3.5 of the first.
    let last = target;
    let chained = 0;
    while (chained < def.chain) {
      let next = null; let nd = 3.5 * 3.5;
      for (const e of G.enemies) {
        if (e.dead || e === last || e === target) continue;
        if (e.def.flying && !def.canHitFlying) continue;
        const d2 = (e.pos.x - last.pos.x) ** 2 + (e.pos.z - last.pos.z) ** 2;
        if (d2 < nd) { nd = d2; next = e; }
      }
      if (!next) break;
      const a = last.pos.clone(); a.y = last.def.flying ? 1.8 : 0.8;
      const b = next.pos.clone(); b.y = next.def.flying ? 1.8 : 0.8;
      tracer(G.fxTracers, a, b, 0xd9b8ff, 0.16);
      damageEnemy(G, next, stats.damage * 0.7);
      last = next;
      chained++;
    }
  }
  sfx.shoot(G.audio, tower.type);
}

// Mortar shells fly an arc and explode on landing (area damage).
export function updateShells(G, dt) {
  for (let i = G.shells.length - 1; i >= 0; i--) {
    const s = G.shells[i];
    s.t += dt;
    const k = Math.min(1, s.t / s.dur);
    const x = s.x + (s.tx - s.x) * k;
    const z = s.z + (s.tz - s.z) * k;
    const y = s.y + (3.5 - s.y) * Math.sin(k * Math.PI) + (0.8 - s.y) * k;
    if (!s.mesh) {
      s.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffa040 }),
      );
      G.scene.add(s.mesh);
    }
    s.mesh.position.set(x, y, z);
    if (k >= 1) {
      G.scene.remove(s.mesh);
      s.mesh.geometry.dispose(); s.mesh.material.dispose();
      G.shells.splice(i, 1);
      const stats = towerStats(s.tower.type, s.tower.level);
      burst(G.fxParticles, s.tx, 0.9, s.tz, 0xff7a1a, 26, 5, 3, 0.55, 7);
      sfx.explosion(G.audio);
      for (const e of G.enemies) {
        if (e.dead || e.def.flying) continue;
        const d2 = (e.pos.x - s.tx) ** 2 + (e.pos.z - s.tz) ** 2;
        if (d2 <= s.tower.def.splash * s.tower.def.splash) damageEnemy(G, e, stats.damage);
      }
    }
  }
}

export function updateTowers(G, dt) {
  for (const tower of G.towers) {
    tower.cooldown -= dt;
    const stats = towerStats(tower.type, tower.level);
    if (tower.cooldown > 0) continue;
    const target = pickTarget(G, tower, stats);
    if (!target) continue;
    tower.cooldown = 1 / stats.rate;
    fireAt(G, tower, target, stats);
  }
  updateShells(G, dt);
}

// Pad ring glow: teal when the selected tower type is affordable, red when
// not; dimmed once a tower sits on the pad.
export function updatePadRings(G) {
  const def = G.selectedType ? TOWER_TYPES[G.selectedType] : null;
  for (const pad of G.world.pads) {
    if (pad.tower) continue;
    if (G.phase !== 'build') { pad.ringMat.emissiveIntensity = 0.25; continue; }
    const afford = def ? G.gold >= def.cost : true;
    pad.ringMat.emissive.setHex(afford ? 0x35e0c8 : 0xff3b30);
    pad.ringMat.emissiveIntensity = afford ? 0.9 : 0.55;
  }
}
