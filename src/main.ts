import "./style.css";
import { validateDataset, type Dataset, type Tract } from "./data";
import { byCounty, coverage } from "./analytics";
import { initialState, reduce, type Action, type Layer } from "./state";
import {
  clusters,
  clusterNames,
  createColors,
  layerNames,
  missing,
  scales,
} from "./colors";
import { explorerControls, readingGuide } from "./controls";
import { createMap } from "./renderer";

const app = document.querySelector<HTMLDivElement>("#app")!;
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const stories = [
  {
    title: "A place can look connected.",
    body: "Each cell is an example area. Darker teal means more households have a broadband subscription.",
  },
  {
    title: "Cold spots reveal a pattern.",
    body: "Cold spots are areas with low internet use near other low-use areas. Select them to see who falls inside the target.",
  },
  {
    title: "Places have different weights.",
    body: "Taller cells have larger underserved counts. Small areas can hold a lot of need.",
  },
  {
    title: "Look beyond the cold spots.",
    body: "Underserved counts also sit outside cold spots. Highlight them to see what cold-spot targeting leaves out.",
  },
];

async function start() {
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}data/broadband-synthetic.v1.json`,
    );
    if (!response.ok)
      throw new Error(`Dataset request failed (${response.status}).`);
    const data = validateDataset(await response.json());
    mount(data);
  } catch (error) {
    app.innerHTML = `<main class="loading"><p class="eyebrow">Broadband equity / synthetic example</p><h1>The landscape could not load.</h1><p role="alert">${escape(error instanceof Error ? error.message : error)}</p><p>Check your connection or regenerate the bundled data using the command in README.md. A malformed dataset is rejected in full so incomplete counts are never shown.</p><button id="retry">Try again</button></main>`;
    el("retry").onclick = () => location.reload();
  }
}

function mount(data: Dataset) {
  let state = initialState();
  let detailPresentation: "story" | "map" | "list" = "story";
  let map: ReturnType<typeof createMap> | undefined;
  const colors = createColors(data);
  const fmt = (
    n: number | null,
    digits = data.metadata.displayPrecision.count,
  ) =>
    n === null
      ? "Not available"
      : n.toLocaleString("en-US", {
          maximumFractionDigits: digits,
          minimumFractionDigits: digits,
        });
  const pct = (n: number | null) =>
    n === null
      ? "Not applicable"
      : `${fmt(n * 100, data.metadata.displayPrecision.rate)}%`;
  app.innerHTML = `
    <header class="masthead"><a href="./" class="wordmark"><span class="mark" aria-hidden="true">▥</span> Fieldnotes <span class="wordmark-sub">Spatial equity lab</span></a><span class="dataset-badge">Synthetic data <span aria-hidden="true">/</span> ${data.tracts.length} example tracts</span><a class="source-link" href="${escape(data.metadata.sourceRepository)}/tree/${data.metadata.sourceCommit}" target="_blank" rel="noreferrer">View source</a></header>
    <main>
      <section class="intro"><div><p class="eyebrow">Broadband equity landscape</p><h1>Cold spots are places.<br>Need lives in households.</h1></div><p class="intro-note">Does targeting areas with low internet use reach everyone who needs help?</p></section>
      <div class="method-note"><p><strong>Synthetic example.</strong> Counts use population as a household stand-in.</p>${readingGuide()}</div>
      <div class="workspace">
        <section class="landscape" aria-label="Interactive landscape">
          <div class="map-topline"><span id="map-caption">Broadband adoption</span></div>
          <div id="map" class="map"><p id="map-status" role="status">Preparing the map...</p></div>
          <div class="map-controls"><div class="segmented" aria-label="Map view"><button id="tilted" aria-pressed="true">3D landscape</button><button id="flat" aria-pressed="false">Flat view</button></div><button id="reset" class="quiet">Reset camera</button></div>
          <div class="legend-wrap"><div id="legend" aria-label="Color legend"></div><p id="height-legend" hidden></p></div>
          <p class="map-hint" id="map-hint">Select a cell to inspect. Drag to rotate; scroll to zoom.</p>
        </section>
        <aside class="story-panel" aria-label="Story and selected area"><div class="story-top"><span id="mode-label">Guided story</span><span id="step-label">1 / 4</span></div><div id="story-content"><div class="progress" aria-label="Story steps">${stories.map((s, i) => `<button data-step="${i}" aria-label="Step ${i + 1}: ${escape(s.title)}"></button>`).join("")}</div><h2 id="story-title"></h2><p id="story-body"></p><div id="story-insight" class="story-insight" aria-live="polite"></div></div><div id="map-details-slot"><section id="selected-panel" class="selected-panel" aria-labelledby="selected-heading" hidden><div class="detail-top"><h3 id="selected-heading" tabindex="-1"><span class="selection-dot" aria-hidden="true"></span>Selected area</h3><button id="clear" class="text-button" aria-label="Close area details">Close</button></div><div id="detail" aria-live="polite" aria-atomic="true"></div></section></div><div class="story-nav"><button id="back" class="quiet">Back</button><button id="next">Next chapter <span aria-hidden="true">↗</span></button></div><div class="story-secondary"><button id="explore" class="text-button">Explore freely</button><button id="resume" class="text-button" hidden>Resume story</button><button id="restart" class="text-button">Restart story</button></div></aside>
      </div>
      <section class="analysis" aria-labelledby="coverage-heading"><div class="section-heading"><h2 id="coverage-heading">Who is inside the target?</h2></div>
        <div id="controls" class="controls" tabindex="-1">${explorerControls()}</div>
        <div class="metrics" aria-live="polite"><div><span id="coverage-value" class="metric-number"></span><span>Share inside target</span></div><div><span id="covered-value" class="metric-number"></span><span>Inside target</span></div><div><span id="excluded-value" class="metric-number"></span><span>Outside target</span></div></div>
        <div class="charts"><figure><figcaption><h3>Inside versus outside</h3></figcaption><div id="total-chart"></div><div class="chart-key"><span><i class="inside-swatch"></i>Inside target</span><span><i class="outside-swatch"></i>Outside target</span></div><details class="chart-data"><summary>View values</summary><table class="chart-table"><caption class="sr-only">Overall coverage values</caption><thead><tr><th scope="col">Location</th><th scope="col">Count proxy</th><th scope="col">Share</th></tr></thead><tbody id="total-table"></tbody></table></details></figure><figure><figcaption><h3>By area type</h3><p>Same count scale across groups.</p></figcaption><div id="county-chart"></div><details class="chart-data"><summary>View values</summary><table class="chart-table"><caption class="sr-only">Coverage by synthetic county type</caption><thead><tr><th scope="col">Type</th><th scope="col">Inside</th><th scope="col">Outside</th><th scope="col">Coverage</th></tr></thead><tbody id="county-table"></tbody></table></details></figure></div>
      </section>
      <section id="inspection" class="inspection" aria-labelledby="tract-heading"><div><h2 id="tract-heading">Inspect a tract</h2><label for="search">Search by area ID or type</label><input id="search" type="search" placeholder="Search 400 tracts" autocomplete="off" aria-controls="tract-list"><p id="search-count" role="status" class="subtle"></p><div class="tract-scroll"><table class="tract-table"><caption class="sr-only">Searchable tract list. Choose Inspect for details.</caption><thead><tr><th scope="col">Tract</th><th scope="col">Type</th><th scope="col">Pattern</th><th scope="col">Inspect</th></tr></thead><tbody id="tract-list"></tbody></table></div></div><aside id="list-details-slot" class="tract-detail" aria-label="Selected tract details" hidden></aside></section>
      <details class="methodology"><summary>Data & methodology</summary><div id="provenance"></div></details>
    </main><footer><span>Fieldnotes / Broadband equity</span><a href="?renderer=table">Use table view</a></footer>`;

  function dispatch(a: Action) {
    if (a.type === "restart") detailPresentation = "story";
    else if (
      (a.type === "story" || a.type === "resume") &&
      detailPresentation === "map"
    )
      detailPresentation = "story";
    state = reduce(state, a);
    render();
  }
  function renderList() {
    const query = state.search.trim().toLowerCase();
    const rows = data.tracts.filter((t) =>
      `${t.id} ${t.countyType ?? "Unknown"}`.toLowerCase().includes(query),
    );
    el("search-count").textContent =
      `${rows.length} of ${data.tracts.length} areas`;
    el("tract-list").innerHTML = rows.length
      ? rows
          .map(
            (t) =>
              `<tr class="${t.id === state.inspectedTractId ? "selected" : ""}"><th scope="row">${escape(t.id)}</th><td>${escape(t.countyType ?? "Not available")}</td><td>${clusterNames[t.lisaCluster]}</td><td><button class="inspect-button" data-id="${escape(t.id)}" aria-label="Inspect tract ${escape(t.id)}" aria-pressed="${t.id === state.inspectedTractId}">Inspect</button></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="4">No matching tracts. Try a shorter ID or a county type.</td></tr>';
  }
  let displayedTractId: string | null = null;
  function renderDetail(t: Tract | undefined) {
    const listDetails = !!t && detailPresentation === "list";
    const mapDetails = !!t && detailPresentation === "map";
    const slot = el(listDetails ? "list-details-slot" : "map-details-slot");
    if (el("selected-panel").parentElement !== slot)
      slot.append(el("selected-panel"));
    el("selected-panel").hidden = !listDetails && !mapDetails;
    el("list-details-slot").hidden = !listDetails;
    el("inspection").classList.toggle("has-details", listDetails);
    el("story-content").hidden = mapDetails;
    if ((t?.id ?? null) === displayedTractId) return;
    displayedTractId = t?.id ?? null;
    if (t && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el("selected-panel").animate(
        [{ backgroundColor: "#fff0c7" }, { backgroundColor: "transparent" }],
        { duration: 500 },
      );
    }
    el("detail").innerHTML = t
      ? `<p class="detail-id">${escape(t.id)}</p><p class="subtle">Synthetic tract / ${escape(t.countyType ?? "Not available")}</p><dl>${[
          [
            "Internet use",
            t.broadbandAdoptionRate === null
              ? "Not available"
              : pct(t.broadbandAdoptionRate),
          ],
          [
            "Median household income",
            t.medianHouseholdIncome === null
              ? "Not available"
              : "$" +
                fmt(
                  t.medianHouseholdIncome,
                  data.metadata.displayPrecision.income,
                ),
          ],
          ["Total count (proxy)", fmt(t.totalHouseholds)],
          ["Underserved count (proxy)", fmt(t.underservedHouseholds)],
          ["Area pattern", `${clusterNames[t.lisaCluster]} (${t.lisaCluster})`],
          [
            "Pattern test p-value",
            t.lisaPValue === null ? "Not available" : fmt(t.lisaPValue, 3),
          ],
        ]
          .map(
            ([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`,
          )
          .join("")}</dl>`
      : "";
  }
  function render() {
    const focusedId = document.activeElement?.getAttribute("data-id");
    const c = coverage(data.tracts, state.targetingMode),
      groups = byCounty(data.tracts, state.targetingMode);
    const rule =
      state.targetingMode === "all" ? "All areas" : "Cold spots only";
    el("map-caption").textContent =
      `${layerNames[state.layer]} / ${state.view === "flat" ? "Flat overview" : "3D landscape"}`;
    for (const id of ["layer", "targeting", "emphasis"]) {
      const value =
        id === "targeting"
          ? state.targetingMode
          : state[id as "layer" | "emphasis"];
      el(id)
        .querySelectorAll<HTMLInputElement>('input[type="radio"]')
        .forEach((input) => {
          input.checked = input.value === value;
        });
    }
    el("flat").setAttribute("aria-pressed", String(state.view === "flat"));
    el("tilted").setAttribute("aria-pressed", String(state.view === "tilted"));
    const entry = stories[state.step];
    el("mode-label").textContent =
      state.mode === "story" ? "Guided story" : "Free exploration";
    el("step-label").textContent = `${state.step + 1} / 4`;
    document
      .querySelectorAll<HTMLButtonElement>("[data-step]")
      .forEach((b, i) => {
        b.setAttribute("aria-current", i === state.step ? "step" : "false");
      });
    el("story-title").textContent = entry.title;
    el("story-body").textContent = entry.body;
    el("story-insight").innerHTML =
      `<strong>${pct(state.step === 3 ? c.excludedRate : c.coverageRate)}</strong><span>${state.step === 3 ? "outside" : "inside"} target <small>${escape(rule)}</small></span>`;
    (el("back") as HTMLButtonElement).disabled = state.step === 0;
    (el("next") as HTMLButtonElement).disabled = state.step === 3;
    el("resume").hidden = state.mode === "story";
    el("explore").hidden = state.mode !== "story";
    el("coverage-value").textContent = pct(c.coverageRate);
    el("covered-value").textContent = fmt(c.covered);
    el("excluded-value").textContent = fmt(c.excluded);
    const bar = (covered: number, excluded: number, denominator: number) =>
      `<div class="stacked" aria-hidden="true"><span class="inside" style="width:${denominator ? (covered / denominator) * 100 : 0}%"></span><span class="outside" style="width:${denominator ? (excluded / denominator) * 100 : 0}%"></span></div>`;
    el("total-chart").innerHTML = c.total
      ? `${bar(c.covered, c.excluded, c.total)}<div class="bar-endpoints"><span>0</span><span>${fmt(c.total)}</span></div>`
      : "<p>No underserved households in this dataset. Rates are not applicable.</p>";
    el("total-table").innerHTML =
      `<tr><th scope="row">Inside</th><td>${fmt(c.covered)}</td><td>${pct(c.coverageRate)}</td></tr><tr><th scope="row">Outside</th><td>${fmt(c.excluded)}</td><td>${pct(c.excludedRate)}</td></tr>`;
    const axisMax = Math.max(0, ...groups.map((g) => g.total));
    el("county-chart").innerHTML = axisMax
      ? groups
          .map(
            (g) =>
              `<div class="county-row"><span>${escape(g.name)}</span>${bar(g.covered, g.excluded, axisMax)}<span>${fmt(g.total)}</span></div>`,
          )
          .join("") +
        `<div class="bar-endpoints"><span>0</span><span>${fmt(axisMax)}</span></div>`
      : "<p>No underserved households in these groups.</p>";
    el("county-table").innerHTML = groups
      .map(
        (g) =>
          `<tr><th scope="row">${escape(g.name)}</th><td>${fmt(g.covered)}</td><td>${fmt(g.excluded)}</td><td>${pct(g.coverageRate)}</td></tr>`,
      )
      .join("");
    let legend = "";
    if (state.layer === "lisa")
      legend = Object.entries(clusters)
        .map(
          ([k, color]) =>
            `<span><i style="background:${color}"></i>${clusterNames[k]}</span>`,
        )
        .join("");
    else if (state.layer === "county")
      legend = colors.categories
        .map(
          (k) =>
            `<span><i style="background:${colors.color({ countyType: k } as Tract, "county")}"></i>${escape(k)}</span>`,
        )
        .join("");
    else
      legend = `<div class="sequential"><span>${state.layer === "adoption" ? "0%" : "$0"}</span><i style="background:linear-gradient(90deg, ${state.layer === "adoption" ? `${scales.adoption.low},${scales.adoption.high}` : `${scales.income.low},${scales.income.high}`})"></i><span>${state.layer === "adoption" ? "100%" : "$" + fmt(colors.incomeMax, 0)}</span></div>`;
    el("legend").innerHTML =
      legend +
      (data.tracts.some((t) =>
        state.layer === "adoption"
          ? t.broadbandAdoptionRate === null
          : state.layer === "income"
            ? t.medianHouseholdIncome === null
            : state.layer === "county" && t.countyType === null,
      )
        ? `<span><i style="background:${missing}"></i>Not available</span>`
        : "");
    el("height-legend").hidden = state.view !== "tilted";
    const max = Math.max(...data.tracts.map((t) => t.underservedHouseholds));
    el("height-legend").textContent = max
      ? `Height: 0 to ${fmt(max)} underserved counts (proxy)`
      : "Height: 0, no underserved counts";
    renderList();
    renderDetail(data.tracts.find((t) => t.id === state.inspectedTractId));
    if (focusedId)
      [...document.querySelectorAll<HTMLButtonElement>("[data-id]")]
        .find((b) => b.dataset.id === focusedId)
        ?.focus({ preventScroll: true });
    map?.update(state);
  }
  el("layer").onchange = (e) =>
    dispatch({
      type: "manual",
      patch: { layer: (e.target as HTMLInputElement).value as Layer },
    });
  el("targeting").onchange = (e) =>
    dispatch({
      type: "manual",
      patch: {
        targetingMode: (e.target as HTMLInputElement).value as "all" | "ll",
      },
    });
  el("emphasis").onchange = (e) =>
    dispatch({
      type: "manual",
      patch: {
        emphasis: (e.target as HTMLInputElement).value as
          "none" | "targeted" | "outside",
      },
    });
  el("flat").onclick = () => {
    dispatch({ type: "manual", patch: { view: "flat" } });
    map?.reset();
  };
  el("tilted").onclick = () =>
    dispatch({ type: "manual", patch: { view: "tilted" } });
  el("reset").onclick = () => map?.reset();
  el("clear").onclick = () => {
    const wasList = detailPresentation === "list";
    const id = state.inspectedTractId;
    detailPresentation = "story";
    dispatch({ type: "inspect", id: null });
    if (wasList) {
      const row = [
        ...document.querySelectorAll<HTMLButtonElement>("[data-id]"),
      ].find((button) => button.dataset.id === id);
      (row ?? el("search")).focus({ preventScroll: true });
    } else {
      el("story-title").setAttribute("tabindex", "-1");
      el("story-title").focus({ preventScroll: true });
    }
  };
  function inspect(
    id: string,
    source: "map" | "list" = "map",
    keyboard = false,
  ) {
    detailPresentation = source;
    dispatch({ type: "inspect", id });
    const panel = el("selected-panel");
    const rect = panel.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight)
      panel.scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    if (keyboard) el("selected-heading").focus({ preventScroll: true });
  }
  el("search").oninput = (e) => {
    state = reduce(state, {
      type: "search",
      value: (e.target as HTMLInputElement).value,
    });
    renderList();
  };
  el("tract-list").onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-id]",
    );
    if (b) inspect(b.dataset.id!, "list", (e as MouseEvent).detail === 0);
  };
  el("back").onclick = () => dispatch({ type: "story", step: state.step - 1 });
  el("next").onclick = () => dispatch({ type: "story", step: state.step + 1 });
  el("explore").onclick = () => dispatch({ type: "explore" });
  el("resume").onclick = () => dispatch({ type: "resume" });
  el("restart").onclick = () => {
    el<HTMLInputElement>("search").value = "";
    dispatch({ type: "restart" });
  };
  document
    .querySelectorAll<HTMLButtonElement>("[data-step]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          dispatch({ type: "story", step: Number(b.dataset.step) })),
    );
  const m = data.metadata;
  el("provenance").innerHTML =
    `<p><strong>${escape(m.title)}. Synthetic dataset.</strong> No real ACS mode or measured California findings are included.</p><dl>${Object.entries(
      m.definitions,
    )
      .map(([k, v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`)
      .join(
        "",
      )}</dl><p>LISA: ${escape(m.lisa.variable)}, pseudo p ${escape(m.lisa.comparison)} ${m.lisa.significance}, ${m.lisa.permutations} permutations, ${escape(m.lisa.weights)}. Multiple-testing correction: ${escape(m.lisa.correction)}. ${escape(m.lisa.seedNote)}</p><p>Coordinates: ${escape(m.coordinateSystem)} Source units: ${escape(m.sourceUnits)}</p><p>Source commit: <a href="${escape(m.sourceRepository)}/tree/${m.sourceCommit}">${m.sourceCommit}</a>. Inputs: ${m.sourcePaths.map(escape).join(", ")}.</p><p>${escape(m.reuse)}</p><p>Generated ${escape(m.generatedAt)}. Cluster membership is an analytical result, not a grant-allocation mandate. The example does not demonstrate service delivery or a causal policy effect.</p>`;
  function fallback(message: string) {
    el("map").classList.add("table-mode");
    el("map").innerHTML =
      `<div class="fallback"><span aria-hidden="true">▦</span><h3>Explore through the tract table</h3><p role="status">${escape(message)}</p><a href="#tract-heading">Go to searchable tracts</a><p>Targeting, coverage, charts and tract inspection remain available.</p></div>`;
    (el("reset") as HTMLButtonElement).disabled = true;
    el("map-hint").textContent =
      "Use the searchable tract table below to inspect every record.";
  }
  render();
  if (new URLSearchParams(location.search).get("renderer") === "table")
    fallback("Table view is enabled by the renderer=table URL option.");
  else {
    try {
      el("map-status").remove();
      map = createMap(
        el("map"),
        data,
        (id) => inspect(id),
        () => {
          if (state.mode === "story") dispatch({ type: "explore" });
        },
        fallback,
      );
      map.update(state);
    } catch (error) {
      map?.dispose();
      fallback(
        `The WebGL map is unavailable. ${error instanceof Error ? error.message : "Graphics initialization failed."}`,
      );
    }
  }
  // Read-only instrumentation for documented local performance checks.
  const diagnostics = () => map?.diagnostics() ?? { renderer: "table" };
  Object.assign(window, { broadbandDiagnostics: diagnostics });
  const teardown = () => {
    map?.dispose();
    delete (window as any).broadbandDiagnostics;
  };
  window.addEventListener("pagehide", teardown, { once: true });
  import.meta.hot?.dispose(() => {
    window.removeEventListener("pagehide", teardown);
    teardown();
  });
}
start();
