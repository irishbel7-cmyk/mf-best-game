// EMBERFALL — world.js: the 3D scene. Builds the volcanic field at dusk:
// basalt ground with a runtime-generated lava-crack texture, the raised
// stone path, the 14 glowing build pads, and the floating Ember Crystal.
import * as THREE from 'three';
import { PATH_POINTS, PAD_POSITIONS, CRYSTAL_POS, PALETTE } from './config.js';

// A canvas texture: dark basalt with glowing orange lava cracks.
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#17110d';
  g.fillRect(0, 0, 512, 512);
  // Mottle the basalt with a few large, soft blotches (kept sparse so the
  // scene stays readable and screenshots stay small).
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    const r = 8 + Math.random() * 30;
    const shade = Math.random();
    g.fillStyle = shade < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(60,32,18,0.07)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // Glowing lava cracks: jagged orange polylines.
  for (let i = 0; i < 5; i++) {
    let x = Math.random() * 512, y = Math.random() * 512;
    let a = Math.random() * Math.PI * 2;
    g.strokeStyle = 'rgba(255,110,20,0.85)';
    g.lineWidth = 1.5 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(x, y);
    const segs = 4 + Math.floor(Math.random() * 6);
    for (let s = 0; s < segs; s++) {
      a += (Math.random() - 0.5) * 1.4;
      const len = 12 + Math.random() * 26;
      x += Math.cos(a) * len; y += Math.sin(a) * len;
      g.lineTo(x, y);
    }
    g.stroke();
    // Hot core of the crack.
    g.strokeStyle = 'rgba(255,210,90,0.55)';
    g.lineWidth = 0.8;
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function makePathTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6b5a44';
  g.fillRect(0, 0, 256, 256);
  // Stone tile seams.
  g.strokeStyle = 'rgba(30,20,12,0.8)';
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
  }
  for (let i = 0; i < 20; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,220,170,0.08)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Build the whole static world. Returns handles the game loop needs.
export function createWorld(scene) {
  scene.background = new THREE.Color(0x120a08);
  scene.fog = new THREE.Fog(PALETTE.fog, 34, 72);

  // Lights: low warm sun + dusk purple hemisphere + crystal point light.
  const sun = new THREE.DirectionalLight(0xff9a4d, 1.5);
  sun.position.set(-18, 26, 10);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x6a4a8a, 0x1a0f08, 0.85);
  scene.add(hemi);
  const crystalLight = new THREE.PointLight(0x9fe8ff, 60, 26, 1.6);
  crystalLight.position.set(CRYSTAL_POS[0], 3.2, CRYSTAL_POS[1]);
  scene.add(crystalLight);

  // Ground plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 44),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  scene.add(ground);

  // Raised stone path: a box per segment, with a tile texture.
  const pathTex = makePathTexture();
  const pathMat = new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.9 });
  const pathGroup = new THREE.Group();
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const [x1, z1] = PATH_POINTS[i];
    const [x2, z2] = PATH_POINTS[i + 1];
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(len + 1.6, 0.22, 3.4), pathMat);
    seg.position.set((x1 + x2) / 2, 0.11, (z1 + z2) / 2);
    seg.rotation.y = -Math.atan2(dz, dx);
    pathGroup.add(seg);
  }
  // Start portal marker: a glowing ember gate where enemies appear.
  const gate = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.18, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0x33150a, emissive: 0xff5a10, emissiveIntensity: 1.4 }),
  );
  gate.position.set(PATH_POINTS[0][0], 1.7, PATH_POINTS[0][1]);
  pathGroup.add(gate);
  scene.add(pathGroup);

  // Build pads: stone disc + glowing teal torus ring. The ring material is
  // kept per pad so affordability can pulse it.
  const pads = PAD_POSITIONS.map(([x, z], i) => {
    const group = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.35, 0.18, 24),
      new THREE.MeshStandardMaterial({ color: 0x2a211a, roughness: 0.9 }),
    );
    disc.position.y = 0.09;
    group.add(disc);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x0a2a26, emissive: PALETTE.padRing, emissiveIntensity: 0.9,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 10, 32), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    group.add(ring);
    group.position.set(x, 0, z);
    group.userData.padIndex = i;
    scene.add(group);
    return { group, ringMat, x, z, index: i, tower: null };
  });

  // The Ember Crystal: an icosahedron core, emissive cyan-white, slowly
  // rotating and bobbing above a stone plinth, ringed by a glowing torus.
  const crystalGroup = new THREE.Group();
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 2.2, 0.7, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 0.85 }),
  );
  plinth.position.y = 0.35;
  crystalGroup.add(plinth);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xbff6ff, emissive: 0x66d9ff, emissiveIntensity: 1.8,
    roughness: 0.15, metalness: 0.1, flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), coreMat);
  core.position.y = 2.4;
  crystalGroup.add(core);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.06, 8, 48),
    new THREE.MeshStandardMaterial({ color: 0x0a2a26, emissive: 0x35e0c8, emissiveIntensity: 1.2 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 2.4;
  crystalGroup.add(halo);
  crystalGroup.position.set(CRYSTAL_POS[0], 0, CRYSTAL_POS[1]);
  scene.add(crystalGroup);

  // Ambient ember motes drifting up across the whole field.
  const moteCount = 60;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 56;
    motePos[i * 3 + 1] = Math.random() * 9;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 38;
    moteSeed[i] = Math.random();
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    color: 0xffa040, size: 0.16, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(motes);

  // A few dark basalt boulders for silhouette at the edges.
  const boulderMat = new THREE.MeshStandardMaterial({ color: 0x1c1512, roughness: 1 });
  [[-24, 12], [24, 12], [-26, -14], [25, -13], [0, 17], [-2, -16]].forEach(([x, z]) => {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2 + Math.random(), 0), boulderMat);
    b.position.set(x, 0.5, z);
    b.rotation.set(Math.random(), Math.random() * 6, Math.random());
    scene.add(b);
  });

  return {
    pads, crystalGroup, core, halo, crystalLight, motes, moteSeed,
    pathPoints: PATH_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  };
}

// Per-frame ambient animation: crystal spin/bob, halo spin, motes rising.
export function animateWorld(world, t, dt) {
  world.core.rotation.y = t * 0.5;
  world.core.position.y = 2.4 + Math.sin(t * 1.3) * 0.18;
  world.halo.rotation.z = t * 0.4;
  world.crystalLight.intensity = 55 + Math.sin(t * 2.1) * 10;
  const pos = world.motes.geometry.attributes.position;
  for (let i = 0; i < world.moteSeed.length; i++) {
    let y = pos.getY(i) + dt * (0.35 + world.moteSeed[i] * 0.5);
    if (y > 9) y = 0.2;
    pos.setY(i, y);
    pos.setX(i, pos.getX(i) + Math.sin(t * 0.7 + i) * 0.002);
  }
  pos.needsUpdate = true;
}
