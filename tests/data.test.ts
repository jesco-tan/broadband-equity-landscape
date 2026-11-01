import { expect, test } from "bun:test";
import { validateDataset } from "../src/data";
import { coverage } from "../src/analytics";
import fixture from "../public/data/broadband-synthetic.v1.json";
const clone = () => structuredClone(fixture);
test("real fixture reconciles saved upstream totals and final classifications", () => {
  const d = validateDataset(fixture);
  expect(d.tracts).toHaveLength(400);
  expect(coverage(d.tracts, "ll")).toEqual({
    total: 521152,
    covered: 119165,
    excluded: 401987,
    coverageRate: 119165 / 521152,
    excludedRate: 401987 / 521152,
  });
  expect(d.tracts.filter((t) => t.lisaCluster === "LL")).toHaveLength(113);
  expect(d.tracts.filter((t) => t.lisaCluster === "NS")).toHaveLength(191);
});
const invalidCases: [string, (d: any) => unknown][] = [
  ["schema", (d: any) => (d.schemaVersion = 2)],
  ["duplicate IDs", (d: any) => (d.tracts[1].id = d.tracts[0].id)],
  ["missing counts", (d: any) => delete d.tracts[0].totalHouseholds],
  [
    "count bounds",
    (d: any) =>
      (d.tracts[0].underservedHouseholds = d.tracts[0].totalHouseholds + 1),
  ],
  ["negative counts", (d: any) => (d.tracts[0].totalHouseholds = -1)],
  ["nonfinite values", (d: any) => (d.tracts[0].totalHouseholds = Infinity)],
  ["malformed geometry", (d: any) => (d.tracts[0].geometry.coordinates = [])],
  ["unclosed ring", (d: any) => d.tracts[0].geometry.coordinates[0].pop()],
  [
    "invalid coordinate",
    (d: any) => (d.tracts[0].geometry.coordinates[0][0][0] = NaN),
  ],
  ["invalid cluster", (d: any) => (d.tracts[0].lisaCluster = "fake")],
  ["summary mismatch", (d: any) => d.referenceSummary.underservedHouseholds++],
  ["missing provenance", (d: any) => delete d.metadata.definitions],
];
test.each(invalidCases)("rejects %s", (_, change) => {
  const d = clone();
  change(d);
  expect(() => validateDataset(d)).toThrow();
});
test("optional missing fields stay null", () => {
  const d = clone();
  Object.assign(d.tracts[0], {
    broadbandAdoptionRate: null,
    medianHouseholdIncome: null,
    countyType: null,
    lisaPValue: null,
  });
  expect(validateDataset(d).tracts[0].broadbandAdoptionRate).toBeNull();
});
test("multipolygon with a hole is accepted", () => {
  const d: any = clone();
  d.tracts[0].geometry = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [2, 2],
          [2, 4],
          [4, 4],
          [4, 2],
          [2, 2],
        ],
      ],
      [
        [
          [12, 0],
          [13, 0],
          [13, 1],
          [12, 1],
          [12, 0],
        ],
      ],
    ],
  };
  expect(validateDataset(d).tracts[0].geometry.type).toBe("MultiPolygon");
});
