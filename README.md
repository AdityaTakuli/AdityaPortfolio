# AdityaPortfolio

Site URL:

**https://adityatakuli.github.io/AdityaPortfolio/**

Static site — no build step. Open `index.html`, or serve the folder.

## Structure

- `index.html` — home: enter screen, hero, statement, about, experience reel, work, skills, achievements, contact
- `projects/trialmatch.html`, `projects/goodbookies.html` — case studies
- `static/css/base.css` — design tokens, type, shell, nav, device frames
- `static/css/home.css` — enter screen, hero, statement, pixel wipes, about
- `static/css/sections.css` — experience reel, work, skills, achievements, contact
- `static/css/case.css` — case-study layout and node diagrams
- `static/js/loader.js` — enter screen timeline
- `static/js/motion.js` — smooth scroll, reveals, pinned reel, page transitions, cursor
- `static/js/ui.js` — case-study wordmark hover and diagram packets
- `static/js/theme.js` — light/dark toggle
- `static/js/vendor/` — GSAP 3.15 (ScrollTrigger, SplitText, ScrambleText, CustomEase) and Lenis 1.3
- `static/img/` — portrait, project screenshots, icons
- `static/Aditya_Pratap_Singh_Takuli_Resume.pdf` — resume download

## Notes

- Theme follows the system setting and is remembered in `localStorage`.
- The enter screen plays on a fresh visit; moving between pages uses a curtain instead.
- Everything degrades: with reduced motion, or with the scripts blocked, the pages
  stay readable and the animations are skipped.
