/* Shared pieces for the patent pages' 3D stages: geometry and texture
   helpers, a studio environment, and runStage() — the renderer, sticky-stage
   scroll progress, camera path, HUD captions and the HTML tags that follow
   points on the model.

   A page's scene module supplies build(renderer), which returns
   { scene, anchors, pose(p, time, dt) }. Scroll progress p runs 0 → 1 across
   the #model track and drives every pose; time only adds idle life. */
import * as THREE from "three";

export const NIGHT = 0x0d0c0a;
export const AMBER = 0xe0a267;
export const PAPER = 0xdcdad4;

export const MONO = '"IBM Plex Mono", ui-monospace, monospace';
export const DISPLAY = '"Archivo", "Arial Black", sans-serif';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
/* A bump that is 1 across [b, c] and ramps in/out over [a, b] and [c, d]. */
export const windowed = (a, b, c, d, x) => smooth(a, b, x) * (1 - smooth(c, d, x));

export function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------------------------------------------------------
   Geometry helpers
   -------------------------------------------------------------------------- */

export function roundedRect(w, d, r, cx = 0, cy = 0, path = new THREE.Shape()) {
  const x = cx - w / 2;
  const y = cy - d / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + d - r);
  path.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  path.lineTo(x + r, y + d);
  path.quadraticCurveTo(x, y + d, x, y + d - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

/* Extrude a shape upward (+y) to height h, centred on the origin. Shape
   coordinates (sx, sy) land at world (sx, ·, -sy). */
export function extrudeUp(shape, h, bevel = 0.05) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(0, -(b.min.y + b.max.y) / 2, 0);
  return geo;
}

export function slab(w, h, d, r, bevel) {
  return extrudeUp(roundedRect(w - bevel * 2, d - bevel * 2, Math.max(0.01, r - bevel)), h, bevel);
}

export function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function drawSprite(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* A dark room with a few soft boxes — reflections without an HDR file. */
export function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(24, 14, 24),
    new THREE.MeshBasicMaterial({ color: 0x15130f, side: THREE.BackSide })
  );
  env.add(room);
  const panel = (w, h, color, k, x, y, z) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(12, 7, 0xffffff, 2.6, 0, 6.8, 0);
  panel(5, 10, 0xfff2e2, 3.5, -11.5, 2, 3);
  panel(3, 10, 0xffa64d, 3.2, 11.5, 1, -5);
  panel(10, 3, 0xffffff, 1.1, 0, 0.5, 11.5);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}

/* Rebuild a tube along points, drawn up to fraction `draw` of its length. */
export function tube(mesh, points, radius, draw = 1) {
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);
  mesh.geometry.dispose();
  mesh.geometry = new THREE.TubeGeometry(curve, 64, radius, 8, false);
  mesh.geometry.setDrawRange(0, Math.floor((mesh.geometry.index.count * draw) / 6) * 6);
  mesh.userData.curve = curve;
}

/* --------------------------------------------------------------------------
   Stage runner
   -------------------------------------------------------------------------- */

/**
 * @param {object} o
 * @param {(renderer: THREE.WebGLRenderer) => {scene, anchors, pose}} o.build
 * @param {Array<{p, az, el, r, tx, ty}>} o.keys  camera path over progress
 * @param {number[]} o.cuts  progress values where each caption step begins
 * @param {Array<{a, step, k, t, left?, minor?}>} o.tags  labels on anchors
 */
