// EMBERFALL — input.js: mouse picking (raycast), keyboard shortcuts and
// the orbit/zoom camera. Left-click places or selects; dragging the empty
// ground orbits; the wheel zooms. Nothing here needs the keyboard.
import * as THREE from 'three';
import { CAMERA } from './config.js';

export function createInput(G) {
  const input = {
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    dragging: false, dragButton: 0, dragX: 0, dragY: 0, moved: 0,
    azimuth: CAMERA.azimuth, distance: CAMERA.distance,
  };
  const canvas = G.renderer.domElement;

  function setPointer(e) {
    const rect = canvas.getBoundingClientRect();
    input.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    input.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick(e) {
    setPointer(e);
    input.raycaster.setFromCamera(input.pointer, G.camera);
    // Pads first, then towers, then the ground plane.
    const padHits = input.raycaster.intersectObjects(
      G.world.pads.map((p) => p.group), true);
    if (padHits.length > 0) {
      let obj = padHits[0].object;
      while (obj && obj.userData.padIndex === undefined) obj = obj.parent;
      if (obj) return { kind: 'pad', pad: G.world.pads[obj.userData.padIndex] };
    }
    const towerHits = input.raycaster.intersectObjects(
      G.towers.map((t) => t.mesh), true);
    if (towerHits.length > 0) {
      let obj = towerHits[0].object;
      while (obj && !G.towers.some((t) => t.mesh === obj)) obj = obj.parent;
      if (obj) return { kind: 'tower', tower: G.towers.find((t) => t.mesh === obj) };
    }
    return { kind: 'ground' };
  }

  canvas.addEventListener('mousedown', (e) => {
    if (G.phase === 'title' || G.phase === 'victory' || G.phase === 'defeat') return;
    input.dragging = true;
    input.dragButton = e.button;
    input.dragX = e.clientX; input.dragY = e.clientY;
    input.moved = 0;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!input.dragging) {
      // Hover: show the range ring of the tower under the cursor.
      const hit = pick(e);
      G.hoverTower = hit.kind === 'tower' ? hit.tower : null;
      return;
    }
    const dx = e.clientX - input.dragX;
    const dy = e.clientY - input.dragY;
    input.moved += Math.abs(dx) + Math.abs(dy);
    input.dragX = e.clientX; input.dragY = e.clientY;
    // Drag orbits the camera (right button, or left-drag on empty ground).
    if (input.dragButton === 2 || input.dragButton === 0) {
      input.azimuth = Math.max(-CAMERA.maxAzimuth,
        Math.min(CAMERA.maxAzimuth, input.azimuth - dx * 0.004));
    }
  });
  canvas.addEventListener('mouseup', (e) => {
    if (!input.dragging) return;
    input.dragging = false;
    if (input.moved > 6) return; // it was a drag, not a click
    if (e.button !== 0) return;
    G.handleClick(pick(e));
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.distance = Math.max(CAMERA.minDistance,
      Math.min(CAMERA.maxDistance, input.distance + e.deltaY * 0.02));
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'enter' && G.phase === 'title') { G.startGame(); return; }
    if (k === ' ') { e.preventDefault(); G.callWave(); return; }
    if (k === 'p') { G.togglePause(); return; }
    if (k === 'm') { G.toggleMute(); return; }
    if (k === 'r' && (G.phase === 'victory' || G.phase === 'defeat' || G.phase === 'paused')) {
      G.restart(); return;
    }
    if (k === 'escape') { G.deselect(); return; }
    if (k === 't') { G.toggleTargeting(); return; }
    if (['1', '2', '3', '4'].includes(k)) {
      const types = ['spark', 'mortar', 'frost', 'storm'];
      G.selectTowerType(types[Number(k) - 1]);
    }
  });

  return input;
}

// Recompute the camera from the orbit state (called every frame).
export function updateCamera(G) {
  const { azimuth, distance } = G.input;
  const el = CAMERA.elevation;
  const [tx, ty, tz] = CAMERA.target;
  const x = tx + Math.sin(azimuth) * Math.cos(el) * distance;
  const y = ty + Math.sin(el) * distance;
  const z = tz + Math.cos(azimuth) * Math.cos(el) * distance;
  const shake = G.shakeOffset ? G.shakeOffset() : { x: 0, y: 0 };
  G.camera.position.set(x + shake.x, y + shake.y, z);
  G.camera.lookAt(tx, 0.5, tz);
}
