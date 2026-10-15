/* Patent page — a procedurally modelled controller unit that comes apart
   layer by layer as the visitor scrolls through the pinned stage.

   Nothing here is a technical drawing of the invention: the parts are an
   artistic stand-in for "sense → unify → decide → guard → act". Everything is
   built from primitives and canvas textures, so there are no model files.

   Scroll progress (0 → 1 across the stage) drives every pose; time only adds
   idle life (LEDs, the state ring, the fan). */
import * as THREE from "three";

import {
  NIGHT,
  AMBER,
  PAPER,
  MONO,
  DISPLAY,
  clamp,
  smooth,
  easeOut,
  windowed,
  rng,
  roundedRect,
  extrudeUp,
  slab,
  canvasTexture,
  drawSprite,
  makeEnvironment,
  tube,
  runStage
} from "./patent-kit.js";

const ACCENT = 0xffb21a;

/* --------------------------------------------------------------------------
   Canvas artwork — board silkscreen, lid etching, part markings
   -------------------------------------------------------------------------- */

const BOARD = { w: 11, d: 7.6 };

function drawBoard(ctx, W, H) {
  const sx = W / BOARD.w;
  const X = (x) => (x + BOARD.w / 2) * sx;
  const Z = (z) => (z + BOARD.d / 2) * (H / BOARD.d);
  const rand = rng(106171);

  ctx.fillStyle = "#121513";
  ctx.fillRect(0, 0, W, H);

  // Ground pour, hatched.
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(-5.3), Z(-3.6), X(5.3) - X(-5.3), Z(3.6) - Z(-3.6));
  ctx.clip();
  ctx.strokeStyle = "rgba(201, 148, 74, 0.06)";
  ctx.lineWidth = 2;
  for (let i = -H; i < W; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // Perfboard field.
  const pads = [];
  for (let gx = -5.0; gx <= 0.6; gx += 0.4) {
    for (let gz = -3.3; gz <= 2.2; gz += 0.4) pads.push([gx, gz]);
  }
  for (let gx = 0.6; gx <= 5.0; gx += 0.4) {
    for (let gz = 2.4; gz <= 3.3; gz += 0.4) pads.push([gx, gz]);
  }

  // Traces: orthogonal run, then a 45° leg, copper on black.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 46; i++) {
    const a = pads[Math.floor(rand() * pads.length)];
    const b = [a[0] + (rand() - 0.5) * 7, a[1] + (rand() - 0.5) * 5];
    b[0] = clamp(b[0], -5.2, 5.2);
    b[1] = clamp(b[1], -3.5, 3.5);
    const x0 = X(a[0]);
    const y0 = Z(a[1]);
    const x1 = X(b[0]);
    const y1 = Z(b[1]);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const run = Math.max(0, Math.abs(dx) - Math.abs(dy));
    ctx.strokeStyle = i % 5 === 0 ? "rgba(224, 162, 103, 0.95)" : "rgba(184, 128, 62, 0.7)";
    ctx.lineWidth = i % 7 === 0 ? 9 : 5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    const mx = x0 + Math.sign(dx) * run;
    ctx.lineTo(mx, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.fillStyle = "#d9b061";
    ctx.beginPath();
    ctx.arc(x1, y1, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const [gx, gz] of pads) {
    ctx.fillStyle = "#cfa65a";
    ctx.beginPath();
    ctx.arc(X(gx), Z(gz), 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b0c0b";
    ctx.beginPath();
    ctx.arc(X(gx), Z(gz), 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silkscreen.
  ctx.strokeStyle = "#e9e4d8";
  ctx.fillStyle = "#e9e4d8";
  ctx.lineWidth = 4;
  const box = (x, z, w, d, label, lx, lz) => {
    ctx.strokeRect(X(x - w / 2), Z(z - d / 2), w * sx, d * (H / BOARD.d));
    if (label) {
      ctx.font = `500 30px ${MONO}`;
      ctx.fillText(label, X(lx ?? x - w / 2), Z(lz ?? z - d / 2) - 12);
    }
  };
  box(2.6, -0.3, 3.6, 4.6, "U1  CORE", 0.85, -2.6);
  box(-3.2, -1.6, 2.5, 2.0, "K1", -4.45, -2.6);
  box(-3.2, 3.1, 3.2, 0.9, "J1  LOAD", -4.8, 2.65);
  box(-0.6, -2.9, 1.6, 0.7, "J2  SENSE", -1.4, -3.25);
  box(-0.2, 1.4, 1.6, 1.6, "U2", -1.0, 0.6);

  ctx.font = `500 34px ${MONO}`;
  ctx.fillText("OC-01  REV A", X(1.0), Z(2.25));
  ctx.font = `500 26px ${MONO}`;
  ctx.fillText("IN 202641106171", X(1.0), Z(2.25) + 34);
  ctx.save();
  ctx.translate(X(5.25), Z(3.4));
  ctx.rotate(-Math.PI / 2);
  ctx.font = `500 24px ${MONO}`;
  ctx.fillText("SENSE → UNIFY → DECIDE → GUARD → ACT", 0, 0);
  ctx.restore();

  // Fiducials and a small mark.
  for (const [fx, fz] of [
    [-5.2, -3.5],
    [5.2, -3.5],
    [-5.2, 3.5]
  ]) {
    ctx.fillStyle = "#d9b061";
    ctx.beginPath();
    ctx.arc(X(fx), Z(fz), 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e9e4d8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(X(fx), Z(fz), 24, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawLid(ctx, W, H, sensor) {
  ctx.clearRect(0, 0, W, H);
  const sx = W / 12;
  const sz = H / 8.6;
  const X = (x) => (x + 6) * sx;
  const Z = (z) => (z + 4.3) * sz;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.fillStyle = "rgba(255,255,255,0.9)";

  // Inset border.
  ctx.lineWidth = 3;
  ctx.strokeRect(46, 46, W - 92, H - 92);

  // Corner crosshairs.
  ctx.lineWidth = 3;
  for (const [cx, cy] of [
    [110, 110],
    [W - 110, 110],
    [110, H - 110],
    [W - 110, H - 110]
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy);
    ctx.lineTo(cx + 26, cy);
    ctx.moveTo(cx, cy - 26);
    ctx.lineTo(cx, cy + 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Dial around the sensor window.
  const cx = X(sensor.x);
  const cy = Z(sensor.z);
  const r = 1.22 * sx;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const len = i % 6 === 0 ? 34 : 14;
    ctx.lineWidth = i % 6 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r + 10), cy + Math.sin(a) * (r + 10));
    ctx.lineTo(cx + Math.cos(a) * (r + 10 + len), cy + Math.sin(a) * (r + 10 + len));
    ctx.stroke();
  }

  // Dot field on the right.
  for (let gx = X(2.2); gx < W - 150; gx += 30) {
    for (let gy = 160; gy < H * 0.48; gy += 30) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Wordmark.
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 168px ${DISPLAY}`;
  ctx.fillText("ORCHESTRATED", 120, H - 300);
  ctx.font = `800 168px ${DISPLAY}`;
  ctx.fillText("CONTROL", 120, H - 140);
  ctx.font = `500 30px ${MONO}`;
  ctx.fillText("IN 202641106171 A1  ·  VIT CHENNAI  ·  2026", 124, H - 92);
  ctx.textAlign = "right";
  ctx.fillText("OC-01 / UNIT", W - 124, H - 92);
  ctx.fillText("FIG. 01", W - 124, 140);
  ctx.textAlign = "left";
}

function drawShield(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#c9ccd0");
  g.addColorStop(0.5, "#eef0f2");
  g.addColorStop(1, "#aeb2b7");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rand = rng(42);
  // Brushed finish.
  for (let i = 0; i < 900; i++) {
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? "255,255,255" : "70,74,80"},${0.04 + rand() * 0.05})`;
    const y = rand() * H;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + (rand() - 0.5) * 6);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(30, 30, 32, 0.78)";
  ctx.font = `500 46px ${MONO}`;
  ctx.fillText("OC-CORE", 46, 96);
  ctx.font = `500 28px ${MONO}`;
  ctx.fillText("ORCHESTRATION", 46, 148);
  ctx.fillText("MODULE  M1", 46, 186);
  ctx.fillText("2.4 GHz  ·  REV A", 46, 224);
  // A 2D code block.
  const r2 = rng(7);
  const cell = 14;
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      const corner = (i < 3 && j < 3) || (i > 8 && j < 3) || (i < 3 && j > 8);
      if (corner || r2() > 0.55) ctx.fillRect(W - 46 - 12 * cell + i * cell, H - 46 - 12 * cell + j * cell, cell - 1, cell - 1);
    }
  }
  ctx.strokeStyle = "rgba(30,30,32,0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(70, H - 70, 18, 0, Math.PI * 2);
  ctx.stroke();
}

function drawModule(ctx, W, H) {
  ctx.fillStyle = "#0f1a17";
  ctx.fillRect(0, 0, W, H);
  // Meander antenna at the far end.
  ctx.strokeStyle = "#d9b061";
  ctx.lineWidth = 8;
  ctx.beginPath();
  let x = 40;
  ctx.moveTo(x, 110);
  for (let i = 0; i < 9; i++) {
    ctx.lineTo(x, i % 2 ? 110 : 30);
    x += 44;
    ctx.lineTo(x, i % 2 ? 110 : 30);
  }
  ctx.stroke();
  // Castellated pads down both long edges.
  ctx.fillStyle = "#d9b061";
  for (let y = 170; y < H - 20; y += 34) {
    ctx.fillRect(0, y, 18, 18);
    ctx.fillRect(W - 18, y, 18, 18);
  }
  ctx.fillStyle = "#e9e4d8";
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText("ANT", W - 70, 140);
}

function drawRelay(ctx, W, H) {
  ctx.fillStyle = "#f2a51c";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(13, 12, 10, 0.86)";
  ctx.font = `800 64px ${DISPLAY}`;
  ctx.fillText("K1", 34, 92);
  ctx.font = `500 26px ${MONO}`;
  ctx.fillText("GUARDED ACTUATOR", 34, 140);
  ctx.fillText("5 VDC  ·  10 A 250 VAC", 34, 176);
  ctx.fillText("NO ─┤├─ COM ─┤/├─ NC", 34, 212);
  ctx.strokeStyle = "rgba(13, 12, 10, 0.86)";
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, W - 40, H - 40);
}

function build(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.Fog(NIGHT, 48, 110);
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.85;

  /* Lights ---------------------------------------------------------------- */
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
  key.position.set(-9, 18, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 18;
  key.shadow.camera.bottom = -18;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 5;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffa04a, 1.8);
  rim.position.set(12, 7, -13);
  scene.add(rim);

  scene.add(new THREE.HemisphereLight(0xf2ece2, 0x0d0c0a, 0.35));

  const glow = new THREE.PointLight(0xffb04a, 0, 0, 2);
  glow.position.set(0.5, 3.4, 0);
  scene.add(glow);

  /* Floor & grid ---------------------------------------------------------- */
  const FLOOR = -3.4;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x100f0d, roughness: 0.92, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR;
  floor.receiveShadow = true;
  scene.add(floor);

  const gridPts = [];
  for (let i = -40; i <= 40; i += 2) {
    gridPts.push(i, 0, -40, i, 0, 40, -40, 0, i, 40, 0, i);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3));
  const grid = new THREE.LineSegments(
    gridGeo,
    new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.09 })
  );
  grid.position.y = FLOOR + 0.01;
  scene.add(grid);

  /* Materials ------------------------------------------------------------- */
  const M = {
    shell: new THREE.MeshPhysicalMaterial({
      color: 0x2a2724,
      metalness: 0.85,
      roughness: 0.36,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3
    }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc4c7cb, metalness: 1, roughness: 0.22 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a46a, metalness: 1, roughness: 0.3 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd8ad55, metalness: 1, roughness: 0.25 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x2c2a20, roughness: 0.7 }),
    under: new THREE.MeshStandardMaterial({ color: 0x0c0d0c, roughness: 0.8 }),
    plastic: new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.45, metalness: 0.1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0a09, roughness: 0.95 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x1f2633, roughness: 0.35, metalness: 0.2 }),
    acrylic: new THREE.MeshPhysicalMaterial({
      color: 0x3a342d,
      metalness: 0,
      roughness: 0.06,
      transparent: true,
      opacity: 0.58,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      ior: 1.5,
      specularIntensity: 1
    }),
    dome: new THREE.MeshPhysicalMaterial({
      color: 0xf2ece2,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      flatShading: true,
      sheen: 0.4
    }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(2.2), toneMapped: false }),
    ledIdle: new THREE.MeshBasicMaterial({ color: 0x3a2a14 })
  };

  const shadow = (obj) => {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return obj;
  };

  const model = new THREE.Group();
  scene.add(model);

  const anchors = {};
  const anchor = (parent, name, x, y, z) => {
    const a = new THREE.Object3D();
    a.position.set(x, y, z);
    parent.add(a);
    anchors[name] = a;
    return a;
  };

  /* Enclosure tray -------------------------------------------------------- */
  const tray = new THREE.Group();
  {
    const floorSlab = new THREE.Mesh(slab(12, 0.3, 8.6, 0.7, 0.06), M.shell);
    floorSlab.position.y = 0.15;
    tray.add(floorSlab);

    const outer = roundedRect(12, 8.6, 0.7);
    outer.holes.push(roundedRect(11.36, 7.96, 0.42, 0, 0, new THREE.Path()));
    const walls = new THREE.Mesh(extrudeUp(outer, 2.1, 0.04), M.shell);
    walls.position.y = 0.3 + 1.05;
    tray.add(walls);

    // Rubber feet.
    for (const [x, z] of [
      [-5.2, -3.6],
      [5.2, -3.6],
      [-5.2, 3.6],
      [5.2, 3.6]
    ]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 24), M.rubber);
      foot.position.set(x, -0.07, z);
      tray.add(foot);
    }

    // Front status light-pipes.
    tray.userData.leds = [];
    for (let i = 0; i < 3; i++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16), M.ledIdle.clone());
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(4.3 + i * 0.42, 1.55, 4.31);
      tray.add(pipe);
      tray.userData.leds.push(pipe);
    }

    // Side vents.
    for (let i = 0; i < 7; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.9), M.rubber);
      vent.position.set(6.0, 0.9 + i * 0.2, -1.2);
      tray.add(vent);
    }

    // Engraved front plate.
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.5),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(640, 100, (ctx, W, H) => {
          ctx.fillStyle = "rgba(242,236,226,0.72)";
          ctx.font = `500 34px ${MONO}`;
          ctx.textBaseline = "middle";
          ctx.fillText("OC-01  ·  ORCHESTRATED CONTROL", 0, H / 2);
        }),
        transparent: true,
        depthWrite: false
      })
    );
    plate.position.set(-3.4, 1.4, 4.302);
    tray.add(plate);
  }
  anchor(tray, "shell", 6.0, 0.5, 0.6);
  model.add(shadow(tray));

  /* Main board ------------------------------------------------------------ */
  const board = new THREE.Group();
  board.position.y = 0.8;
  {
    const boardTex = canvasTexture(2048, Math.round((2048 * BOARD.d) / BOARD.w), drawBoard);
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(BOARD.w, 0.16, BOARD.d), [
      M.edge,
      M.edge,
      new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.5, metalness: 0.15 }),
      M.under,
      M.edge,
      M.edge
    ]);
    pcb.position.y = 0.08;
    board.add(pcb);

    for (const [x, z] of [
      [-5.1, -3.4],
      [5.1, -3.4],
      [-5.1, 3.4],
      [5.1, 3.4]
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 6), M.brass);
      post.position.set(x, -0.25, z);
      board.add(post);
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 20), M.steel);
      screw.position.set(x, 0.2, z);
      board.add(screw);
    }

    const top = 0.16;

    // Terminal block row (J1).
    for (let i = 0; i < 4; i++) {
      const x = -4.45 + i * 0.75;
      const blk = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.7, 0.8), M.plastic);
      blk.position.set(x, top + 0.35, 3.1);
      board.add(blk);
      const scr = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 18), M.steel);
      scr.position.set(x, top + 0.72, 3.0);
      board.add(scr);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.05), M.rubber);
      slot.position.set(x, top + 0.755, 3.0);
      slot.rotation.y = 0.6;
      board.add(slot);
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.02), M.rubber);
      mouth.position.set(x, top + 0.3, 3.51);
      board.add(mouth);
    }

    // Co-processor (U2) with gull-wing pins.
    const chip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 1.2), M.dark);
    chip.position.set(-0.2, top + 0.1, 1.4);
    board.add(chip);
    const pinGeo = new THREE.BoxGeometry(0.05, 0.04, 0.22);
    const pins = new THREE.InstancedMesh(pinGeo, M.steel, 40);
    const dummy = new THREE.Object3D();
    let k = 0;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < 10; i++) {
        const t = -0.5 + (i + 0.5) / 10;
        const along = t * 1.1;
        dummy.rotation.set(0, side % 2 ? Math.PI / 2 : 0, 0);
        if (side === 0) dummy.position.set(-0.2 + along, top + 0.03, 1.4 + 0.68);
        if (side === 1) dummy.position.set(-0.2 + 0.68, top + 0.03, 1.4 + along);
        if (side === 2) dummy.position.set(-0.2 + along, top + 0.03, 1.4 - 0.68);
        if (side === 3) dummy.position.set(-0.2 - 0.68, top + 0.03, 1.4 + along);
        dummy.updateMatrix();
        pins.setMatrixAt(k++, dummy.matrix);
      }
    }
    board.add(pins);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16), M.plastic);
    dot.position.set(-0.6, top + 0.185, 1.0);
    board.add(dot);

    // Electrolytic caps.
    for (const [x, z, h] of [
      [-1.0, 2.55, 0.8],
      [-0.25, 2.65, 0.65],
      [0.55, 2.55, 0.8]
    ]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, h, 28), M.cap);
      can.position.set(x, top + h / 2, z);
      board.add(can);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 28), M.steel);
      lid.position.set(x, top + h + 0.005, z);
      board.add(lid);
    }

    // Scattered passives.
    const passive = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.08, 0.13), M.dark, 36);
    const r = rng(11);
    for (let i = 0; i < 36; i++) {
      dummy.position.set(-1.6 + r() * 2.3, top + 0.04, -0.4 + r() * 1.2);
      dummy.rotation.set(0, r() > 0.5 ? Math.PI / 2 : 0, 0);
      dummy.updateMatrix();
      passive.setMatrixAt(i, dummy.matrix);
    }
    board.add(passive);

    // Crystal.
    const xtal = new THREE.Mesh(slab(0.7, 0.14, 0.32, 0.15, 0.03), M.steel);
    xtal.position.set(0.85, top + 0.07, 1.1);
    board.add(xtal);

    // Header J2 where the sensor ribbon lands.
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.5), M.rubber);
    base.position.set(-0.6, top + 0.11, -2.9);
    board.add(base);
    const hp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), M.gold, 12);
    for (let i = 0; i < 12; i++) {
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(-1.15 + (i % 6) * 0.22, top + 0.35, -3.0 + Math.floor(i / 6) * 0.2);
      dummy.updateMatrix();
      hp.setMatrixAt(i, dummy.matrix);
    }
    board.add(hp);

    // USB-C and RJ45 at the front edge.
    const usb = new THREE.Mesh(slab(0.9, 0.32, 0.75, 0.15, 0.04), M.steel);
    usb.position.set(4.6, top + 0.16, 3.4);
    board.add(usb);
    const usbHole = new THREE.Mesh(slab(0.7, 0.14, 0.02, 0.06, 0.005), M.rubber);
    usbHole.position.set(4.6, top + 0.16, 3.78);
    board.add(usbHole);
    const rj = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.25, 1.6), M.steel);
    rj.position.set(2.8, top + 0.625, 3.05);
    board.add(rj);
    const rjMouth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.75, 0.02), M.rubber);
    rjMouth.position.set(2.8, top + 0.55, 3.86);
    board.add(rjMouth);

    // Status LEDs on the board.
    board.userData.leds = [];
    for (let i = 0; i < 4; i++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.1), M.ledIdle.clone());
      led.position.set(1.1 + i * 0.3, top + 0.04, -3.4);
      board.add(led);
      board.userData.leds.push(led);
    }
  }
  anchor(board, "header", -0.6, 0.62, -2.9);
  model.add(shadow(board));

  /* Orchestration module (decide) ---------------------------------------- */
  const core = new THREE.Group();
  core.position.set(2.6, 0.96, -0.3);
  {
    const modTex = canvasTexture(512, 660, drawModule);
    const mod = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 4.4), [
      M.edge,
      M.edge,
      new THREE.MeshStandardMaterial({ map: modTex, roughness: 0.5, metalness: 0.15 }),
      M.under,
      M.edge,
      M.edge
    ]);
    mod.position.y = 0.06;
    core.add(mod);

    const shieldTex = canvasTexture(512, 480, drawShield);
    const side = new THREE.MeshStandardMaterial({ color: 0xc4c7cb, metalness: 1, roughness: 0.28 });
    const shield = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.34, 2.7), [
      side,
      side,
      new THREE.MeshStandardMaterial({ map: shieldTex, metalness: 0.85, roughness: 0.32 }),
      side,
      side,
      side
    ]);
    shield.position.set(0, 0.12 + 0.17, 0.65);
    core.add(shield);

    const halo = new THREE.Mesh(
      new THREE.BoxGeometry(3.15, 0.6, 2.95),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    halo.position.copy(shield.position);
    core.add(halo);
    core.userData.halo = halo;
  }
  anchor(core, "core", 1.45, 0.46, 1.9);
  model.add(shadow(core));
  core.userData.halo.castShadow = false;

  /* Guarded actuator (relay) --------------------------------------------- */
  const relay = new THREE.Group();
  relay.position.set(-3.2, 0.96, -1.6);
  {
    const rTex = canvasTexture(512, 400, drawRelay);
    const body = new THREE.MeshStandardMaterial({ color: 0xf2a51c, roughness: 0.42 });
    const printed = new THREE.MeshStandardMaterial({ map: rTex, roughness: 0.42 });
    const sub = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 2.1), M.edge);
    sub.position.y = 0.05;
    relay.add(sub);
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.3, 1.75), [body, body, printed, body, body, body]);
    box.position.y = 0.1 + 0.65;
    relay.add(box);
    const halo = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 1.55, 2.0),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    halo.position.copy(box.position);
    relay.add(halo);
    relay.userData.halo = halo;
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.12), M.ledIdle.clone());
    ind.position.set(1.05, 0.14, 0.85);
    relay.add(ind);
    relay.userData.led = ind;
  }
  anchor(relay, "relay", -1.15, 1.0, 0.88);
  anchor(relay, "relayOut", -1.0, 0.3, 0.95);
  model.add(shadow(relay));
  relay.userData.halo.castShadow = false;

  /* Sensor head (sense) --------------------------------------------------- */
  const SENSOR = { x: -0.4, z: -0.6 };
  const sensor = new THREE.Group();
  sensor.position.set(SENSOR.x, 2.08, SENSOR.z);
  {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.1, 48), M.edge);
    sensor.add(disc);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), M.dome);
    dome.position.y = 0.05;
    sensor.add(dome);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.04, 0.035, 10, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(1.6), toneMapped: false })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    sensor.add(ring);
    sensor.userData.ring = ring;
    const th = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), M.plastic);
    th.position.set(0.85, 0.15, 0.6);
    sensor.add(th);
  }
  anchor(sensor, "sensor", 0.75, 0.8, 0.3);
  model.add(shadow(sensor));

  /* Lid ------------------------------------------------------------------- */
  const lid = new THREE.Group();
  lid.position.y = 2.4 + 0.125;
  {
    const shape = roundedRect(11.9, 8.5, 0.66);
    const hole = new THREE.Path();
    hole.absarc(SENSOR.x, -SENSOR.z, 1.1, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const plate = new THREE.Mesh(extrudeUp(shape, 0.25, 0.04), M.acrylic);
    plate.castShadow = true;
    lid.add(plate);
    const etchTex = canvasTexture(2048, Math.round((2048 * 8.6) / 12), (ctx, W, H) => drawLid(ctx, W, H, SENSOR));
    const etch = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 8.6),
      new THREE.MeshBasicMaterial({
        map: etchTex,
        transparent: true,
        opacity: 0.62,
        color: 0xf6e8d4,
        depthWrite: false
      })
    );
    etch.rotation.x = -Math.PI / 2;
    etch.position.y = 0.127;
    lid.add(etch);
    lid.userData.etch = etch;
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.05, 12, 64), M.steel);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(SENSOR.x, 0.13, SENSOR.z);
    lid.add(bezel);
    for (const [x, z] of [
      [-5.4, -3.75],
      [5.4, -3.75],
      [-5.4, 3.75],
      [5.4, 3.75]
    ]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 6), M.steel);
      s.position.set(x, 0.15, z);
      s.castShadow = true;
      lid.add(s);
    }
  }
  anchor(lid, "lid", -5.6, 0.2, 3.9);
  model.add(lid);

  /* Unified state ring ---------------------------------------------------- */
  const state = new THREE.Group();
  state.position.set(0.3, 3.8, 0);
  {
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(AMBER).multiplyScalar(1.4),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.018, 8, 200), ringMat);
    ring.rotation.x = Math.PI / 2;
    state.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.01, 8, 200), ringMat);
    inner.rotation.x = Math.PI / 2;
    state.add(inner);

    const ticks = new THREE.Group();
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const len = i % 4 === 0 ? 0.55 : 0.22;
      const t = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.03), ringMat);
      t.position.set(Math.cos(a) * (6.6 + len / 2 + 0.08), 0, Math.sin(a) * (6.6 + len / 2 + 0.08));
      t.rotation.y = -a;
      ticks.add(t);
    }
    state.add(ticks);

    const n = 520;
    const pos = new Float32Array(n * 3);
    const r = rng(3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rad = 5.9 + (r() - 0.5) * 1.2 + (r() > 0.85 ? (r() - 0.5) * 3 : 0);
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = (r() - 0.5) * 0.5;
      pos[i * 3 + 2] = Math.sin(a) * rad;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        size: 0.16,
        map: canvasTexture(64, 64, drawSprite),
        color: new THREE.Color(ACCENT),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    state.add(points);
    state.userData = { ringMat, points, ticks };
  }
  anchor(state, "state", -4.6, 0, 4.6);
  model.add(state);

  /* Physical asset — a ceiling fan (act) ---------------------------------- */
  const fan = new THREE.Group();
  const FAN = new THREE.Vector3(10, 5.6, -2.5);
  fan.position.copy(FAN);
  {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 40, 12), M.steel);
    rod.position.y = 20.3;
    fan.add(rod);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 0.6, 40), M.plastic);
    housing.position.y = 0.1;
    fan.add(housing);
    const capBot = new THREE.Mesh(new THREE.SphereGeometry(0.85, 40, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.plastic);
    capBot.position.y = -0.2;
    capBot.scale.y = 0.45;
    fan.add(capBot);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.87, 0.08, 40), new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.4 }));
    band.position.y = -0.18;
    fan.add(band);

    const rotor = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = (i / 3) * Math.PI * 2;
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.3), M.steel);
      bracket.position.set(1.2, 0, 0);
      arm.add(bracket);
      const blade = new THREE.Mesh(slab(3.6, 0.07, 0.95, 0.42, 0.02), M.plastic);
      blade.position.set(3.4, 0.02, 0);
      blade.rotation.x = 0.12;
      arm.add(blade);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.075, 0.9), new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.4 }));
      tip.position.set(4.95, 0.025, 0);
      tip.rotation.x = 0.12;
      arm.add(tip);
      rotor.add(arm);
    }
    rotor.position.y = -0.02;
    fan.add(rotor);
    fan.userData.rotor = rotor;
  }
  anchor(fan, "fan", 0.3, -0.75, 0.3);
  anchor(fan, "fanIn", 0, 0.45, 0);
  model.add(shadow(fan));

  /* Assembly guides — dashed lines between separated layers --------------- */
  const guidePairs = [
    // lid corners ↔ tray corners
    [lid, [-5.6, -0.12, -4.0], tray, [-5.6, 2.4, -4.0]],
    [lid, [5.6, -0.12, -4.0], tray, [5.6, 2.4, -4.0]],
    [lid, [-5.6, -0.12, 4.0], tray, [-5.6, 2.4, 4.0]],
    [lid, [5.6, -0.12, 4.0], tray, [5.6, 2.4, 4.0]],
    // board posts ↔ tray floor
    [board, [-5.1, -0.5, -3.4], tray, [-5.1, 0.3, -3.4]],
    [board, [5.1, -0.5, 3.4], tray, [5.1, 0.3, 3.4]],
    // module ↔ board
    [core, [-1.7, 0, -2.2], board, [0.9, 0.16, -2.5]],
    [core, [1.7, 0, 2.2], board, [4.3, 0.16, 1.9]],
    // relay ↔ board
    [relay, [-1.3, 0, 1.05], board, [-4.5, 0.16, -0.55]],
    [relay, [1.3, 0, -1.05], board, [-1.9, 0.16, -2.65]],
    // sensor ↔ board
    [sensor, [0, -0.05, 0], board, [-0.4, 0.16, -0.6]]
  ];
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(guidePairs.length * 6), 3));
  const guides = new THREE.LineSegments(
    guideGeo,
    new THREE.LineDashedMaterial({ color: AMBER, dashSize: 0.22, gapSize: 0.18, transparent: true, opacity: 0 })
  );
  guides.frustumCulled = false;
  scene.add(guides);

  /* Wires: sensor ribbon and the actuator run to the fan ----------------- */
  const ribbonMats = [0xe0a267, PAPER, 0x55514b, PAPER].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })
  );
  const ribbons = ribbonMats.map((mat) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    m.castShadow = true;
    scene.add(m);
    return m;
  });
  const runMats = [
    new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.45 }),
    new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.5 })
  ];
  const runs = runMats.map((mat) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    m.castShadow = true;
    scene.add(m);
    return m;
  });

  const pulseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(2.4), toneMapped: false });
  const pulses = [];
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), pulseMat);
    p.visible = false;
    scene.add(p);
    pulses.push(p);
  }

  return {
    scene,
    lights: { glow, key },
    parts: { tray, board, core, relay, sensor, lid, state, fan },
    anchors,
    guides,
    guidePairs,
    ribbons,
    runs,
    pulses,
    FAN,
    SENSOR
  };
}

