# Broadband equity landscape

A standalone TypeScript and Three.js spatial explorer. Compare significant
low-low broadband clusters with underserved counts in a synthetic dataset.
The bundled data preserves an audited upstream run with permission from its owner.

The upstream analysis uses synthetic population as a household proxy. The app
labels this limitation throughout. The grid is not authentic California tract
geography, and coverage is not service delivery, grant eligibility or causation.

## Run locally

```powershell
bun install
bun run dev
```

Open http://127.0.0.1:5174. The strict port setting refuses another instance on
5174 instead of silently moving. The app has no dependency on a parent workspace
or Maintenance. Normal development requires no Python, API keys or data network
requests beyond fetching the committed local JSON fixture.

```powershell
bun run check
bun run test
```

`build` and `preview` scripts are provided. A production build has not been run.
Only run `bun run build` when explicitly requested. Vite uses relative base paths,
and the dataset URL resolves through `import.meta.env.BASE_URL`. Production and
deployed subpath verification remain pending. Nothing has been published.

## Explore

The map opens in 3D landscape. Flat view remains available in the view toggle.
Story navigation and Restart story use the 3D view.

Use the visible choice buttons to change map colors, included areas and highlights.
Arrow keys move between choices. "How to read this map" explains unfamiliar terms.
Detailed chart values expand on demand.

Use Next chapter to follow four steps: adoption, significant LL cold spots,
underserved count heights, and counts outside the target. Manual layer, targeting,
emphasis or camera changes enter free exploration. Resume story reapplies the
current step. Restart story clears inspection and search. Inspection and search
do not change targeting, totals or story mode.

The map supports pointer inspection, orbit and zoom. Selecting a cell adds a
thin amber outline and opens its details beside the map. Next, Back and Resume
restore the story while keeping the selected cell highlighted. Selecting an area
from the tract list shows details beside that list, or directly below it on mobile.
Close clears inspection. On mobile, selection brings the relevant details into view. Map colors and targeting calculations remain intact. A searchable HTML tract list
provides keyboard inspection with ordinary buttons. The four layers have fixed
dataset domains. Flat view and Reset camera retain analytical state. Heights
range linearly from zero to 25% of the longest map extent. Reduced motion disables
animated camera transitions.

Open http://127.0.0.1:5174/?renderer=table to force the accessible fallback.
Graphics failures also retain targeting controls, all metrics, both charts and
the tract list. No count depends on camera, search or visual emphasis.

## Regenerate data

Use a temporary checkout outside this application. The adapter requires Python
3.10+ and Git, without third-party Python packages. Example PowerShell commands:

```powershell
$upstreamPath = Join-Path $env:TEMP 'broadband-source-audit'
git clone https://github.com/jesco-tan/geospatial-urban-analytics.git $upstreamPath
git -C $upstreamPath checkout 35056d8c204c1f631be3ff2f5ac00a2495113a52
python scripts/export_dataset.py --source $upstreamPath --output public/data/broadband-synthetic.v1.json
```

If the checkout already exists, skip cloning. The adapter rejects a different
commit or edited inputs and reconciles the complete embedded GeoJSON record
export with the source summary. It does not rerun or recreate LISA statistics.

See [source audit](docs/source-audit.md), [data reconciliation](docs/data-validation.md)
and [verification](docs/verification.md) for exact definitions and limitations.

## Non-build browser checks

With the dev server running and Playwright Chromium installed:

```powershell
node scripts/verify-browser.mjs
```

Set `BROWSER_PATH` to an existing Chromium executable if needed. The script checks
story and keyboard operation, mobile width, reduced motion, actual context loss,
forced table mode, data failures, idle rendering and a ten-second camera gesture.
It writes machine-readable results to `docs/browser-verification.json` and local
screenshots to `docs/desktop.png` and `docs/mobile.png`. Screenshots are ignored.
Read-only runtime measurements are available from `window.broadbandDiagnostics()`.

## Structure

- `src/data.ts`: contract and load validation.
- `src/analytics.ts`: pure coverage and county summaries.
- `src/state.ts`: story/exploration and interaction rules.
- `src/geometry.ts`, `src/renderer.ts`, `src/colors.ts`: geometry, scene and encoding.
- `src/main.ts`, `src/controls.ts`, `src/style.css`: semantic HTML interface and responsive layout.
- `scripts/export_dataset.py`: pinned source adapter.
- `tests/`: analytical, validation, geometry and state tests.

Git is initialized on `main`. Case variants of `PLAN.md` are ignored. No commits
are needed to run the application. Do not force-add the planning document.
