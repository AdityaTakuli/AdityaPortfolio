/* Patent page 01 — a modular drone with four ducted rotors that comes apart
   and goes through its moves as the visitor scrolls: wings detach, each rotor
   tilts on its own hinge, the body holds level, the bay swaps a battery for a
   payload, and it flies off with the rotors leaning forward.

   An artistic stand-in for the idea, not the patent's drawings. Built from
   primitives and canvas textures; staging, camera and HUD live in
   patent-kit.js. */
import * as THREE from "three";
import {
  NIGHT,
  AMBER,
  PAPER,
  MONO,
  DISPLAY,
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
  runStage
} from "./patent-kit.js";

const ACCENT = 0x2ee6d0;
const HOVER = 3.2; // fuselage axis height above the floor

/* --------------------------------------------------------------------------
   Canvas artwork
   -------------------------------------------------------------------------- */

function drawWingDecal(side) {
  return (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(13,12,10,0.7)";
    ctx.fillStyle = "rgba(13,12,10,0.78)";
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.font = `800 92px ${DISPLAY}`;
    ctx.fillText(`MODULE ${side}`, 60, H - 70);
    ctx.font = `500 30px ${MONO}`;
    ctx.fillText("UAV-01  ·  DETACHABLE WING  ·  TILT ×2", 64, 92);
    // Hazard ticks at the root edge.
    for (let i = 0; i < 14; i++) {
      ctx.fillRect(40 + i * 34, H / 2 - 4, 18, 8);
    }
    ctx.strokeStyle = "rgba(13,12,10,0.5)";
    ctx.beginPath();
    ctx.arc(W - 120, 120, 46, 0, Math.PI * 2);
    ctx.moveTo(W - 166, 120);
    ctx.lineTo(W - 74, 120);
    ctx.moveTo(W - 120, 74);
    ctx.lineTo(W - 120, 166);
    ctx.stroke();
  };
}

function drawBattery(ctx, W, H) {
  ctx.fillStyle = "#1b1a18";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2ee6d0";
  ctx.fillRect(0, 0, W, 26);
  ctx.fillStyle = "rgba(242,236,226,0.85)";
  ctx.font = `800 76px ${DISPLAY}`;
  ctx.fillText("POWER", 34, 130);
  ctx.font = `500 26px ${MONO}`;
  ctx.fillText("BAY MODULE  ·  B1", 38, 176);
  ctx.fillText("HOT-SWAP  ·  KEYED", 38, 212);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < 4 ? "#2ee6d0" : "rgba(242,236,226,0.25)";
    ctx.fillRect(38 + i * 52, 250, 40, 22);
  }
}

function drawPayload(ctx, W, H) {
  ctx.fillStyle = "#e8e4da";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(13,12,10,0.82)";
  ctx.font = `800 70px ${DISPLAY}`;
  ctx.fillText("PAYLOAD", 34, 120);
  ctx.font = `500 26px ${MONO}`;
  ctx.fillText("BAY MODULE  ·  P1", 38, 166);
  ctx.fillText("SENSOR POD", 38, 202);
  ctx.strokeStyle = "rgba(13,12,10,0.6)";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, W - 36, H - 36);
}

function drawBoard(ctx, W, H) {
  ctx.fillStyle = "#121513";
  ctx.fillRect(0, 0, W, H);
  const r = rng(53086);
  ctx.lineCap = "round";
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    const y = r() * H;
    const dx = (r() - 0.5) * W * 0.6;
    ctx.strokeStyle = i % 4 ? "rgba(184,128,62,0.7)" : "rgba(46,230,208,0.8)";
    ctx.lineWidth = i % 6 ? 3 : 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y);
    ctx.lineTo(x + dx + (r() - 0.5) * 60, y + (r() - 0.5) * 60);
    ctx.stroke();
  }
  ctx.fillStyle = "#e9e4d8";
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText("FC-01  ·  REV B", 16, H - 16);
}

/* --------------------------------------------------------------------------
   Scene
   -------------------------------------------------------------------------- */

