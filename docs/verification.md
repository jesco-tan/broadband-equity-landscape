# Verification

Verified on 2026-11-02 in this standalone application folder.

## Publication preparation

The standalone public repository is `jesco-tan/broadband-equity-landscape`.
GitHub Pages is configured to deploy through GitHub Actions at
https://jesco-tan.github.io/broadband-equity-landscape/.
TypeScript, all 25 unit tests, and whitespace checks pass after the control
simplification. The browser results below predate that simplification; no fresh
browser verification has been performed for it. The owner explicitly authorized
the production build and deployment. `bun run build` passed with Vite 7.3.7;
the output includes relative asset paths and all 400 tract records. Vite reports
one bundle-size advisory for the 628.20 kB JavaScript bundle (164.20 kB gzip).
GitHub Actions performs the same type check, tests, and build before deploying.
Deployment status is recorded by the repository's Actions runs and github-pages
environment.

## Data and non-build checks

- `bun install`: passed with a project-local `bun.lock`.
- `bun run check`: TypeScript passed with strict checking and no emit.
- `bun run test`: 25 tests passed, zero failures, 42 assertions.
- The adapter was run twice; all exported records and metadata match exactly
  after excluding only the generation timestamp.
- `bun run dev`: starts independently at http://127.0.0.1:5174.
- A second `bun run dev` exits with "Port 5174 is already in use", confirming
  strict-port behavior.
- `git check-ignore PLAN.md plan.md`: both ignored. The published branch's
  history excludes the planning document. Only `main` is intended for publication;
  internal checkpoint refs are excluded.

Tests cover independently calculated aggregation results, complete and empty
target sets, zero denominators, fractional estimates, county reconciliation,
the real fixture's upstream totals, invalid contract inputs, optional nulls,
multipolygon input, polygon-hole triangulation and story state transitions.

## Browser checks

`scripts/verify-browser.mjs` records the final browser run in
`docs/browser-verification.json`. It operates against the dev server without
running a build. All 28 browser checks passed with zero uncaught page errors.
The script covers:

- Initial 3D/adoption/story state, with 3D first in the toggle and successful
  WebGL rendering.
- Visible radio-button choices with native arrow-key navigation, and an
  expandable plain-language reading guide.
- Pointer inspection opening adjacent selected-area details with a thin amber
  outline while keeping narration visible, and mobile inspection scrolling
  details into view. Story navigation closes map details without clearing selection;
  list inspection places the same details panel beside the list while leaving
  narration visible. Both flows have explicit browser assertions.
- Pointer inspection preserving story mode, keyboard tract inspection, search
  preserving coverage, and inspection persisting through story/view changes.
- LL counts of 119,165 covered and 401,987 excluded, displaying 22.9% coverage.
- First-screen navigation, legend and view controls at 1280 by 800, with no
  opening coverage number in the story. Map and target controls sit beside their context.
- Flat cold-spot chapter followed by 3D height, an active final exploration action,
  a live settings summary and chapter-specific return restoring settings.
- Manual exploration, story resumption, all four chapters and restart behavior.
- Mobile narration before the map and navigation directly after it.
- Flat map footprint picking and outside emphasis preserving targeting.
- Idle rendering stopping, 360 CSS pixel layout without horizontal overflow,
  and reduced motion avoiding an animated camera transition.
- Deliberately forced table mode and an actual `WEBGL_lose_context` failure,
  retaining controls, metrics, charts and inspection.
- Disposal with zero tracked geometries and the GPU context lost. Three.js
  can retain an informational texture counter after renderer disposal; the
  current run retained one internal texture counter. The app creates no texture assets.
- HTTP 404 and malformed-schema dataset errors with useful retry guidance.
- No uncaught page exceptions.

Screenshots were inspected at desktop and 360px widths. The flat map now uses
unlit colors to avoid lighting washout, a darker sequential scale, and stronger
cell edges. Repeated explanatory subtext was removed; terminology is available
in the reading guide, and chart tables open under "View values". They are local review
artifacts, excluded from Git. Native labeled controls and HTML chart tables
provide keyboard and data alternatives to the canvas. A screen reader audit
and physical touch-device testing were not performed.

## Rendering measurements

The machine-readable run records browser version, CPU, RAM, viewport, device
pixel ratio, first-map time, geometry counts, animation-frame interval p95 and
CPU render-call duration p95 during a ten-second automated camera gesture.

Geometry consists of 400 polygon parts: 16,000 surface vertices, 9,600 outline
vertices and 5,600 allocated triangles including both extrusions and footprints.
Only the needed footprint or extrusion is displayed for each tract. Maximum
pixel ratio is capped at 2; the recorded desktop test uses 1. Materials are
shared by color and emphasis opacity. Rendering occurs on demand, with no
continuous idle animation loop.

The animation-frame interval sample describes local browser scheduling, not
GPU rendering duration or a production benchmark. The CPU render-call sample
likewise is not GPU completion time. See the JSON for actual values and local
target evaluation. The first-map measurement includes document navigation;
`mapInitializationMs` isolates scene creation and its first rendered frame.

Final local run: Chromium 156.0.8078.76 on Windows, Ryzen 7 7800X3D,
16 logical CPUs and 31 GiB reported RAM. Browser viewport was 1440 by 1050;
map viewport was 1002 by 320 at pixel ratio 1. Warm navigation to first map
was 183.6 ms, with 113.9 ms spent initializing the map. Camera-interaction
animation-frame interval p95 was 13.5 ms across 744 samples;
CPU render-call p95 was 2.8 ms. The warm first-map target of two seconds
and local interval target of 33 ms were met.

A separate fresh-browser navigation took 21.213 seconds. Navigation timing shows
20.949 seconds elapsed before the document request began; the document response
then took about 1.6 ms. Subsequent loads were fast. This initial browser/network
startup delay occurs before application code runs and remains an environment
limitation; its underlying browser/system cause was not established. Both
initial-navigation timing and warm results are retained rather than excluding
the slow observation from the record. These are local results, not production
performance claims.

## Not directly verified

Maintenance coexistence was not directly exercised because it was not already
running. Its files and configuration were not modified. Port 5174 is independent.
Production build and deployed relative-subpath behavior remain pending, as
builds were not requested. Vite base and fixture paths are configured relatively.
No real ACS data, measured household counts or causal policy claims are included.
