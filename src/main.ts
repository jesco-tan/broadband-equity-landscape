import "./style.css";
import { validateDataset, type Dataset, type Tract } from "./data";
import { byCounty, coverage, targeted } from "./analytics";
import { initialState, reduce, type Action, type Layer } from "./state";
import {
  clusters,
  clusterNames,
  createColors,
  layerNames,
  missing,
  scales,
} from "./colors";
import { mapControls, targetControls, readingGuide } from "./controls";
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
    body: "The flat view shows low-use areas near other low-use areas. These cold spots form the target; the next chapter adds height to reveal their weight.",
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
    <a class="skip" href="#main-content">Skip to main content</a>
    <header class="masthead"><a href="./" class="wordmark"><span class="mark" aria-hidden="true">▥</span> Fieldnotes <span class="wordmark-sub">Spatial equity lab</span></a><span class="dataset-badge">Synthetic data <span aria-hidden="true">/</span> ${data.tracts.length} synthetic cells</span><a class="source-link" href="${escape(data.metadata.sourceRepository)}/tree/${data.metadata.sourceCommit}" target="_blank" rel="noreferrer">View source</a></header>
    <main id="main-content" tabindex="-1">
      <section class="intro"><div><p class="eyebrow">Broadband equity landscape</p><h1>Cold spots are places.<br>Need lives in households.</h1></div><p class="intro-note">Does targeting areas with low internet use reach everyone who needs help?</p></section>
      <div class="method-note"><p><strong>Synthetic example.</strong> Counts are generated population proxies, not measured households.</p>${readingGuide()}</div>
      <div class="workspace">
        <div id="mobile-story-slot"></div>
        <section class="landscape" aria-label="Interactive landscape">
          <div class="map-topline"><span id="map-caption">Broadband adoption</span></div>
          <div class="legend-wrap"><div id="legend" aria-label="Color legend"></div><p id="height-legend" hidden></p></div>
          <div class="map-controls"><div class="segmented" aria-label="Map view"><button id="tilted" aria-pressed="true">3D landscape</button><button id="flat" aria-pressed="false">Flat view</button></div><button id="reset" class="quiet" hidden>Reset camera</button></div>
          <div id="map" class="map"><p id="map-status" role="status">Preparing the map...</p></div>
          <div id="mobile-nav-slot"></div>
          <details id="map-settings" class="map-settings"><summary>Map settings</summary><div class="map-toolbar">${mapControls()}<p>Map colors and highlighting do not change the target.</p></div></details>
          <p class="map-hint" id="map-hint">Select a cell to inspect. Drag to rotate; scroll to zoom.</p>
        </section>
        <aside class="story-panel" aria-label="Story and selected area"><div id="story-reading"><div class="story-top"><span id="mode-label">Guided story</span><span id="step-label">1 / 4</span></div><div id="story-content"><div class="progress" aria-hidden="true">${stories.map((_, i) => `<span data-step="${i}"></span>`).join("")}</div><h2 id="story-title"></h2><p id="story-body"></p><div id="story-insight" class="story-insight" aria-live="polite"></div></div></div><div id="map-details-slot"><section id="selected-panel" class="selected-panel" aria-labelledby="selected-heading" hidden><div class="detail-top"><h3 id="selected-heading" tabindex="-1"><span class="selection-dot" aria-hidden="true"></span>Selected area</h3><button id="clear" class="text-button" aria-label="Close area details">Close</button></div><div id="detail" aria-live="polite" aria-atomic="true"></div></section></div><div id="story-actions"><div class="story-nav"><button id="back" class="quiet">Back</button><button id="next">Next chapter <span aria-hidden="true">↗</span></button></div><div class="story-secondary"><button id="explore" class="text-button">Explore freely</button><button id="resume" class="text-button" hidden>Resume story</button><button id="restart" class="text-button" hidden>Restart story</button></div></div></aside>
      </div>
      <section class="analysis" aria-labelledby="coverage-heading"><div class="section-heading"><h2 id="coverage-heading">Who is inside the target?</h2></div>
        <div id="controls" class="controls" tabindex="-1">${targetControls()}<p>Choose which areas count toward the target. Map colors do not affect this calculation.</p></div>
        <p class="coverage-definition"><strong>What is counted?</strong> The underserved count includes the entire population proxy of areas with broadband adoption below 65%, including households with subscriptions. These are synthetic stand-ins for households. Coverage describes inclusion in the target, not service delivered.</p>
        <div class="metrics" aria-live="polite"><div><span id="coverage-value" class="metric-number"></span><span>Share of underserved count inside target</span></div><div><span id="covered-value" class="metric-number"></span><span>Underserved count inside target (proxy)</span></div><div><span id="excluded-value" class="metric-number"></span><span>Underserved count outside target (proxy)</span></div></div>
        <div class="charts"><figure><figcaption><h3>Inside versus outside</h3></figcaption><div id="total-chart"></div><div class="chart-key"><span><i class="inside-swatch"></i>Inside target</span><span><i class="outside-swatch"></i>Outside target</span></div><details class="chart-data"><summary>View values</summary><table class="chart-table"><caption class="sr-only">Overall coverage values</caption><thead><tr><th scope="col">Location</th><th scope="col">Count proxy</th><th scope="col">Share</th></tr></thead><tbody id="total-table"></tbody></table></details></figure><figure><figcaption><h3>By area type</h3><p>Same count scale across groups.</p></figcaption><div id="county-chart"></div><details class="chart-data"><summary>View values</summary><table class="chart-table"><caption class="sr-only">Coverage by synthetic county type</caption><thead><tr><th scope="col">Type</th><th scope="col">Inside</th><th scope="col">Outside</th><th scope="col">Coverage</th></tr></thead><tbody id="county-table"></tbody></table></details></figure></div>
      </section>
      <section id="inspection" class="inspection" aria-labelledby="tract-heading"><div><h2 id="tract-heading">Inspect a synthetic cell</h2><label for="search">Search by area ID or type</label><input id="search" type="search" placeholder="Search 400 cells" autocomplete="off" aria-controls="tract-list"><p id="search-count" role="status" class="subtle"></p><div class="tract-scroll"><table class="tract-table"><caption class="sr-only">Searchable synthetic cell list. Choose a cell ID for details.</caption><thead><tr><th scope="col">Cell</th><th scope="col">Type</th><th scope="col">Pattern</th></tr></thead><tbody id="tract-list"></tbody></table></div></div><aside id="list-details-slot" class="tract-detail" aria-label="Selected cell details" hidden></aside></section>
      <details class="methodology"><summary>Data & methodology</summary><div id="provenance"></div></details>
    </main><footer><span>Fieldnotes / Broadband equity</span><a href="?renderer=table">Use table view</a></footer>`;

  const storyPanel = document.querySelector<HTMLElement>(".story-panel")!;
  storyPanel.insertBefore(el("story-actions"), el("map-details-slot"));
  const mobileLayout = matchMedia("(max-width: 780px)");
  function arrangeStory() {
    if (mobileLayout.matches) {
      el("mobile-story-slot").append(el("story-reading"));
      el("mobile-nav-slot").append(el("story-actions"));
    } else {
      storyPanel.prepend(el("story-reading"));
      storyPanel.insertBefore(el("story-actions"), el("map-details-slot"));
    }
  }
  arrangeStory();
  mobileLayout.addEventListener("change", arrangeStory);

  function dispatch(a: Action) {
    if (a.type === "restart") detailPresentation = "story";
    else if (
      (a.type === "story" || a.type === "resume") &&
      detailPresentation === "map"
    )
      detailPresentation = "story";
    state = reduce(state, a);
    render();
    const currentFocus = document.activeElement as HTMLElement | null;
    if (currentFocus && !currentFocus.getClientRects().length) {
      el("story-title").setAttribute("tabindex", "-1");
      el("story-title").focus({ preventScroll: true });
    }
    if (mobileLayout.matches && (a.type === "story" || a.type === "resume" || a.type === "restart"))
      el("story-reading").scrollIntoView({ block: "start", behavior: "instant" });
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
              `<tr class="${t.id === state.inspectedTractId ? "selected" : ""}"><th scope="row"><button class="inspect-button" data-id="${escape(t.id)}" aria-label="Inspect cell ${escape(t.id)}" aria-pressed="${t.id === state.inspectedTractId}">${escape(t.id)}</button></th><td>${escape(t.countyType ?? "Not available")}</td><td>${clusterNames[t.lisaCluster]}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="3">No matching cells. Try a shorter ID or a county type.</td></tr>';
  }
  let displayedDetailKey = "";
  function renderDetail(t: Tract | undefined) {
    const listDetails = !!t && detailPresentation === "list";
    const mapDetails = !!t && detailPresentation === "map";
    const slot = el(listDetails ? "list-details-slot" : "map-details-slot");
    if (el("selected-panel").parentElement !== slot)
      slot.append(el("selected-panel"));
    el("selected-panel").hidden = !listDetails && !mapDetails;
    el("list-details-slot").hidden = !listDetails;
    el("inspection").classList.toggle("has-details", listDetails);
    el("story-content").hidden = false;
    const detailKey = t?.id ?? "";
    const targetLabel = t && targeted(t, state.targetingMode)
      ? "Inside target"
      : "Outside target";
    if (detailKey === displayedDetailKey) {
      if (t) el("detail-target").textContent = targetLabel;
      return;
    }
    displayedDetailKey = detailKey;
    if (t && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el("selected-panel").animate(
        [{ backgroundColor: "#fff0c7" }, { backgroundColor: "transparent" }],
        { duration: 500 },
      );
    }
    el("detail").innerHTML = t
      ? `<p class="detail-id">${escape(t.id)}</p><p class="subtle">Synthetic cell / ${escape(t.countyType ?? "Not available")}</p><dl>${[
          ["Broadband adoption", t.broadbandAdoptionRate === null ? "Not available" : pct(t.broadbandAdoptionRate)],
          ["Underserved count (proxy)", fmt(t.underservedHouseholds)],
        ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}<div><dt>Current target</dt><dd id="detail-target">${targetLabel}</dd></div></dl>
        <details class="statistical-details"><summary>Statistical details</summary><dl>${[
          ["Income (synthetic USD)", t.medianHouseholdIncome === null ? "Not available" : "$" + fmt(t.medianHouseholdIncome, data.metadata.displayPrecision.income)],
          ["Total count (proxy)", fmt(t.totalHouseholds)],
          ["Area pattern", `${clusterNames[t.lisaCluster]} (${t.lisaCluster})`],
          ["Pattern test p-value", t.lisaPValue === null ? "Not available" : fmt(t.lisaPValue, 3)],
        ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl></details><a class="return-map" href="#map-caption">Return to map</a>`
      : "";
  }
  let previousMode = state.mode;
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
      .querySelectorAll<HTMLElement>("[data-step]")
      .forEach((b, i) => {
        b.classList.toggle("current", i === state.step);
      });
    const exploring = state.mode === "exploration";
    if (previousMode !== state.mode) {
      el<HTMLDetailsElement>("map-settings").open = exploring;
      previousMode = state.mode;
    }
    el("restart").hidden = !exploring && state.step === 0;
    const highlight = { none: "Everything", targeted: "Inside target", outside: "Outside target" }[state.emphasis];
    el("story-title").textContent = exploring ? "Explore your own question." : entry.title;
    el("story-body").textContent = exploring
      ? `Colors: ${layerNames[state.layer]}. Target: ${rule}. Highlight: ${highlight}. View: ${state.view === "flat" ? "Flat" : "3D"}. Return to chapter ${state.step + 1} to restore its settings.`
      : entry.body;
    el("step-label").textContent = exploring ? `Paused at ${state.step + 1} / 4` : `${state.step + 1} / 4`;
    document.querySelector<HTMLElement>(".progress")!.hidden = exploring;
    el("story-insight").innerHTML = !exploring && state.step === 0
      ? '<span><b>Read color, then height.</b> Darker teal means higher adoption. Taller cells hold more underserved counts. Select a cell for details.</span>'
      : `<strong>${pct(!exploring && state.step === 3 ? c.excludedRate : c.coverageRate)}</strong><span>of the underserved count ${!exploring && state.step === 3 ? "outside" : "inside"} the target.<small>Target: ${escape(rule)}. Counts use a population proxy.</small></span>`;
    (el("back") as HTMLButtonElement).disabled = state.step === 0;
    el("back").hidden = exploring;
    el("next").hidden = exploring;
    el("next").textContent = state.step === 3 ? "Explore the data" : "Next chapter";
    el("resume").hidden = !exploring;
    el("resume").textContent = `Return to chapter ${state.step + 1}`;
    el("resume").title = "Restore this chapter's map, target and highlight settings";
    el("explore").hidden = exploring || state.step === 3;
    el("coverage-value").textContent = pct(c.coverageRate);
    el("covered-value").textContent = fmt(c.covered);
    el("excluded-value").textContent = fmt(c.excluded);
    const bar = (covered: number, excluded: number, denominator: number) =>
      `<div class="stacked" aria-hidden="true"><span class="inside" style="width:${denominator ? (covered / denominator) * 100 : 0}%"></span><span class="outside" style="width:${denominator ? (excluded / denominator) * 100 : 0}%"></span></div>`;
    el("total-chart").innerHTML = c.total
      ? `${bar(c.covered, c.excluded, c.total)}<div class="bar-endpoints"><span>0</span><span>${fmt(c.total)}</span></div>`
      : "<p>No underserved proxy units in this dataset. Rates are not applicable.</p>";
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
      : "<p>No underserved proxy units in these groups.</p>";
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
  el("next").onclick = () => dispatch(state.step === 3 ? { type: "explore" } : { type: "story", step: state.step + 1 });
  el("explore").onclick = () => dispatch({ type: "explore" });
  el("resume").onclick = () => dispatch({ type: "resume" });
  el("restart").onclick = () => {
    el<HTMLInputElement>("search").value = "";
    dispatch({ type: "restart" });
  };
  const m = data.metadata;
  el("provenance").innerHTML =
    `<p><strong>${escape(m.title)}. Synthetic dataset.</strong> No real ACS mode or measured California findings are included.</p><p>The saved analytical graph has 45 disconnected components and mean degree 4.25. This view preserves its uncorrected local-test labels; it does not validate grid connectivity or rerun LISA.</p><dl>${Object.entries(
      m.definitions,
    )
      .map(([k, v]) => `<div><dt>${escape(k)}</dt><dd>${escape(v)}</dd></div>`)
      .join(
        "",
      )}</dl><p>LISA: ${escape(m.lisa.variable)}, pseudo p ${escape(m.lisa.comparison)} ${m.lisa.significance}, ${m.lisa.permutations} permutations, ${escape(m.lisa.weights)}. Multiple-testing correction: ${escape(m.lisa.correction)}. ${escape(m.lisa.seedNote)}</p><p>Coordinates: ${escape(m.coordinateSystem)} Source units: ${escape(m.sourceUnits)}</p><p>Source commit: <a href="${escape(m.sourceRepository)}/tree/${m.sourceCommit}">${m.sourceCommit}</a>. Inputs: ${m.sourcePaths.map(escape).join(", ")}.</p><p>${escape(m.reuse)}</p><p>Generated ${escape(m.generatedAt)}. Cluster membership is an analytical result, not a grant-allocation mandate. The example does not demonstrate service delivery or a causal policy effect.</p>`;
  function fallback(message: string) {
    el("map").classList.add("table-mode");
    el("map").innerHTML =
      `<div class="fallback"><span aria-hidden="true">▦</span><h3>Explore through the cell table</h3><p role="status">${escape(message)}</p><a href="#tract-heading">Go to searchable cells</a><p>Targeting, coverage, charts and cell inspection remain available.</p></div>`;
    el("reset").hidden = true;
    el("map-hint").textContent =
      "Use the searchable cell table below to inspect every record.";
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
        (awayFromDefault) => {
          if (!awayFromDefault && document.activeElement === el("reset"))
            el(state.view === "flat" ? "flat" : "tilted").focus({ preventScroll: true });
          el("reset").hidden = !awayFromDefault;
        },
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
    mobileLayout.removeEventListener("change", arrangeStory);
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