export async function runStage({ build, keys, cuts, tags }) {
  const stage = document.getElementById("model");
  if (!stage) return;
  const host = stage.querySelector("[data-pt-canvas]");
  const tagHost = stage.querySelector("[data-pt-tags]");
  const steps = Array.from(stage.querySelectorAll(".pt-step"));
  const fillEl = stage.querySelector("[data-pt-fill]");
  const countEl = stage.querySelector("[data-pt-count]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    stage.querySelector(".pt-fallback").textContent = "This model needs WebGL, which is unavailable here.";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  // Canvas text needs the web fonts; give them a moment, then draw anyway.
  if (document.fonts && document.fonts.load) {
    await Promise.race([
      Promise.all([document.fonts.load(`500 30px ${MONO}`), document.fonts.load(`800 120px ${DISPLAY}`)]),
      new Promise((r) => setTimeout(r, 1800))
    ]).catch(() => {});
  }

  const { scene, anchors, pose } = build(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  function cameraAt(p) {
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].p) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const t = smooth(a.p, b.p, p);
    const out = {};
    for (const k of ["az", "el", "r", "tx", "ty"]) out[k] = a[k] + (b[k] - a[k]) * t;
    return out;
  }

  /* Tags ------------------------------------------------------------------ */
  const TAGS = tags.map((d) => {
    const el = document.createElement("div");
    el.className = "pt-tag";
    el.innerHTML = `<span>${d.k}</span><b>${d.t}</b>`;
    tagHost.appendChild(el);
    return Object.assign({}, d, { el, on: false });
  });

  /* Sizing ---------------------------------------------------------------- */
  let vw = 1;
  let vh = 1;
  let narrow = false;
  function resize() {
    vw = host.clientWidth || window.innerWidth;
    vh = host.clientHeight || window.innerHeight;
    narrow = vw < 761;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.fov = narrow ? 42 : 30;
    // Push the model right of the captions on wide screens, and up above
    // them on phones.
    const offX = narrow ? 0 : -vw * 0.13;
    const offY = narrow ? vh * 0.1 : vh * 0.02;
    camera.setViewOffset(vw, vh, offX, offY, vw, vh);
    camera.updateProjectionMatrix();
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host);
  else window.addEventListener("resize", resize);

  /* Input ----------------------------------------------------------------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  let visible = true;
  if (window.IntersectionObserver) {
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
      },
      { rootMargin: "120px 0px" }
    ).observe(stage);
  }

  function scrollProgress() {
    const rect = stage.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    if (span <= 0) return 0;
    return clamp(-rect.top / span);
  }

  function stepFor(p) {
    let s = 0;
    while (s < cuts.length && p >= cuts[s]) s++;
    return s;
  }

  /* Loop ------------------------------------------------------------------ */
  const v = new THREE.Vector3();
  let prog = scrollProgress();
  let last = performance.now();
  let activeStep = -1;
  let lastCount = "";
  const clock0 = last;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = reduce ? 0 : (now - clock0) / 1000;

    const target = scrollProgress();
    prog += (target - prog) * (reduce ? 1 : 1 - Math.exp(-dt * 7));
    if (Math.abs(target - prog) < 1e-4) prog = target;

    pose(prog, time, reduce ? 0 : dt);

    // Camera.
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);
    const c = cameraAt(prog);
    let r = c.r;
    // Keep roughly the desktop horizontal framing on tall screens, and pull
    // the fog back with the camera so the model never sinks into it.
    const reach = Math.tan(((camera.fov / 2) * Math.PI) / 180) * (vw / vh);
    r *= Math.pow(Math.max(1, 0.43 / reach), 0.72);
    if (scene.fog) {
      scene.fog.near = r * 1.4;
      scene.fog.far = r * 3.4;
    }
    const az = c.az + pointer.sx * 0.09 + (reduce ? 0 : Math.sin(time * 0.25) * 0.03);
    const el = clamp(c.el - pointer.sy * 0.05, 0.08, 1.3);
    camera.position.set(
      c.tx + r * Math.cos(el) * Math.sin(az),
      c.ty + r * Math.sin(el),
      r * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(c.tx, c.ty, 0);

    renderer.render(scene, camera);

    // HUD.
    const s = stepFor(prog);
    if (s !== activeStep) {
      activeStep = s;
      steps.forEach((el, i) => el.classList.toggle("is-active", i === s));
    }
    fillEl.style.setProperty("--p", prog.toFixed(4));
    const count = String(Math.round(prog * 100)).padStart(3, "0") + "%";
    if (count !== lastCount) {
      countEl.textContent = count;
      lastCount = count;
    }

    // Tags follow their anchors.
    for (const tag of TAGS) {
      const a = anchors[tag.a];
      a.getWorldPosition(v);
      const ownerVisible = a.parent.visible !== false;
      v.project(camera);
      const want =
        tag.step.includes(s) &&
        !(narrow && tag.minor) &&
        ownerVisible &&
        v.z < 1 &&
        Math.abs(v.x) < 0.98 &&
        Math.abs(v.y) < 0.92;
      if (want !== tag.on) {
        tag.on = want;
        tag.el.classList.toggle("is-on", want);
      }
      if (want) {
        const x = (v.x * 0.5 + 0.5) * vw;
        const y = (-v.y * 0.5 + 0.5) * vh;
        tag.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        // Read leftward when asked to, or when there is no room on the right
        // — but never off the left edge.
        const flip = (tag.left && x > 230) || x > Math.max(vw - 250, vw * 0.6);
        if (flip !== tag.flip) {
          tag.flip = flip;
          tag.el.classList.toggle("pt-tag--left", flip);
        }
      }
    }
  }

  stage.classList.add("pt-ready");
  requestAnimationFrame(frame);
}
