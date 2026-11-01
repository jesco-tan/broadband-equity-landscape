import { Color } from "three";
import type { Dataset, Tract } from "./data";
import type { Layer } from "./state";
export const missing = "#b7b7b0";
export const clusters: Record<string, string> = {
  LL: "#286887",
  HH: "#a94d48",
  HL: "#a87921",
  LH: "#725498",
  NS: "#c3c7c2",
};
const counties: Record<string, string> = {
  rural: "#427f77",
  suburban: "#b18842",
  urban: "#766899",
};
export const layerNames: Record<Layer, string> = {
  adoption: "Internet use",
  income: "Income",
  county: "Area type",
  lisa: "Cold & hot spots",
};
export const clusterNames: Record<string, string> = {
  LL: "Cold spot",
  HH: "Hot spot",
  HL: "High near low",
  LH: "Low near high",
  NS: "No clear pattern",
};
export const scales = {
  adoption: { low: "#8bbcb8", high: "#104b56" },
  income: { low: "#d2b779", high: "#70451e" },
};
export function createColors(data: Dataset) {
  const incomeMax = Math.max(
    1,
    ...data.tracts.map((t) => t.medianHouseholdIncome ?? 0),
  );
  const categories = [
    ...new Set(
      data.tracts
        .map((t) => t.countyType)
        .filter((x): x is string => x !== null),
    ),
  ].sort();
  const color = (t: Tract, layer: Layer): string => {
    if (layer === "lisa") return clusters[t.lisaCluster];
    if (layer === "county")
      return t.countyType === null
        ? missing
        : (counties[t.countyType] ??
            `hsl(${(categories.indexOf(t.countyType) * 67) % 360} 35% 40%)`);
    const v =
      layer === "adoption" ? t.broadbandAdoptionRate : t.medianHouseholdIncome;
    if (v === null) return missing;
    return (
      "#" +
      new Color(scales[layer].low)
        .lerp(
          new Color(scales[layer].high),
          layer === "adoption" ? v : v / incomeMax,
        )
        .getHexString()
    );
  };
  return { color, incomeMax, categories };
}
