import { layerNames } from "./colors";

// Native radio groups expose the choices directly and retain arrow-key navigation.
function choices(id: string, title: string, values: [string, string][]) {
  return `<fieldset id="${id}" class="choice-group"><legend>${title}</legend><div class="choices">${values.map(([value, label]) => `<label class="choice"><input type="radio" name="${id}" value="${value}"><span>${label}</span></label>`).join("")}</div></fieldset>`;
}
export function targetControls() {
  return choices("targeting", "Include in target", [
    ["all", "All areas"],
    ["ll", "Cold spots only"],
  ]);
}
export function mapControls() {
  return (
    choices("layer", "Map colors", Object.entries(layerNames)) +
    choices("emphasis", "Highlight", [
      ["none", "Everything"],
      ["targeted", "Inside target"],
      ["outside", "Outside target"],
    ])
  );
}
export function readingGuide() {
  return `<details id="reading-guide" class="reading-guide"><summary>How to read this map</summary><dl>
    <div><dt>Tract</dt><dd>One grid cell representing an example area. These are synthetic cells, not real census boundaries.</dd></div>
    <div><dt>Internet use</dt><dd>The share of households with a broadband subscription, also called adoption. It does not tell us whether infrastructure is available.</dd></div>
    <div><dt>Cold & hot spots</dt><dd>A cold spot (LL) has low internet use near other low-use areas; a hot spot (HH) is the reverse. The statistical method is called LISA. Spots must pass the source's significance test; "No clear pattern" means that test did not pass.</dd></div>
    <div><dt>Income & area type</dt><dd>Income is the median household income in US dollars: half of households are above it and half below. Rural, suburban and urban are categories created by the synthetic model.</dd></div>
    <div><dt>Target & coverage</dt><dd>The target is the set of areas you include. Coverage is the share of all underserved counts inside it, not a measure of service delivered.</dd></div>
    <div><dt>Underserved</dt><dd>In this example, areas where fewer than 65% have a broadband subscription. Their entire count is included, not just those without a subscription.</dd></div>
    <div><dt>Count proxy</dt><dd>A stand-in for household counts. The source uses synthetic population, so these are not measured household estimates.</dd></div>
    <div><dt>Height</dt><dd>Taller cells have larger underserved counts. Height is a linear display scale, not geographic elevation; its maximum is a quarter of the map's longest side.</dd></div>
  </dl></details>`;
}
