# Broadband equity landscape

A standalone TypeScript and Three.js spatial explorer. Compare significant
low-low broadband clusters with underserved counts in a synthetic dataset.
The bundled data preserves an audited upstream run with permission from its owner.

Project site: https://jesco-tan.github.io/broadband-equity-landscape/

Source: https://github.com/jesco-tan/broadband-equity-landscape

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

`build` and `preview` scripts are provided. Only run `bun run build` when
explicitly authorized. Vite uses relative base paths, and the dataset URL resolves
through `import.meta.env.BASE_URL`, supporting the GitHub Pages project subpath.

## Publishing

The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` installs the
locked dependencies, checks TypeScript, runs tests, builds, and deploys `dist`
to GitHub Pages on pushes to `main`. It also supports manual dispatch. Configure
the repository's Pages source as GitHub Actions. The site requires no backend,
environment variables, custom domain, or API keys.

## Explore

The map opens in 3D landscape. Flat view remains available in the view toggle.
Chapter two uses a flat view to show cold-spot locations; chapter three adds
height in 3D. Restart story restores the opening 3D view.

Open Map settings to change map colors and highlights. It starts collapsed in
the story and opens automatically in free exploration. Target choices sit beside
the coverage calculation.
Arrow keys move between choices. "How to read this map" explains unfamiliar terms.
Detailed chart values expand on demand.

Use Next chapter to follow four steps: adoption, significant LL cold spots,
underserved count heights, and counts outside the target. Manual layer, targeting,
emphasis or camera changes enter free exploration, with a live summary of the
current settings. Return to chapter restores that chapter's settings. The final
chapter offers Explore the data. Restart story clears inspection and search. Inspection and search
do not change targeting, totals or story mode.

The map supports pointer inspection, orbit and zoom. Selecting a cell adds a
thin amber outline and opens its details beside the map while keeping narration
visible. Next, Back and Return to chapter close map details while keeping the
selected cell highlighted. Details lead with adoption, underserved count and
target membership; statistical details expand on demand. Selecting an area
from the tract list shows details beside that list, or directly below it on mobile.
Close clears inspection. On mobile, narration precedes the map, navigation
follows it, and selection brings the relevant details into view. Color and
highlight controls sit beside the map; target controls sit beside coverage.
Coverage labels and the visible definition explain the underserved population proxy. A searchable HTML tract list
provides keyboard inspection by selecting a tract ID. Progress indicators show
the current chapter; Back and Next navigate the story. Restart appears after
leaving the opening chapter or entering exploration. The four layers have fixed
dataset domains. Flat view and Reset camera retain analytical state. Reset camera
appears only when the camera has moved away from its default position. Heights
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

## Analytical limits and source bytes

The pinned analytical weights graph has 45 disconnected components and mean degree 4.25. The explorer preserves the saved labels; it does not validate upstream grid topology or rerun LISA. Local tests use uncorrected pseudo p-values. No causal or eligibility claim follows from these labels.

The recorded source hash is over CRLF bytes. The public raw source is LF-normalized; reconstructing CRLF reproduces the recorded SHA-256. Record content equivalence separately from byte identity. Internal tract and household field names are schema compatibility identifiers for synthetic cells and generated population proxies.