function build(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.Fog(NIGHT, 48, 110);
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.9;

  const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
  key.position.set(-6, 20, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 70 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 5;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fe9ff, 1.4);
  rim.position.set(14, 6, -12);
  scene.add(rim);
  const warm = new THREE.DirectionalLight(0xffa04a, 0.9);
  warm.position.set(-14, 4, -8);
  scene.add(warm);
  scene.add(new THREE.HemisphereLight(0xf2ece2, 0x0d0c0a, 0.35));

  /* Floor & grid — the grid slides under the drone when it flies. */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshStandardMaterial({ color: 0x100f0d, roughness: 0.92 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const gridPts = [];
  for (let i = -44; i <= 44; i += 2) gridPts.push(i, 0, -44, i, 0, 44, -44, 0, i, 44, 0, i);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.09 }));
  grid.position.y = 0.01;
  scene.add(grid);

  /* Materials ------------------------------------------------------------- */
  const M = {
    hull: new THREE.MeshPhysicalMaterial({
      color: 0xe9e5dc,
      roughness: 0.32,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide
    }),
    hullInner: new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.7, side: THREE.BackSide }),
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x1c1b19, roughness: 0.4, metalness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0xc4c7cb, metalness: 1, roughness: 0.22 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.45, metalness: 0.1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
    accent: new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.35, metalness: 0.1 }),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(1.8), toneMapped: false }),
    blade: new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide })
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

  const anchors = {};
  const anchor = (parent, name, x, y, z) => {
    const a = new THREE.Object3D();
    a.position.set(x, y, z);
    parent.add(a);
    anchors[name] = a;
    return a;
  };

  /* The whole craft hovers; parts below are its children. */
  const craft = new THREE.Group();
  craft.position.y = HOVER;
  scene.add(craft);

  /* Fuselage — a lathed lozenge split into hull and canopy ---------------- */
  const L = 10;
  const R = 1.35;
  const FLAT = 0.64;
  const profile = [];
  for (let i = 0; i <= 48; i++) {
    const t = -1 + (2 * i) / 48;
    const r = R * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), 0.55) * (1 - 0.12 * Math.max(0, -t));
    profile.push(new THREE.Vector2(Math.max(r, 0.0001), (t * L) / 2));
  }
  const half = (start) => {
    const g = new THREE.LatheGeometry(profile, 64, start, Math.PI);
    g.rotateZ(-Math.PI / 2);
    g.scale(1, FLAT, 1);
    return g;
  };
  const hull = new THREE.Group();
  {
    const shell = new THREE.Mesh(half(0), M.hull);
    hull.add(shell);
    const inner = new THREE.Mesh(half(0), M.hullInner);
    inner.scale.set(0.985, 0.97, 0.97);
    hull.add(inner);
    // Accent band around the tail.
    const bandProfile = profile.filter((p) => p.y > -3.6 && p.y < -3.2).map((p) => new THREE.Vector2(p.x * 1.01, p.y));
    const band = new THREE.Mesh(new THREE.LatheGeometry(bandProfile, 64, 0, Math.PI), M.accent);
    band.geometry.rotateZ(-Math.PI / 2);
    band.geometry.scale(1, FLAT, 1);
    hull.add(band);
    // Belly sensor and nav lights.
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 12), M.glass);
    belly.position.set(3.4, -0.62, 0);
    hull.add(belly);
    hull.userData.navs = [];
    for (const [x, z] of [
      [-4.6, 0.25],
      [-4.6, -0.25]
    ]) {
      const nav = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), M.glow.clone());
      nav.position.set(x, 0, z);
      hull.add(nav);
      hull.userData.navs.push(nav);
    }
  }
  anchor(hull, "nose", 4.4, -0.3, 0.8);
  anchor(hull, "bay", -0.2, -0.75, 0.85);
  craft.add(shadow(hull));

  const canopy = new THREE.Group();
  {
    const shell = new THREE.Mesh(half(Math.PI), M.hull);
    canopy.add(shell);
    const window_ = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
    window_.scale.set(1.7, 0.42, 0.78);
    window_.position.set(2.5, R * FLAT * 0.72, 0);
    window_.rotation.z = -0.12;
    canopy.add(window_);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.02, 0.16), M.accent);
    stripe.position.set(-1.2, R * FLAT + 0.005, 0);
    canopy.add(stripe);
  }
  anchor(canopy, "canopy", -2.6, 0.9, 0.4);
  craft.add(shadow(canopy));

  /* Flight brain inside the hull, with gimbal rings around the IMU ------- */
  const brain = new THREE.Group();
  brain.position.set(1.7, 0.05, 0);
  {
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1.3), [
      M.dark,
      M.dark,
      new THREE.MeshStandardMaterial({ map: canvasTexture(512, 280, drawBoard), roughness: 0.5 }),
      M.dark,
      M.dark,
      M.dark
    ]);
    brain.add(pcb);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), M.dark);
    chip.position.set(-0.6, 0.08, 0);
    brain.add(chip);
    const imu = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.34), M.steel);
    imu.position.set(0.5, 0.16, 0);
    brain.add(imu);
    const gimbal = new THREE.Group();
    gimbal.position.copy(imu.position);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(ACCENT).multiplyScalar(1.5),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false
    });
    const rings = [0.62, 0.52, 0.42].map((rad, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.018, 8, 80), ringMat);
      gimbal.add(ring);
      return ring;
    });
    rings[0].rotation.x = Math.PI / 2;
    rings[1].rotation.y = Math.PI / 2;
    brain.add(gimbal);
    brain.userData = { gimbal, rings, ringMat };
  }
  anchor(brain, "brain", 0.5, 0.3, 0.3);
  craft.add(shadow(brain));
  brain.userData.rings.forEach((r) => (r.castShadow = false));

  /* Horizon ring — the level reference ----------------------------------- */
  const horizon = new THREE.Group();
  {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(ACCENT).multiplyScalar(1.3),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(9.2, 0.02, 8, 220), mat);
    ring.rotation.x = Math.PI / 2;
    horizon.add(ring);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const len = i % 6 === 0 ? 0.7 : 0.25;
      const t = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.03), mat);
      t.position.set(Math.cos(a) * (9.2 + len / 2 + 0.1), 0, Math.sin(a) * (9.2 + len / 2 + 0.1));
      t.rotation.y = -a;
      horizon.add(t);
    }
    // A long level line through the body axis.
    const line = new THREE.Mesh(new THREE.BoxGeometry(20, 0.012, 0.012), mat);
    horizon.add(line);
    horizon.userData.mat = mat;
  }
  anchor(horizon, "horizon", -8.0, 0, 5.2);
  craft.add(horizon);

  /* Wing modules, each with a boom, yokes and two ducted rotors ---------- */
  const rotors = [];
  const servos = [];
  function makeWing(side) {
    const s = side === "L" ? 1 : -1;
    const wing = new THREE.Group();

    const shape = new THREE.Shape();
    // Shape coords (x, y) → world (x, -z): z grows outward on the left wing.
    const root = 1.0 * s;
    const tip = 5.4 * s;
    shape.moveTo(-1.4, -root);
    shape.lineTo(1.25, -root);
    shape.lineTo(0.95, -tip);
    shape.lineTo(-0.95, -tip);
    shape.closePath();
    const panel = new THREE.Mesh(extrudeUp(shape, 0.2, 0.06), M.hull);
    panel.position.y = 0.05;
    wing.add(panel);

    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 3.6),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(560, 1000, (ctx, W, H) => {
          ctx.save();
          ctx.translate(W, 0);
          ctx.rotate(Math.PI / 2);
          drawWingDecal(side)(ctx, H, W);
          ctx.restore();
        }),
        transparent: true,
        depthWrite: false
      })
    );
    decal.rotation.x = -Math.PI / 2;
    if (s < 0) decal.rotation.z = Math.PI;
    decal.position.set(0, 0.156, 3.2 * s);
    wing.add(decal);

    // Root connector — the detachable joint.
    const plug = new THREE.Mesh(slab(1.4, 0.36, 0.5, 0.12, 0.04), M.dark);
    plug.position.set(0, 0.05, 1.05 * s);
    wing.add(plug);
    const pins = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.06), M.accent);
    pins.position.set(0, 0.05, 0.8 * s);
    wing.add(pins);

    // Boom along the tip.
    const Z = 5.6 * s;
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 4.4, 20), M.carbon);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(0, 0.05, Z);
    wing.add(boom);
    for (const x of [-2.2, 2.2]) {
      const capEnd = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 8), M.carbon);
      capEnd.position.set(x, 0.05, Z);
      wing.add(capEnd);
    }

    for (const fx of [1, -1]) {
      const X = 3.75 * fx;
      // Yoke: a bar across the duct's inner edge and two arms to the pivots.
      const yoke = new THREE.Group();
      yoke.position.set(2.15 * fx, 0.05, Z);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.5), M.carbon);
      yoke.add(bar);
      for (const dz of [-1.68, 1.68]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.14), M.carbon);
        arm.position.set(0.8 * fx, 0, dz);
        yoke.add(arm);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 16), M.steel);
        pin.rotation.x = Math.PI / 2;
        pin.position.set(1.6 * fx, 0, dz * 0.97);
        yoke.add(pin);
      }
      const servo = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.62), M.dark);
      servo.position.set(0.8 * fx, 0.24, 1.68 * Math.sign(Z));
      yoke.add(servo);
      const servoTop = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.2), M.accent);
      servoTop.position.set(0.8 * fx, 0.43, 1.68 * Math.sign(Z));
      yoke.add(servoTop);
      servos.push(servo);
      wing.add(yoke);

      // Rotor: pivot (tilts about z) → duct, spokes, hub, spinning prop.
      const pivot = new THREE.Group();
      pivot.position.set(X, 0.05, Z);
      const duct = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 64, 1, true), M.carbon);
      pivot.add(duct);
      for (const y of [-0.25, 0.25]) {
        const lip = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.07, 10, 64), y > 0 ? M.carbon : M.dark);
        lip.rotation.x = Math.PI / 2;
        lip.position.y = y;
        pivot.add(lip);
      }
      const glowRing = new THREE.Mesh(new THREE.TorusGeometry(1.43, 0.025, 8, 64), M.glow.clone());
      glowRing.rotation.x = Math.PI / 2;
      glowRing.position.y = 0.2;
      pivot.add(glowRing);
      for (let k = 0; k < 4; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.08), M.carbon);
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        spoke.position.set(Math.cos(a) * 0.8, -0.12, Math.sin(a) * 0.8);
        spoke.rotation.y = -a;
        pivot.add(spoke);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.42, 24), M.dark);
      hub.position.y = -0.04;
      pivot.add(hub);
      const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 24), M.accent);
      motorCap.position.y = 0.2;
      pivot.add(motorCap);
      const prop = new THREE.Group();
      prop.position.y = 0.12;
      for (let k = 0; k < 3; k++) {
        const blade = new THREE.Mesh(slab(1.25, 0.03, 0.26, 0.12, 0.01), M.blade);
        blade.position.x = 0.72;
        blade.rotation.x = 0.28;
        const arm = new THREE.Group();
        arm.rotation.y = (k / 3) * Math.PI * 2;
        arm.add(blade);
        prop.add(arm);
      }
      // Motion blur disc that fades in at speed.
      const blur = new THREE.Mesh(
        new THREE.CircleGeometry(1.38, 48),
        new THREE.MeshBasicMaterial({ color: 0x8a857c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      );
      blur.rotation.x = -Math.PI / 2;
      blur.position.y = 0.13;
      pivot.add(blur);
      pivot.add(prop);
      wing.add(pivot);
      rotors.push({ pivot, prop, blur, glowRing, angle: 0, spin: Math.random() * 6 });
    }
    return wing;
  }
  const wingL = makeWing("L");
  const wingR = makeWing("R");
  anchor(wingL, "wing", 0.4, 0.3, 3.4);
  anchor(rotors[0].pivot, "rotor", 0, 0.35, 1.5);
  anchor(rotors[1].pivot, "rotorRear", 0, -0.2, 1.5);
  anchor(rotors[0].pivot, "rotorFly", 1.4, 0.1, 0.4);
  anchor(wingL, "servo", -2.95, 0.5, 5.6 + 1.68);
  craft.add(shadow(wingL), shadow(wingR));
  rotors.forEach((r) => {
    r.blur.castShadow = false;
    r.glowRing.castShadow = false;
  });

  /* Bay modules ----------------------------------------------------------- */
  const battery = new THREE.Group();
  {
    const tex = canvasTexture(400, 300, drawBattery);
    const side = new THREE.MeshStandardMaterial({ color: 0x1b1a18, roughness: 0.5 });
    const printed = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.1), [side, side, side, side, printed, printed]);
    battery.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.3), M.accent);
    handle.position.y = -0.64;
    battery.add(handle);
  }
  anchor(battery, "battery", 0.75, 0.3, 0.55);
  scene.add(shadow(battery));

  const payload = new THREE.Group();
  {
    const tex = canvasTexture(400, 260, drawPayload);
    const side = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.4 });
    const printed = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.1), [side, side, side, side, printed, printed]);
    payload.add(body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.glass);
    eye.position.y = -0.6;
    payload.add(eye);
    const eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.04, 8, 40), M.accent);
    eyeRing.rotation.x = Math.PI / 2;
    eyeRing.position.y = -0.6;
    payload.add(eyeRing);
  }
  anchor(payload, "payload", -0.75, 0.3, 0.55);
  scene.add(shadow(payload));

  /* Assembly guides and speed lines -------------------------------------- */
  const guidePairs = [
    [wingL, [-1.2, 0.05, 1.0], hull, [-1.2, 0, 1.15]],
    [wingL, [1.1, 0.05, 1.0], hull, [1.1, 0, 1.15]],
    [wingR, [-1.2, 0.05, -1.0], hull, [-1.2, 0, -1.15]],
    [wingR, [1.1, 0.05, -1.0], hull, [1.1, 0, -1.15]],
    [canopy, [-4.0, 0, 0], hull, [-4.0, 0, 0]],
    [canopy, [3.8, 0, 0], hull, [3.8, 0, 0]],
    [brain, [-1.2, 0, 0], hull, [0.5, -0.4, 0]]
  ];
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(guidePairs.length * 6), 3));
  const guides = new THREE.LineSegments(
    guideGeo,
    new THREE.LineDashedMaterial({ color: AMBER, dashSize: 0.22, gapSize: 0.18, transparent: true, opacity: 0 })
  );
  guides.frustumCulled = false;
  scene.add(guides);

  const streaks = [];
  const streakMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(ACCENT).multiplyScalar(1.4),
    transparent: true,
    opacity: 0,
    toneMapped: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const rs = rng(9);
  for (let i = 0; i < 26; i++) {
    const len = 1.5 + rs() * 4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.025, 0.025), streakMat.clone());
    m.userData = { seed: rs() * 26, y: 0.6 + rs() * 7, z: -2 - rs() * 12, speed: 0.7 + rs() * 0.6 };
    scene.add(m);
    streaks.push(m);
  }

  // Exhaust-like downwash particles under each rotor.
  const washN = 240;
  const washPos = new Float32Array(washN * 3);
  const washSeed = [];
  const rw = rng(4);
  for (let i = 0; i < washN; i++) washSeed.push([rw(), rw() * Math.PI * 2, rw()]);
  const washGeo = new THREE.BufferGeometry();
  washGeo.setAttribute("position", new THREE.BufferAttribute(washPos, 3));
  const wash = new THREE.Points(
    washGeo,
    new THREE.PointsMaterial({
      size: 0.12,
      map: canvasTexture(64, 64, drawSprite),
      color: new THREE.Color(ACCENT),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  wash.frustumCulled = false;
  scene.add(wash);

  return {
    scene,
    anchors,
    parts: { craft, hull, canopy, brain, horizon, wingL, wingR, battery, payload },
    rotors,
    grid,
    guides,
    guidePairs,
    streaks,
    wash,
    washSeed
  };
}

/* --------------------------------------------------------------------------
   Camera path, captions and tags
   -------------------------------------------------------------------------- */

const KEYS = [
  { p: 0.0, az: 0.9, el: 0.36, r: 38, tx: 0, ty: 3.0 },
  { p: 0.22, az: 0.52, el: 0.62, r: 40, tx: 0, ty: 3.4 },
  { p: 0.44, az: 0.3, el: 0.34, r: 36, tx: 0, ty: 3.4 },
  { p: 0.6, az: 0.06, el: 0.1, r: 34, tx: 0, ty: 3.4 },
  { p: 0.76, az: 0.42, el: 0.14, r: 31, tx: 0, ty: 2.2 },
  { p: 1.0, az: 0.24, el: 0.16, r: 34, tx: 0, ty: 3.2 }
];

const CUTS = [0.14, 0.36, 0.52, 0.68, 0.82];

const TAGS = [
  { a: "nose", step: [0], k: "01 · Airframe", t: "Level-body fuselage" },
  { a: "rotor", step: [0], k: "01 · Airframe", t: "Ducted rotor", minor: true },
  { a: "wing", step: [1], k: "02 · Modular", t: "Detachable wing module" },
  { a: "canopy", step: [1], k: "02 · Modular", t: "Access canopy", minor: true },
  { a: "rotor", step: [2], k: "03 · Tilt", t: "Independent tilt hinge" },
  { a: "servo", step: [2], k: "03 · Tilt", t: "Servo actuator", minor: true },
  { a: "horizon", step: [3], k: "04 · Level", t: "Body holds level" },
  { a: "brain", step: [3], k: "04 · Level", t: "Inertial sensing", minor: true },
  { a: "battery", step: [4], k: "05 · Swap", t: "Battery module" },
  { a: "payload", step: [4], k: "05 · Swap", t: "Payload module", left: true },
  { a: "rotorFly", step: [5], k: "06 · Fly", t: "Thrust leans forward" }
];

/* --------------------------------------------------------------------------
   Pose
   -------------------------------------------------------------------------- */

function makePose(W) {
  const { parts, rotors } = W;
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const PHASE = [0, 1.9, 3.3, 4.6];
  const HOLD = [0.42, -0.26, 0.3, -0.38];
  let flown = 0;

  return function pose(p, time, dt) {
    const expl = windowed(0.12, 0.3, 0.8, 0.9, p);
    const tiltT = windowed(0.34, 0.4, 0.5, 0.56, p);
    const levelT = windowed(0.5, 0.56, 0.66, 0.72, p);
    const outT = smooth(0.68, 0.74, p);
    const inT = smooth(0.73, 0.81, p);
    const flyT = smooth(0.84, 0.95, p);

    const e = easeOut(expl);
    parts.craft.position.y = HOVER + (1 - expl) * Math.sin(time * 1.4) * 0.08 + flyT * 0.6;
    parts.canopy.position.set(-0.4 * e, 3.0 * e, 0);
    parts.canopy.rotation.z = 0.12 * e;
    parts.brain.position.set(1.7, 0.05 + 1.5 * e, 0);
    parts.wingL.position.set(0, 0.25 * e, 3.0 * e);
    parts.wingR.position.set(0, 0.25 * e, -3.0 * e);

    // Gimbal rings and horizon around the level step.
    const gim = parts.brain.userData;
    gim.ringMat.opacity = levelT * 0.9 + expl * 0.25;
    gim.rings[0].rotation.z = time * 0.9;
    gim.rings[1].rotation.x = time * 0.7;
    gim.rings[2].rotation.y = time * 1.1;
    parts.horizon.userData.mat.opacity = levelT * 0.75;
    parts.horizon.visible = levelT > 0.001;
    parts.horizon.scale.setScalar(0.85 + 0.15 * easeOut(levelT));

    // Rotors: independent swings, then a held mixed pose, then all forward.
    rotors.forEach((r, i) => {
      const swing = tiltT * 0.6 * Math.sin(time * 1.1 + PHASE[i]);
      r.angle = swing + levelT * HOLD[i] - flyT * 0.5;
      r.pivot.rotation.z = r.angle;
      const rate = (1 - expl) * 26 + expl * 6 + flyT * 8;
      r.spin += rate * dt;
      r.prop.rotation.y = r.spin;
      r.blur.material.opacity = dt ? Math.min(0.32, (rate / 30) * 0.32) : 0;
      r.glowRing.material.color.setHex(ACCENT).multiplyScalar(0.8 + 0.8 * (tiltT + levelT + flyT));
    });

    parts.hull.userData.navs.forEach((n, i) => {
      n.material.color.setHex(Math.sin(time * 3 + i * Math.PI) > 0.4 ? ACCENT : 0x10302c);
    });

    // Bay: battery drops out and slides away, payload rises in.
    parts.craft.updateMatrixWorld();
    const bay = v.set(-0.2, -0.25, 0).applyMatrix4(parts.hull.matrixWorld);
    const drop = easeOut(smooth(0, 0.6, outT));
    const slide = easeOut(smooth(0.5, 1, outT));
    parts.battery.position.set(bay.x, bay.y + (0.6 - bay.y) * drop, bay.z - 3.4 * slide);
    parts.battery.visible = flyT < 0.98;
    parts.battery.scale.setScalar(1 - 0.999 * flyT);
    const rise = easeOut(smooth(0.45, 1, inT));
    const glide = easeOut(smooth(0, 0.55, inT));
    parts.payload.position.set(bay.x, 0.6 + (bay.y - 0.6) * rise, bay.z + 3.4 * (1 - glide));
    parts.payload.visible = inT > 0 || p > 0.7;
    parts.payload.scale.setScalar(inT > 0 ? 1 : 0.001);

    // Dashed guides.
    const g = W.guides;
    const gO = 0.7 * smooth(0.1, 0.24, p) * expl;
    g.material.opacity = gO;
    g.visible = gO > 0.01;
    if (g.visible) {
      const arr = g.geometry.attributes.position.array;
      W.guidePairs.forEach(([ga, pa, gb, pb], i) => {
        ga.updateMatrixWorld();
        gb.updateMatrixWorld();
        v.set(pa[0], pa[1], pa[2]).applyMatrix4(ga.matrixWorld);
        v2.set(pb[0], pb[1], pb[2]).applyMatrix4(gb.matrixWorld);
        arr.set([v.x, v.y, v.z, v2.x, v2.y, v2.z], i * 6);
      });
      g.geometry.attributes.position.needsUpdate = true;
      g.computeLineDistances();
    }

    // Flight: the grid streams backwards, streaks rush past.
    flown += flyT * 9 * dt;
    W.grid.position.x = -(flown % 2);
    // Streaks fade out before they reach the captions on the left.
    W.streaks.forEach((m) => {
      const d = m.userData;
      m.visible = flyT > 0.01;
      const x = 16 - ((d.seed + time * 14 * d.speed) % 26);
      m.position.set(x, d.y, d.z);
      m.material.opacity = flyT * 0.55 * smooth(-8, -3, x) * (1 - smooth(11, 15, x));
    });

    // Downwash under each rotor.
    const arr = W.wash.geometry.attributes.position.array;
    const washO = (1 - expl) * 0.5 + flyT * 0.2;
    W.wash.material.opacity = washO;
    W.wash.visible = washO > 0.02;
    if (W.wash.visible) {
      W.washSeed.forEach(([u, a, rr], i) => {
        const r = rotors[i % 4];
        r.pivot.getWorldPosition(v);
        const t = (u + time * 0.9) % 1;
        const rad = 0.4 + rr * 1.0 + t * 0.6;
        arr[i * 3] = v.x + Math.cos(a) * rad - t * 2.2 * flyT;
        arr[i * 3 + 1] = v.y - 0.3 - t * (v.y - 0.15);
        arr[i * 3 + 2] = v.z + Math.sin(a) * rad;
      });
      W.wash.geometry.attributes.position.needsUpdate = true;
    }
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
