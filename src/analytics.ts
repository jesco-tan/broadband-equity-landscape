import type { Tract } from "./data";
export type Targeting = "all" | "ll";
export const targeted = (t: Tract, mode: Targeting) =>
  mode === "all" || t.lisaCluster === "LL";
export function coverage(
  tracts: Tract[],
  selection: Targeting | ReadonlySet<string>,
) {
  let total = 0,
    covered = 0;
  for (const t of tracts) {
    total += t.underservedHouseholds;
    if (
      typeof selection === "string"
        ? targeted(t, selection)
        : selection.has(t.id)
    )
      covered += t.underservedHouseholds;
  }
  return {
    total,
    covered,
    excluded: total - covered,
    coverageRate: total ? covered / total : null,
    excludedRate: total ? (total - covered) / total : null,
  };
}
export function byCounty(tracts: Tract[], mode: Targeting) {
  const groups = new Map<string, Tract[]>();
  for (const t of tracts) {
    const key = t.countyType ?? "Unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, rows]) => ({ name, ...coverage(rows, mode) }));
}
