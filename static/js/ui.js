(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------------
     Cursor spotlight on frosted cards
     ---------------------------------------------------------------------- */
  var cards = document.querySelectorAll(".project-card");

  cards.forEach(function (card) {
    card.addEventListener("pointermove", function (event) {
      var box = card.getBoundingClientRect();
      card.style.setProperty("--mx", event.clientX - box.left + "px");
      card.style.setProperty("--my", event.clientY - box.top + "px");
    });
  });

  /* ----------------------------------------------------------------------
     Glowing border — rotates a masked conic gradient toward the cursor.
     Vanilla port of the Aceternity GlowingEffect component.
     ---------------------------------------------------------------------- */
  var rings = [].map.call(
    document.querySelectorAll(".glow-ring"),
    function (el) {
      return { el: el, angle: 0, from: 0, to: 0, start: 0, moving: false };
    }
  );

  if (rings.length) {
    var PROXIMITY = 70;
    var INACTIVE_ZONE = 0.06;
    var DURATION = 1200;
    var pointer = { x: -9999, y: -9999 };
    var scanQueued = false;
    var glowFrame = null;

    function easeOutExpo(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function paint(now) {
      var busy = false;

      rings.forEach(function (ring) {
        if (!ring.moving) return;
        var progress = Math.min(1, (now - ring.start) / DURATION);
        ring.angle = ring.from + (ring.to - ring.from) * easeOutExpo(progress);
        ring.el.style.setProperty("--start", String(ring.angle));
        if (progress < 1) busy = true;
        else ring.moving = false;
      });

      glowFrame = busy ? requestAnimationFrame(paint) : null;
    }

    function scan() {
      scanQueued = false;

      rings.forEach(function (ring) {
        var box = ring.el.getBoundingClientRect();
        if (!box.width || !box.height) return;

        var cx = box.left + box.width / 2;
        var cy = box.top + box.height / 2;
        var distance = Math.hypot(pointer.x - cx, pointer.y - cy);
        var deadZone = 0.5 * Math.min(box.width, box.height) * INACTIVE_ZONE;

        if (distance < deadZone) {
          ring.el.style.setProperty("--active", "0");
          return;
        }

        var active =
          pointer.x > box.left - PROXIMITY &&
          pointer.x < box.right + PROXIMITY &&
          pointer.y > box.top - PROXIMITY &&
          pointer.y < box.bottom + PROXIMITY;

        ring.el.style.setProperty("--active", active ? "1" : "0");
        if (!active) return;

        var target =
          (180 * Math.atan2(pointer.y - cy, pointer.x - cx)) / Math.PI + 90;
        // Rotate whichever way is shorter, so the sweep never spins the long way.
        var delta = ((((target - ring.angle + 180) % 360) + 360) % 360) - 180;

        if (reduceMotion) {
          ring.angle += delta;
          ring.el.style.setProperty("--start", String(ring.angle));
          return;
        }

        ring.from = ring.angle;
        ring.to = ring.angle + delta;
        ring.start = performance.now();
        ring.moving = true;
      });

      if (!reduceMotion && !glowFrame) {
        glowFrame = requestAnimationFrame(paint);
      }
    }

    function queueScan() {
      if (scanQueued) return;
      scanQueued = true;
      requestAnimationFrame(scan);
    }

    document.addEventListener(
      "pointermove",
      function (event) {
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        queueScan();
      },
      { passive: true }
    );

    window.addEventListener("scroll", queueScan, { passive: true });
  }

  /* ----------------------------------------------------------------------
     Text hover effect — cursor-tracked radial mask over outlined type.
     Vanilla port of the Aceternity/framer-motion behaviour.
     ---------------------------------------------------------------------- */
  document.querySelectorAll("[data-text-hover]").forEach(function (svg) {
    var gradient = svg.querySelector(".th-gradient");
    if (!gradient) return;

    var view = svg.viewBox.baseVal;
    var maxRadius = view.width * 0.17;

    var current = { x: view.width / 2, y: view.height / 2, r: 0 };
    var target = { x: view.width / 2, y: view.height / 2, r: 0 };
    var frame = null;
    var safety = null;

    function apply() {
      gradient.setAttribute("cx", current.x);
      gradient.setAttribute("cy", current.y);
      gradient.setAttribute("r", current.r);
    }

    function tick() {
      var ease = 0.18;
      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;
      current.r += (target.r - current.r) * ease;
      apply();

      var settled =
        Math.abs(target.x - current.x) < 0.4 &&
        Math.abs(target.y - current.y) < 0.4 &&
        Math.abs(target.r - current.r) < 0.4;

      if (settled && safety) {
        clearTimeout(safety);
        safety = null;
      }

      frame = settled ? null : requestAnimationFrame(tick);
    }

    function snap() {
      current = { x: target.x, y: target.y, r: target.r };
      apply();
    }

    function run() {
      if (reduceMotion) {
        snap();
        return;
      }
      if (!frame) frame = requestAnimationFrame(tick);
      // If frames are throttled (background/occluded tab), still honour the pointer.
      if (safety) clearTimeout(safety);
      safety = setTimeout(snap, 150);
    }

    function toLocal(event) {
      var matrix = svg.getScreenCTM();
      if (!matrix) return null;
      var point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(matrix.inverse());
    }

    function track(event) {
      var local = toLocal(event);
      if (!local) return;
      target.x = local.x;
      target.y = local.y;
      target.r = maxRadius;
      run();
    }

    svg.addEventListener("pointerenter", track);
    svg.addEventListener("pointermove", track);
    svg.addEventListener("pointerleave", function () {
      target.r = 0;
      run();
    });

    apply();
  });

  /* ----------------------------------------------------------------------
     Diagram flow — a packet travels every connector, sequenced so it walks
     the pipeline agent by agent. The motion itself is CSS; this measures the
     connectors and parks the loops while the diagram is off screen.
     ---------------------------------------------------------------------- */
  var diagrams = document.querySelectorAll(".nd-svg");

  if (diagrams.length && !reduceMotion) {
    // Each pulse slides one fixed-size dash along its path, so the packet
    // looks the same on a short hand-off and a long service call.
    document.querySelectorAll(".nd-pulse").forEach(function (path) {
      var length = path.getTotalLength();
      var dash = parseFloat(getComputedStyle(path).getPropertyValue("--dash")) || 32;
      path.style.setProperty("--len", length + "px");
      // A gap longer than the path keeps exactly one dash on the wire.
      path.style.strokeDasharray = dash + "px " + (length + dash) + "px";
    });

    diagrams.forEach(function (svg) {
      svg.classList.add("nd-live");
    });

    // Pausing is the optimisation, not the trigger — if the observer never
    // reports, the diagrams simply keep animating.
    if ("IntersectionObserver" in window) {
      var flowObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            entry.target.classList.toggle("nd-idle", !entry.isIntersecting);
          });
        },
        { rootMargin: "120px 0px", threshold: 0 }
      );

      diagrams.forEach(function (svg) {
        flowObserver.observe(svg);
      });
    }
  }

  /* ----------------------------------------------------------------------
     Reveal sections on scroll
     ---------------------------------------------------------------------- */
  var revealables = document.querySelectorAll(".reveal");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );

  revealables.forEach(function (el) {
    observer.observe(el);
  });
})();
