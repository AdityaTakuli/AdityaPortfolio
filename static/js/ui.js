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

      frame = settled ? null : requestAnimationFrame(tick);
    }

    function run() {
      if (reduceMotion) {
        current = { x: target.x, y: target.y, r: target.r };
        apply();
        return;
      }
      if (!frame) frame = requestAnimationFrame(tick);
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
