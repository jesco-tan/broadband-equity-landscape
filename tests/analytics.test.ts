import { describe, expect, test } from "bun:test";
import { byCounty, coverage } from "../src/analytics";
import type { Tract } from "../src/data";
const row = (
  id: string,
  underservedHouseholds: number,
  lisaCluster: "LL" | "NS",
  countyType: string | null,
): Tract => ({
  id,
  underservedHouseholds,
  totalHouseholds: 20,
  lisaCluster,
  countyType,
  broadbandAdoptionRate: 0.4,
  medianHouseholdIncome: null,
  lisaPValue: null,
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
});
const rows = [
  row("a", 6, "LL", "rural"),
  row("b", 2, "NS", "rural"),
  row("c", 12, "NS", null),
];
describe("coverage with independently calculated expected values", () => {
  test("empty and complete targeting", () => {
    expect(coverage(rows, new Set())).toEqual({
      total: 20,
      covered: 0,
      excluded: 20,
      coverageRate: 0,
      excludedRate: 1,
    });
    expect(coverage(rows, "all")).toEqual({
      total: 20,
      covered: 20,
      excluded: 0,
      coverageRate: 1,
      excludedRate: 0,
    });
  });
  test("LL and complement including NS", () => {
    expect(coverage(rows, "ll")).toEqual({
      total: 20,
      covered: 6,
      excluded: 14,
      coverageRate: 0.3,
      excludedRate: 0.7,
    });
  });
  test("empty records and zero denominator", () => {
    expect(coverage([], "ll")).toEqual({
      total: 0,
      covered: 0,
      excluded: 0,
      coverageRate: null,
      excludedRate: null,
    });
    expect(coverage([row("a", 0, "LL", null)], "all").coverageRate).toBeNull();
  });
  test("fractional estimates preserved", () => {
    const c = coverage(
      [row("a", 1.25, "LL", null), row("b", 3.75, "NS", null)],
      "ll",
    );
    expect(c).toEqual({
      total: 5,
      covered: 1.25,
      excluded: 3.75,
      coverageRate: 0.25,
      excludedRate: 0.75,
    });
  });
  test("groups use same denominator locally and reconcile globally", () => {
    const g = byCounty(rows, "ll");
    expect(g.find((g) => g.name === "rural")).toEqual({
      name: "rural",
      total: 8,
      covered: 6,
      excluded: 2,
      coverageRate: 0.75,
      excludedRate: 0.25,
    });
    expect(g.find((g) => g.name === "Unknown")?.excluded).toBe(12);
    expect(g.reduce((n, g) => n + g.covered + g.excluded, 0)).toBe(20);
  });
});
