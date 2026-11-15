// EMBERFALL — effects.js: particles, tracers, floating text, screen shake.
// Everything here is pooled and code-generated; no image or sound files.
import * as THREE from 'three';

// ---- particle bursts -----------------------------------------------------
// One THREE.Points cloud, 600 slots, each particle with velocity, life and
// colour. Dead slots sit at y = -100.
export function createParticles(scene, max = 600) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  for (let i = 0; i < max; i++) pos[i * 3 + 1] = -100;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.22, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < max; i++) {
    parts.push({ alive: false, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, grav: 0 });
  }
  return { points, parts, cursor: 0 };
}

export function burst(fx, x, y, z, colorHex, count, speed = 4, up = 2.5, life = 0.6, grav = 6) {
  const c = new THREE.Color(colorHex);
  for (let n = 0; n < count; n++) {
    const i = fx.cursor;
    fx.cursor = (fx.cursor + 1) % fx.parts.length;
    const p = fx.parts[i];
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    p.alive = true;
    p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s;
    p.vy = up * (0.4 + Math.random() * 0.9);
    p.life = p.maxLife = life * (0.6 + Math.random() * 0.8);
    p.grav = grav;
    const pos = fx.points.geometry.attributes.position;
    pos.setXYZ(i, x, y, z);
    const col = fx.points.geometry.attributes.color;
    const jitter = 0.75 + Math.random() * 0.25;
    col.setXYZ(i, c.r * jitter, c.g * jitter, c.b * jitter);
  }
  fx.points.geometry.attributes.position.needsUpdate = true;
  fx.points.geometry.attributes.color.needsUpdate = true;
}

export function updateParticles(fx, dt) {
  const pos = fx.points.geometry.attributes.position;
  let any = false;
  for (let i = 0; i < fx.parts.length; i++) {
    const p = fx.parts[i];
    if (!p.alive) continue;
    any = true;
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      pos.setXYZ(i, 0, -100, 0);
      continue;
    }
    p.vy -= p.grav * dt;
    pos.setXYZ(i, pos.getX(i) + p.vx * dt, pos.getY(i) + p.vy * dt, pos.getZ(i) + p.vz * dt);
  }
  if (any) pos.needsUpdate = true;
}

// ---- tracers -------------------------------------------------------------
// Short-lived glowing line segments: spark bolts, lightning arcs.
export function createTracers(scene) {
  return { scene, list: [] };
}

export function tracer(fx, from, to, colorHex, life = 0.14, width = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  const mat = new THREE.LineBasicMaterial({
    color: colorHex, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  fx.scene.add(line);
  fx.list.push({ line, life, maxLife: life });
  void width;
}

export function updateTracers(fx, dt) {
  for (let i = fx.list.length - 1; i >= 0; i--) {
    const t = fx.list[i];
    t.life -= dt;
    if (t.life <= 0) {
      fx.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      fx.list.splice(i, 1);
    } else {
      t.line.material.opacity = 0.95 * (t.life / t.maxLife);
    }
  }
}

// ---- floating text -------------------------------------------------------
// Canvas sprites that rise and fade: "+6" gold popups, "WAVE 4" style tags.
export function createFloaters(scene) {
  return { scene, list: [] };
}

function textSprite(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeStyle = 'rgba(0,0,0,0.9)';
  g.lineWidth = 8;
  g.strokeText(text, 128, 48);
  g.fillStyle = color;
  g.fillText(text, 128, 48);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 1.2, 1);
  return sprite;
}

export function floater(fx, x, y, z, text, color = '#ffd76a', life = 1.1) {
  const sprite = textSprite(text, color);
  sprite.position.set(x, y, z);
  fx.scene.add(sprite);
  fx.list.push({ sprite, life, maxLife: life });
}

export function updateFloaters(fx, dt) {
  for (let i = fx.list.length - 1; i >= 0; i--) {
    const f = fx.list[i];
    f.life -= dt;
    f.sprite.position.y += dt * 1.6;
    f.sprite.material.opacity = Math.max(0, f.life / f.maxLife);
    if (f.life <= 0) {
      fx.scene.remove(f.sprite);
      f.sprite.material.map.dispose();
      f.sprite.material.dispose();
      fx.list.splice(i, 1);
    }
  }
}

// ---- screen shake --------------------------------------------------------
export function createShake() { return { trauma: 0 }; }
export function addShake(shake, amount) { shake.trauma = Math.min(1, shake.trauma + amount); }
export function shakeOffset(shake, dt) {
  shake.trauma = Math.max(0, shake.trauma - dt * 1.6);
  const s = shake.trauma * shake.trauma * 0.35;
  return {
    x: (Math.random() - 0.5) * s,
    y: (Math.random() - 0.5) * s,
  };
}
