export type Point = [number, number];
export type Polygon = Point[][];
export type Geometry =
  | { type: "Polygon"; coordinates: Polygon }
  | { type: "MultiPolygon"; coordinates: Polygon[] };
export type Cluster = "HH" | "LL" | "HL" | "LH" | "NS";
export interface Tract {
  id: string;
  geometry: Geometry;
  totalHouseholds: number;
  underservedHouseholds: number;
  broadbandAdoptionRate: number | null;
  medianHouseholdIncome: number | null;
  countyType: string | null;
  lisaCluster: Cluster;
  lisaPValue: number | null;
}
export interface Dataset {
  schemaVersion: 1;
  metadata: {
    datasetId: string;
    title: string;
    kind: "synthetic";
    generatedAt: string;
    sourceRepository: string;
    sourceCommit: string;
    sourcePaths: string[];
    reuse: string;
    coordinateSystem: string;
    sourceUnits: string;
    definitions: {
      adoption: string;
      income: string;
      households: string;
      underserved: string;
      countyType: string;
    };
    lisa: {
      variable: string;
      significance: number;
      comparison: string;
      correction: string;
      weights: string;
      permutations: number;
      seed: number | null;
      seedNote: string;
    };
    displayPrecision: { count: number; rate: number; income: number };
    tolerances: { count: number; rate: number };
  };
  referenceSummary: {
    tractCount: number;
    totalHouseholds: number;
    underservedHouseholds: number;
    llTractCount: number;
    llUnderservedHouseholds: number;
    llCoverage: number | null;
    source: string;
  };
  tracts: Tract[];
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const object = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);
export function polygons(g: Geometry): Polygon[] {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}
function validateGeometry(g: unknown) {
  assert(
    object(g) &&
      ["Polygon", "MultiPolygon"].includes(g.type) &&
      Array.isArray(g.coordinates),
    "Malformed geometry",
  );
  const parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  assert(parts.length, "Empty geometry");
  for (const polygon of parts) {
    assert(Array.isArray(polygon) && polygon.length, "Empty polygon");
    for (const ring of polygon) {
      assert(Array.isArray(ring) && ring.length >= 4, "Malformed ring");
      assert(
        ring.every(
          (p) => Array.isArray(p) && p.length === 2 && p.every(finite),
        ),
        "Invalid coordinate",
      );
      assert(
        ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1],
        "Ring must be closed",
      );
      let area = 0;
      for (let i = 1; i < ring.length; i++)
        area += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
      assert(Math.abs(area) > 0, "Degenerate ring");
    }
  }
}
export function validateDataset(raw: unknown): Dataset {
  assert(object(raw) && raw.schemaVersion === 1, "Unsupported dataset schema");
  const m = raw.metadata;
  assert(object(m) && m.kind === "synthetic", "Expected synthetic metadata");
  for (const key of [
    "datasetId",
    "title",
    "generatedAt",
    "sourceRepository",
    "sourceCommit",
    "reuse",
    "coordinateSystem",
    "sourceUnits",
  ])
    assert(
      typeof m[key] === "string" && m[key].length,
      `Missing metadata: ${key}`,
    );
  assert(/^[a-f0-9]{40}$/.test(m.sourceCommit), "Invalid pinned commit");
  assert(
    Array.isArray(m.sourcePaths) &&
      m.sourcePaths.length &&
      m.sourcePaths.every((s: unknown) => typeof s === "string" && s.length),
    "Missing source paths",
  );
  assert(object(m.definitions), "Missing definitions");
  for (const k of [
    "adoption",
    "income",
    "households",
    "underserved",
    "countyType",
  ])
    assert(
      typeof m.definitions[k] === "string" && m.definitions[k].length,
      `Missing definition: ${k}`,
    );
  assert(object(m.lisa), "Missing LISA metadata");
  for (const k of [
    "variable",
    "comparison",
    "correction",
    "weights",
    "seedNote",
  ])
    assert(
      typeof m.lisa[k] === "string" && m.lisa[k].length,
      `Missing LISA setting: ${k}`,
    );
  assert(
    finite(m.lisa.significance) &&
      m.lisa.significance >= 0 &&
      m.lisa.significance <= 1 &&
      Number.isInteger(m.lisa.permutations) &&
      m.lisa.permutations >= 0 &&
      (m.lisa.seed === null || finite(m.lisa.seed)),
    "Invalid LISA settings",
  );
  assert(
    object(m.displayPrecision) &&
      ["count", "rate", "income"].every(
        (k) =>
          Number.isInteger(m.displayPrecision[k]) &&
          m.displayPrecision[k] >= 0 &&
          m.displayPrecision[k] <= 6,
      ),
    "Invalid display precision",
  );
  assert(
    object(m.tolerances) &&
      ["count", "rate"].every(
        (k) =>
          finite(m.tolerances[k]) &&
          m.tolerances[k] >= 0 &&
          m.tolerances[k] <= 0.001,
      ),
    "Invalid tolerances",
  );
  assert(
    Array.isArray(raw.tracts) && raw.tracts.length > 0,
    "Dataset has no tracts",
  );
  const ids = new Set<string>();
  for (const t of raw.tracts) {
    assert(
      object(t) && typeof t.id === "string" && t.id.trim() && !ids.has(t.id),
      "Empty or duplicate tract ID",
    );
    ids.add(t.id);
    assert(
      finite(t.totalHouseholds) &&
        finite(t.underservedHouseholds) &&
        t.totalHouseholds >= 0 &&
        t.underservedHouseholds >= 0 &&
        t.underservedHouseholds <= t.totalHouseholds,
      `Invalid household counts: ${t.id}`,
    );
    assert(
      t.broadbandAdoptionRate === null ||
        (finite(t.broadbandAdoptionRate) &&
          t.broadbandAdoptionRate >= 0 &&
          t.broadbandAdoptionRate <= 1),
      "Invalid adoption rate",
    );
    assert(
      t.medianHouseholdIncome === null ||
        (finite(t.medianHouseholdIncome) && t.medianHouseholdIncome >= 0),
      "Invalid income",
    );
    assert(
      t.countyType === null ||
        (typeof t.countyType === "string" && t.countyType.length),
      "Invalid county type",
    );
    assert(
      ["HH", "LL", "HL", "LH", "NS"].includes(t.lisaCluster),
      "Invalid cluster",
    );
    assert(
      t.lisaPValue === null ||
        (finite(t.lisaPValue) && t.lisaPValue >= 0 && t.lisaPValue <= 1),
      "Invalid p-value",
    );
    validateGeometry(t.geometry);
  }
  const r = raw.referenceSummary;
  assert(
    object(r) && typeof r.source === "string" && r.source.length,
    "Missing reference summary",
  );
  const tracts = raw.tracts as Tract[];
  const ll = tracts.filter((t) => t.lisaCluster === "LL");
  const sum = (ts: Tract[], k: "totalHouseholds" | "underservedHouseholds") =>
    ts.reduce((a, t) => a + t[k], 0);
  const total = sum(tracts, "underservedHouseholds");
  const covered = sum(ll, "underservedHouseholds");
  for (const [k, value] of Object.entries({
    tractCount: tracts.length,
    totalHouseholds: sum(tracts, "totalHouseholds"),
    underservedHouseholds: total,
    llTractCount: ll.length,
    llUnderservedHouseholds: covered,
  }))
    assert(
      finite(r[k]) && Math.abs(r[k] - value) <= m.tolerances.count,
      `Reference mismatch: ${k}`,
    );
  assert(
    total === 0
      ? r.llCoverage === null
      : finite(r.llCoverage) &&
          Math.abs(r.llCoverage - covered / total) <= m.tolerances.rate,
    "Reference mismatch: llCoverage",
  );
  return raw as unknown as Dataset;
}
