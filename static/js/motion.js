/* Site motion — smooth scroll, the page curtain, intro, scroll-driven
   reveals, pixel wipes, the pinned experience reel, stacking case studies,
   marquee, cursor, mobile menu and the local clock.
   Built on GSAP (ScrollTrigger, SplitText, ScrambleText) and Lenis. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var enterResolve = window.__enterResolve || function () {};
  var entered = window.__enter || Promise.resolve();

  /* --------------------------------------------------------------------
     Local clock — works with or without the animation libraries
     -------------------------------------------------------------------- */
  var clocks = document.querySelectorAll("[data-clock]");
  if (clocks.length && window.Intl) {
    var clockFormat = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    var tickClock = function () {
      var now = clockFormat.format(new Date());
      clocks.forEach(function (el) {
        el.textContent = now;
      });
    };
    tickClock();
    setInterval(tickClock, 15000);
  }

  document.querySelectorAll("[data-replay]").forEach(function (button) {
    button.addEventListener("click", function () {
      try {
        sessionStorage.removeItem("apst-nav");
      } catch (e) {}
      window.scrollTo(0, 0);
      window.location.reload();
    });
  });

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;

  if (!gsap || !ScrollTrigger) {
    root.classList.add("intro-ready", "no-motion");
    root.classList.remove("is-arriving", "is-loading");
    enterResolve();
    return;
  }

  var SplitText = window.SplitText;
  var plugins = [ScrollTrigger];
  if (SplitText) plugins.push(SplitText);
  if (window.ScrambleTextPlugin) plugins.push(window.ScrambleTextPlugin);
  if (window.CustomEase) plugins.push(window.CustomEase);
  gsap.registerPlugin.apply(gsap, plugins);

  var EASE = "expo.out";
  var WIPE = "power4.inOut";
  if (window.CustomEase) {
    window.CustomEase.create("siteOut", "0.16,1,0.3,1");
    window.CustomEase.create("siteWipe", "0.76,0,0.24,1");
    EASE = "siteOut";
    WIPE = "siteWipe";
  }
  gsap.defaults({ ease: EASE, duration: 1 });
  ScrollTrigger.config({ ignoreMobileResize: true });

  if (reduce) root.classList.add("rm");

  // The home page always opens on the hero so the intro is seen.
  if (root.hasAttribute("data-loader") && "scrollRestoration" in history) {
    history.scrollRestoration = "manual";
    if (!location.hash) window.scrollTo(0, 0);
  }

  var nav = document.querySelector(".nav");
  function navHeight() {
    return nav ? nav.offsetHeight : 60;
  }

  /* --------------------------------------------------------------------
     Smooth scroll
     -------------------------------------------------------------------- */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
    if (root.classList.contains("is-loading")) lenis.stop();
  }

  function scrollToTarget(target, immediate) {
    if (lenis) {
      lenis.scrollTo(target, { immediate: !!immediate, force: true, duration: 1.4 });
    } else if (target && target.scrollIntoView) {
      target.scrollIntoView({ behavior: immediate || reduce ? "auto" : "smooth" });
    }
  }

  /* --------------------------------------------------------------------
     Mobile menu
     -------------------------------------------------------------------- */
  var menu = document.getElementById("menu");
  var menuButton = document.querySelector(".nav-menu");
  var menuOpen = false;

  function openMenu() {
    if (!menu || menuOpen) return;
    menuOpen = true;
    root.classList.add("menu-open");
    menu.setAttribute("aria-hidden", "false");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "Close menu");
    if (lenis) lenis.stop();
    gsap.set(menu, { visibility: "visible" });
    gsap.to(menu, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.8, ease: WIPE, overwrite: true });
    gsap.fromTo(
      menu.querySelectorAll(".menu-links span"),
      { yPercent: 110 },
      { yPercent: 0, duration: 1, stagger: 0.06, delay: 0.25 }
    );
  }

  function closeMenu() {
    if (!menu || !menuOpen) return;
    menuOpen = false;
    root.classList.remove("menu-open");
    menu.setAttribute("aria-hidden", "true");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
    if (lenis) lenis.start();
    gsap.to(menu, {
      clipPath: "inset(0% 0% 100% 0%)",
      duration: 0.7,
      ease: WIPE,
      overwrite: true,
      onComplete: function () {
        gsap.set(menu, { visibility: "hidden" });
      }
    });
  }

  if (menuButton) {
    menuButton.addEventListener("click", function () {
      if (menuOpen) closeMenu();
      else openMenu();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  /* --------------------------------------------------------------------
     In-page anchors glide; other pages close the curtain first
     -------------------------------------------------------------------- */
  var curtain = document.querySelector(".curtain");
  var columns = curtain ? curtain.querySelectorAll("i") : [];
  var curtainLabel = curtain ? curtain.querySelector(".curtain-label") : null;

  document.addEventListener("click", function (event) {
    var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!link || link.classList.contains("skip-link")) return;
    var hash = link.getAttribute("href");
    var target = hash.length > 1 ? document.querySelector(hash) : null;
    if (!target) return;
    event.preventDefault();
    closeMenu();
    scrollToTarget(target);
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    history.replaceState(null, "", hash);
  });

  function pageUrl(link) {
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return null;
    var url;
    try {
      url = new URL(link.href, location.href);
    } catch (e) {
      return null;
    }
    if (url.protocol !== location.protocol || url.host !== location.host) return null;
    if (url.pathname === location.pathname) return null;
    if (/\.(pdf|png|jpe?g|webp|zip)$/i.test(url.pathname)) return null;
    return url;
  }

  function leave(href, title) {
    try {
      sessionStorage.setItem("apst-nav", "1");
    } catch (e) {}
    if (curtainLabel) curtainLabel.textContent = (title || "").replace(/[→↗←↓]/g, "").trim();
    curtain.classList.add("is-active");
    gsap
      .timeline({
        onComplete: function () {
          window.location.href = href;
        }
      })
      .fromTo(
        columns,
        { scaleY: 0, transformOrigin: "50% 100%" },
        { scaleY: 1, duration: 0.7, ease: WIPE, stagger: { each: 0.04, from: "edges" } },
        0
      )
      .fromTo(curtainLabel, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0.35);
  }

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest ? event.target.closest("a[href]") : null;
    var url = pageUrl(link);
    if (!url || !columns.length || reduce) return;
    event.preventDefault();
    closeMenu();
    leave(url.href, link.getAttribute("data-title") || link.textContent);
  });

  // Coming back through the browser cache must not land on a shut curtain.
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted || !columns.length) return;
    gsap.set(columns, { scaleY: 0 });
    if (curtainLabel) gsap.set(curtainLabel, { autoAlpha: 0 });
    curtain.classList.remove("is-active");
  });

  function openCurtain() {
    var arriving = root.classList.contains("is-arriving");
    if (!arriving || !columns.length) {
      root.classList.remove("is-arriving");
      return Promise.resolve();
    }
    // Hold it shut inline, then drop the class so the CSS failsafe is gone.
    gsap.set(columns, { scaleY: 1 });
    root.classList.remove("is-arriving");
    return new Promise(function (resolve) {
      gsap.to(columns, {
        scaleY: 0,
        transformOrigin: "50% 0%",
        duration: 0.85,
        ease: WIPE,
        delay: 0.05,
        stagger: { each: 0.045, from: "center" },
        onStart: resolve
      });
    });
  }

  /* --------------------------------------------------------------------
     Intro — hero words, portrait window, then the chrome
     -------------------------------------------------------------------- */
  var intro = gsap.timeline({ paused: true });

  function setupIntro() {
    if (reduce) return;
    var navItems = gsap.utils.toArray(".nav [data-intro]");
    var pageItems = gsap.utils.toArray("main [data-intro]");
    var words = gsap.utils.toArray("[data-hero-word]");
    var portrait = document.querySelector("[data-hero-portrait]");

    gsap.set(navItems, { autoAlpha: 0, y: -14 });
    gsap.set(pageItems, { autoAlpha: 0, y: 28 });

    words.forEach(function (word, i) {
      if (!SplitText) return;
      var split = SplitText.create(word, { type: "chars", mask: "chars" });
      gsap.set(split.chars, { yPercent: 118 });
      intro.to(split.chars, { yPercent: 0, duration: 1.3, stagger: 0.045 }, 0.05 + i * 0.14);
    });

    if (portrait) {
      var img = portrait.querySelector("img");
      gsap.set(portrait, { clipPath: "inset(100% 0% 0% 0%)" });
      gsap.set(img, { scale: 1.3 });
      intro
        .to(portrait, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: WIPE }, 0.1)
        .to(img, { scale: 1, duration: 1.8 }, 0.1);
    }

    intro
      .to(navItems, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.25)
      .to(pageItems, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1 }, 0.35);
  }

  /* --------------------------------------------------------------------
     Scroll-driven pieces
     -------------------------------------------------------------------- */
  function setCell() {
    var width = root.clientWidth;
    var cols = window.matchMedia("(max-width: 900px)").matches ? 8 : 16;
    root.style.setProperty("--cell", width / cols + "px");
  }

  function setupTones() {
    document.querySelectorAll("[data-tone]").forEach(function (section) {
      var tone = section.getAttribute("data-tone");
      if (tone === "paper") return;
      ScrollTrigger.create({
        trigger: section,
        start: function () {
          return "top " + navHeight() / 2;
        },
        end: function () {
          return "bottom " + navHeight() / 2;
        },
        toggleClass: { targets: root, className: "nav-" + tone }
      });
    });
  }

  function setupSplits() {
    if (!SplitText || reduce) return;
    document.querySelectorAll("[data-split], .section-head h2").forEach(function (el) {
      SplitText.create(el, {
        type: "lines",
        mask: "lines",
        linesClass: "split-line",
        autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.lines, {
            yPercent: 115,
            duration: 1.25,
            stagger: 0.09,
            scrollTrigger: { trigger: el, start: "top 88%", once: true }
          });
        }
      });
    });
  }

  function setupRolls() {
    document.querySelectorAll(".roll-line").forEach(function (line) {
      var html = line.innerHTML.trim();
      line.innerHTML =
        '<span class="roll"><span class="roll-track"><span>' +
        html +
        '</span><span aria-hidden="true">' +
        html +
        "</span></span></span>";
    });
    if (reduce) return;
    document.querySelectorAll(".statement-col, .contact-title").forEach(function (group) {
      gsap.fromTo(
        group.querySelectorAll(".roll-track"),
        { yPercent: 50 },
        {
          yPercent: -50,
          ease: "none",
          stagger: 0.14,
          scrollTrigger: { trigger: group, start: "top 92%", end: "center 52%", scrub: 0.8 }
        }
      );
    });
  }

  function setupReveals() {
    var items = gsap.utils.toArray(
      "[data-reveal], .reveal, .case-page .bold-card, .case-page .about-text, .case-page .diagram"
    );
    if (!items.length || reduce) return;
    gsap.set(items, { autoAlpha: 0, y: 44 });
    ScrollTrigger.batch(items, {
      start: "top 90%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.08, overwrite: true });
      }
    });
  }

  function setupScramble() {
    if (!window.ScrambleTextPlugin || reduce) return;
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    document.querySelectorAll(".sec-head .label, [data-scramble]").forEach(function (el) {
      var text = el.textContent;
      ScrollTrigger.create({
        trigger: el,
        start: "top 92%",
        once: true,
        onEnter: function () {
          gsap.to(el, { duration: 1.1, scrambleText: { text: text, chars: chars, speed: 0.5 } });
        }
      });
    });
    if (!finePointer) return;
    document.querySelectorAll(".nav-links a, .nav-name").forEach(function (el) {
      var text = el.textContent;
      el.addEventListener("mouseenter", function () {
        gsap.to(el, { duration: 0.6, overwrite: true, scrambleText: { text: text, chars: chars, speed: 0.7 } });
      });
    });
  }

  function setupWipes() {
    document.querySelectorAll(".pixel-wipe").forEach(function (band) {
      var blocks = Array.prototype.filter.call(band.children, function (el) {
        return getComputedStyle(el).display !== "none";
      });
      if (reduce) {
        gsap.set(band.children, { scaleY: 1 });
        return;
      }
      gsap.fromTo(
        blocks,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "steps(4)",
          stagger: { each: 0.05, from: "random" },
          scrollTrigger: { trigger: band, start: "top bottom", end: "bottom 45%", scrub: true }
        }
      );
    });
  }

  function setupHeroScroll() {
    var hero = document.querySelector(".hero");
    if (!hero || reduce) return;
    var timeline = gsap.timeline({
      scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true }
    });
    timeline
      .to(".hero-word--a", { xPercent: -10, ease: "none" }, 0)
      .to(".hero-word--b", { xPercent: 10, ease: "none" }, 0)
      .to("[data-hero-portrait]", { yPercent: 16, scale: 0.9, ease: "none" }, 0);
  }

  function setupCube() {
    var cube = document.querySelector("[data-cube]");
    if (!cube || reduce) return;
    var stage = cube.closest("section");
    gsap.fromTo(
      cube,
      { rotateX: -24, rotateY: 38 },
      {
        rotateX: 156,
        rotateY: 398,
        ease: "none",
        scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: 1 }
      }
    );
    gsap.to(cube.querySelector(".cube-core"), {
      rotateY: -540,
      rotateZ: 90,
      ease: "none",
      scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: 1.5 }
    });
  }

  function setupDuotone() {
    document.querySelectorAll("[data-duo]").forEach(function (frame) {
      var mono = frame.querySelector(".mono");
      if (reduce) {
        gsap.set(mono, { opacity: 1 });
        return;
      }
      gsap
        .timeline({ scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true } })
        .to(mono, { opacity: 1, ease: "none", duration: 0.5 }, 0.15)
        .fromTo(frame.querySelectorAll("img"), { yPercent: 0 }, { yPercent: -9, ease: "none", duration: 1 }, 0);
    });
  }

  function setupFrames() {
    if (reduce) return;
    gsap.utils.toArray(".frame-view img").forEach(function (img) {
      gsap.fromTo(
        img,
        { scale: 1.12 },
        {
          scale: 1,
          duration: 1.8,
          scrollTrigger: { trigger: img.closest(".frame") || img, start: "top 92%", once: true }
        }
      );
    });
  }

  function setupCounters() {
    document.querySelectorAll("[data-count]").forEach(function (el) {
      var end = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-suffix") || "";
      if (reduce || isNaN(end)) return;
      var state = { value: 0 };
      el.textContent = "0" + suffix;
      gsap.to(state, {
        value: end,
        duration: 1.8,
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
        onUpdate: function () {
          el.textContent = Math.round(state.value) + suffix;
        }
      });
    });
  }

  function setupMarquee() {
    document.querySelectorAll(".marquee").forEach(function (marquee) {
      var track = marquee.querySelector(".marquee-track");
      if (!track || reduce) return;
      var setX = gsap.quickSetter(track, "xPercent");
      var wrap = gsap.utils.wrap(-50, 0);
      var x = 0;
      var direction = 1;
      var boost = 0;
      var running = false;
      function step(time, delta) {
        x = wrap(x - direction * (0.0013 + boost) * delta);
        boost *= 0.94;
        setX(x);
      }
      ScrollTrigger.create({
        trigger: marquee,
        start: "top bottom",
        end: "bottom top",
        onToggle: function (self) {
          if (self.isActive && !running) gsap.ticker.add(step);
          if (!self.isActive && running) gsap.ticker.remove(step);
          running = self.isActive;
        },
        onUpdate: function (self) {
          direction = self.direction;
          boost = Math.min(Math.abs(self.getVelocity()) / 220000, 0.014);
        }
      });
    });
  }

  function setupCursor() {
    var dot = document.querySelector(".cursor");
    if (!dot || !finePointer || reduce) return;
    var xTo = gsap.quickTo(dot, "x", { duration: 0.35, ease: "power3" });
    var yTo = gsap.quickTo(dot, "y", { duration: 0.35, ease: "power3" });
    window.addEventListener(
      "pointermove",
      function (event) {
        xTo(event.clientX);
        yTo(event.clientY);
        root.classList.add("has-cursor");
      },
      { passive: true }
    );
    document.addEventListener("pointerover", function (event) {
      var hit = event.target.closest && event.target.closest("a, button, [data-cursor]");
      dot.classList.toggle("is-hover", !!hit);
    });
    document.documentElement.addEventListener("pointerleave", function () {
      root.classList.remove("has-cursor");
    });
  }

  function setupMagnetic() {
    if (!finePointer || reduce) return;
    document.querySelectorAll("[data-magnetic]").forEach(function (el) {
      var xTo = gsap.quickTo(el, "x", { duration: 0.8, ease: "elastic.out(1, 0.45)" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.8, ease: "elastic.out(1, 0.45)" });
      el.addEventListener("pointermove", function (event) {
        var box = el.getBoundingClientRect();
        xTo((event.clientX - (box.left + box.width / 2)) * 0.18);
        yTo((event.clientY - (box.top + box.height / 2)) * 0.35);
      });
      el.addEventListener("pointerleave", function () {
        xTo(0);
        yTo(0);
      });
    });
  }

  function setupResponsive() {
    var mm = gsap.matchMedia();

    // Experience: vertical scroll drives a horizontal reel on wide screens.
    mm.add("(min-width: 901px) and (prefers-reduced-motion: no-preference)", function () {
      var reel = document.querySelector(".reel");
      if (!reel) return;
      var pin = reel.querySelector(".reel-pin");
      var viewport = reel.querySelector(".reel-viewport");
      var track = reel.querySelector(".reel-track");
      var jobs = gsap.utils.toArray(".job", track);
      var rollers = reel.querySelectorAll(".reel-names-track, .reel-count-track");
      var current = -1;

      function distance() {
        return Math.max(0, track.scrollWidth - viewport.clientWidth);
      }

      function setActive(index) {
        if (index === current) return;
        current = index;
        gsap.to(rollers, { yPercent: (-100 * index) / jobs.length, duration: 0.8, overwrite: true });
        jobs.forEach(function (job, k) {
          gsap.to(job, { y: k === index ? 0 : 22, duration: 0.8, overwrite: "auto" });
        });
      }

      setActive(0);
      gsap.to(track, {
        x: function () {
          return -distance();
        },
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: function () {
            return "+=" + distance();
          },
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: function (self) {
            setActive(Math.round(self.progress * (jobs.length - 1)));
          }
        }
      });

      return function () {
        gsap.set(jobs, { clearProps: "transform" });
        gsap.set(rollers, { clearProps: "transform" });
      };
    });

    // Case studies stack: the card underneath settles back as the next lands.
    mm.add("(min-width: 961px) and (prefers-reduced-motion: no-preference)", function () {
      var cards = gsap.utils.toArray("[data-stack]");
      cards.forEach(function (card, i) {
        var next = cards[i + 1];
        if (!next) return;
        gsap.to(card, {
          scale: 0.94,
          "--dim": 0.55,
          ease: "none",
          scrollTrigger: {
            trigger: next,
            start: "top bottom",
            end: function () {
              return "top " + (navHeight() + 16) + "px";
            },
            scrub: true
          }
        });
      });
    });
  }

  /* --------------------------------------------------------------------
     Boot
     -------------------------------------------------------------------- */
  setCell();
  window.addEventListener("resize", setCell);

  var fontsReady = Promise.race([
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    new Promise(function (resolve) {
      setTimeout(resolve, 1500);
    })
  ]);

  fontsReady
    .then(function () {
      setupIntro();
      setupRolls();
      setupSplits();
      setupReveals();
      setupScramble();
      setupWipes();
      setupHeroScroll();
      setupCube();
      setupDuotone();
      setupFrames();
      setupCounters();
      setupMarquee();
      setupResponsive();
      setupTones();
      setupCursor();
      setupMagnetic();
      root.classList.add("intro-ready");

      // The reel's pin adds scroll distance, so every trigger below it has to
      // be measured after it: refresh in page order, not creation order.
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      if (location.hash) {
        var target = document.querySelector(location.hash);
        if (target) scrollToTarget(target, true);
      }

      // The enter screen resolves this itself when it lifts.
      if (!root.classList.contains("is-loading")) openCurtain().then(enterResolve);
      return entered;
    })
    .then(function () {
      if (lenis) lenis.start();
      intro.play(0);
    });

  window.addEventListener("load", function () {
    ScrollTrigger.refresh();
  });
})();
