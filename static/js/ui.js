/* Case-study interactions that sit outside the GSAP layer: the wordmark's
   cursor-tracked reveal and the travelling packet in the node diagrams. */
(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
})();