/* --------------------------------------------------------------------------
   Camera path, captions and tags
   -------------------------------------------------------------------------- */

const KEYS = [
  { p: 0.0, az: -0.62, el: 0.66, r: 31, tx: 0, ty: 1.0 },
  { p: 0.18, az: -0.38, el: 0.52, r: 35, tx: 0, ty: 3.4 },
  // Pulled back while the lid is at its highest, so it clears the HUD on short screens.
  { p: 0.3, az: -0.16, el: 0.44, r: 41, tx: 0, ty: 4.8 },
  { p: 0.42, az: 0.08, el: 0.36, r: 39, tx: 0, ty: 4.4 },
  { p: 0.62, az: 0.42, el: 0.3, r: 35, tx: 0.6, ty: 3.4 },
  { p: 0.8, az: 0.72, el: 0.28, r: 41, tx: 3.6, ty: 4.0 },
  { p: 1.0, az: 0.92, el: 0.36, r: 45, tx: 4.6, ty: 3.8 }
];

const CUTS = [0.14, 0.36, 0.52, 0.68, 0.82];

const TAGS = [
  { a: "shell", step: [0], k: "01 · Enclosure", t: "Machined aluminium shell", left: true },
  { a: "lid", step: [0], k: "01 · Enclosure", t: "Smoked acrylic lid", minor: true },
  { a: "sensor", step: [1], k: "02 · Sense", t: "Sensor head" },
  { a: "header", step: [1], k: "02 · Sense", t: "Telemetry bus", minor: true },
  { a: "state", step: [2], k: "03 · Unify", t: "Unified state" },
  { a: "core", step: [3], k: "04 · Decide", t: "Orchestration core" },
  { a: "relay", step: [4], k: "05 · Guard", t: "Guarded actuator", left: true },
  { a: "fan", step: [5], k: "06 · Act", t: "Physical asset" }
];

