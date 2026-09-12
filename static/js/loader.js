/* Enter screen — port of "Loading Screen 1b" from the Claude Design project.
   The counter, progress bar, scan line and portrait reveal share one 2.6 s
   curve, the status ticker steps at the same marks as the mock, and the
   screen then wipes upward onto the page. It also waits for fonts and images
   (capped at 6 s) so the page underneath is settled when it is revealed. */
(function () {
  var root = document.documentElement;
  var loader = document.getElementById("loader");
  var enter = window.__enterResolve || function () {};

  if (!loader) {
    enter();
    return;
  }

  if (!root.classList.contains("is-loading") || !window.gsap) {
    loader.remove();
    root.classList.remove("is-loading");
    enter();
    return;
  }

  var gsap = window.gsap;
  var HOLD = 2.6;
  var out = "expo.out";
  var wipe = "power4.inOut";

  if (window.CustomEase) {
    gsap.registerPlugin(window.CustomEase);
    // The two curves the mock uses for its reveal and its exit.
    window.CustomEase.create("dcOut", "0.16,1,0.3,1");
    window.CustomEase.create("dcWipe", "0.76,0,0.24,1");
    out = "dcOut";
    wipe = "dcWipe";
  }

  loader.classList.add("is-live");

  var pct = loader.querySelector(".loader-pct");
  var bar = loader.querySelector(".loader-bar i");
  var bust = loader.querySelector(".loader-bust");
  var scan = loader.querySelector(".loader-scan");
  var ticker = loader.querySelector(".loader-ticker-track");
  var steps = ticker ? ticker.children.length : 0;
  var progress = { value: 0 };

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  var pageLoaded = new Promise(function (resolve) {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve, { once: true });
  });
  var fontsLoaded = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  var ready = Promise.race([Promise.all([pageLoaded, fontsLoaded]), wait(6000)]);

  var intro = gsap.timeline({
    onComplete: function () {
      ready.then(exit);
    }
  });

  intro
    .to(
      progress,
      {
        value: 100,
        duration: HOLD,
        ease: out,
        onUpdate: function () {
          pct.textContent = Math.round(progress.value);
        }
      },
      0
    )
    .fromTo(bar, { scaleX: 0.02 }, { scaleX: 1, duration: HOLD, ease: out }, 0)
    .fromTo(
      bust,
      { clipPath: "inset(90% 0% 0% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: HOLD, ease: out },
      0
    )
    .fromTo(scan, { top: "100%" }, { top: "-14%", duration: HOLD, ease: out }, 0);

  // One line per step at 24 / 48 / 72 / 100 % of the hold, as in the mock.
  [0.24, 0.48, 0.72, 1].forEach(function (mark, i) {
    if (i + 1 < steps) {
      intro.set(ticker, { yPercent: (-100 * (i + 1)) / steps }, HOLD * mark);
    }
  });

  function exit() {
    gsap
      .timeline({
        onComplete: function () {
          loader.remove();
        }
      })
      .to(scan, { opacity: 0, duration: 0.4, ease: "none" }, 0)
      .to(bust, { y: 26, scale: 0.97, opacity: 0, duration: 0.8, ease: wipe }, 0)
      .fromTo(
        loader,
        { clipPath: "inset(0% 0% 0% 0%)" },
        { clipPath: "inset(0% 0% 100% 0%)", duration: 0.95, ease: wipe },
        0
      )
      // The page starts rising in just after the wipe begins (mock: +150 ms).
      .add(function () {
        root.classList.remove("is-loading");
        enter();
      }, 0.15);
  }
})();