/* --------------------------------------------------------------------------
   Pose — every part's position as a function of scroll progress
   -------------------------------------------------------------------------- */

function makePose(W) {
  const { parts, anchors } = W;
  /* Pose ------------------------------------------------------------------ */
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  let wireKey = "";

  function place(p, time) {
    const lidT = smooth(0.08, 0.3, p);
    const expl = smooth(0.16, 0.46, p);
    const senseT = smooth(0.2, 0.4, p);
    const ringT = smooth(0.38, 0.5, p);
    const decideT = windowed(0.5, 0.56, 0.66, 0.72, p);
    const guardT = windowed(0.66, 0.71, 0.8, 0.86, p);
    const fanT = smooth(0.76, 0.9, p);
    const wireT = smooth(0.8, 0.93, p);
    const spinT = smooth(0.88, 1, p);

    parts.tray.position.y = -2.0 * easeOut(expl);
    parts.board.position.y = 0.8 + 0.4 * expl;
    parts.core.position.set(2.6 + 0.5 * expl, 0.96 + 0.4 * expl + 2.7 * smooth(0.22, 0.48, p), -0.3);
    parts.relay.position.set(-3.2 - 0.7 * expl, 0.96 + 0.4 * expl + 2.0 * smooth(0.24, 0.5, p), -1.6);
    parts.sensor.position.y = 2.08 + 0.4 * expl + 3.2 * senseT;
    parts.lid.position.set(-0.8 * lidT, 2.525 + 5.7 * easeOut(lidT), -4.4 * lidT);
    parts.lid.rotation.set(0.42 * lidT, 0, 0.08 * lidT);
    parts.lid.userData.etch.material.opacity = 0.62 - 0.25 * smooth(0.5, 0.8, p);

    const st = parts.state.userData;
    st.ringMat.opacity = ringT * (0.75 - 0.35 * smooth(0.75, 0.95, p));
    st.points.material.opacity = ringT * 0.9;
    parts.state.scale.setScalar(0.7 + 0.3 * easeOut(ringT));
    parts.state.visible = ringT > 0.001;
    parts.state.rotation.y = time * 0.12 + p * 2;
    st.ticks.rotation.y = -time * 0.05;
    W.lights.glow.intensity = 34 * ringT;

    const pulse = 0.55 + 0.45 * Math.sin(time * 4);
    parts.core.userData.halo.material.opacity = decideT * 0.55 * pulse;
    parts.relay.userData.halo.material.opacity = guardT * 0.55 * pulse;
    parts.relay.userData.led.material.color.setHex(guardT > 0.5 || spinT > 0 ? ACCENT : 0x3a2a14);

    // Sensor ring breathes while sensing.
    parts.sensor.userData.ring.material.color
      .setHex(ACCENT)
      .multiplyScalar(0.4 + 1.6 * (smooth(0.18, 0.3, p) * (0.6 + 0.4 * Math.sin(time * 3))));

    // LEDs.
    parts.tray.userData.leds.forEach((led, i) => {
      const on = Math.sin(time * (1.3 + i * 0.7) + i) > 0.2 || i === 0;
      led.material.color.setHex(on ? ACCENT : 0x2a1e10);
    });
    parts.board.userData.leds.forEach((led, i) => {
      const on = Math.sin(time * (2 + i * 1.1) + i * 2) > -0.1;
      led.material.color.setHex(on && expl > 0.2 ? ACCENT : 0x2a1e10);
    });

    // Fan drops in and spins up.
    parts.fan.visible = fanT > 0.001;
    parts.fan.position.set(W.FAN.x, W.FAN.y + (1 - easeOut(fanT)) * 9, W.FAN.z);
    parts.fan.scale.setScalar(0.65 + 0.35 * easeOut(fanT));

    // Dashed guides.
    const gOpacity = 0.7 * smooth(0.12, 0.3, p) * (1 - 0.6 * smooth(0.8, 1, p));
    W.guides.material.opacity = gOpacity;
    W.guides.visible = gOpacity > 0.01;
    if (W.guides.visible) {
      const arr = W.guides.geometry.attributes.position.array;
      W.guidePairs.forEach(([ga, pa, gb, pb], i) => {
        ga.updateMatrixWorld();
        gb.updateMatrixWorld();
        v.set(pa[0], pa[1], pa[2]).applyMatrix4(ga.matrixWorld);
        v2.set(pb[0], pb[1], pb[2]).applyMatrix4(gb.matrixWorld);
        arr.set([v.x, v.y, v.z, v2.x, v2.y, v2.z], i * 6);
      });
      W.guides.geometry.attributes.position.needsUpdate = true;
      W.guides.computeLineDistances();
    }

    // Wires — rebuilt only when the parts they join have moved.
    const key = [senseT, expl, fanT, wireT].map((n) => n.toFixed(3)).join();
    if (key !== wireKey) {
      wireKey = key;
      parts.sensor.updateMatrixWorld();
      parts.board.updateMatrixWorld();
      W.ribbons.forEach((m, i) => {
        const x = -0.2 + i * 0.13;
        const a = new THREE.Vector3(x, -0.06, -1.2).applyMatrix4(parts.sensor.matrixWorld);
        const b = new THREE.Vector3(-1.0 + i * 0.22, 0.62, -2.9).applyMatrix4(parts.board.matrixWorld);
        const lift = a.y - b.y;
        tube(
          m,
          [
            a,
            new THREE.Vector3(a.x, a.y - 0.4, a.z - 0.5 - lift * 0.15),
            new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, b.z - 0.6 - lift * 0.18),
            new THREE.Vector3(b.x, b.y + 0.45, b.z - 0.15),
            b
          ],
          0.04,
          1
        );
      });
      W.runs.forEach((m, i) => {
        m.visible = wireT > 0.001;
        if (!m.visible) return;
        parts.relay.updateMatrixWorld();
        parts.fan.updateMatrixWorld();
        const s = anchors.relayOut.getWorldPosition(new THREE.Vector3());
        s.z += i * 0.18;
        const e = anchors.fanIn.getWorldPosition(new THREE.Vector3());
        e.z += i * 0.14 - 0.07;
        tube(
          m,
          [
            s,
            new THREE.Vector3(s.x - 0.8, s.y - 0.6, s.z + 0.8),
            new THREE.Vector3(s.x + 1.5, s.y - 2.6, s.z + 2.6 + i * 0.2),
            new THREE.Vector3((s.x + e.x) / 2 + 1, Math.min(s.y, e.y) - 2.2, (s.z + e.z) / 2 + 2.4),
            new THREE.Vector3(e.x - 2.2, e.y - 1.6, e.z + 0.9),
            new THREE.Vector3(e.x - 0.5, e.y - 0.2, e.z + 0.2),
            e
          ],
          0.055,
          wireT
        );
      });
    }

    // Packets: down the ribbon while sensing, out to the fan when acting.
    const sensePulse = windowed(0.26, 0.32, 0.6, 0.7, p);
    const actPulse = smooth(0.9, 0.95, p);
    W.pulses.forEach((dot, i) => {
      if (i < 4) {
        const c = W.ribbons[i].userData.curve;
        dot.visible = !!c && sensePulse > 0.02;
        if (dot.visible) {
          c.getPointAt((((time * 0.45 + i * 0.27) % 1) + 1) % 1, dot.position);
          dot.scale.setScalar(sensePulse);
        }
      } else {
        const c = W.runs[(i - 4) % 2].userData.curve;
        dot.visible = !!c && actPulse > 0.02 && W.runs[0].visible;
        if (dot.visible) {
          c.getPointAt((time * 0.35 + (i - 4) * 0.25) % 1, dot.position);
          dot.scale.setScalar(actPulse * 1.3);
        }
      }
    });

    return { spinT };
  }

  let fanAngle = 0;
  let fanSpeed = 0;

  return function pose(p, time, dt) {
    const { spinT } = place(p, time);
    fanSpeed += ((dt ? 0.6 + 9 * spinT : 0) - fanSpeed) * Math.min(1, dt * 2);
    fanAngle += fanSpeed * dt;
    parts.fan.userData.rotor.rotation.y = fanAngle;
  };
}

runStage({
  keys: KEYS,
  cuts: CUTS,
  tags: TAGS,
  build(renderer) {
    const W = build(renderer);
    return { scene: W.scene, anchors: W.anchors, pose: makePose(W) };
  }
});
