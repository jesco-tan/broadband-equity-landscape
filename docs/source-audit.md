# Verified synthetic fixture v2

The explorer now loads `public/data/broadband-synthetic.v2.json`. Historical v1 remains in Git history and is no longer used. Source commit records the analytical starting revision, not an uncommitted result. The analysis manifest hash and source/output hashes identify the executed local run.

400 cells, 258 below threshold, 521,152 underserved proxy units. Adjusted LL: 90 cells and 85,741 units, leaving 435,411 (83.5%) outside. Cluster counts: LL 90, HH 60, LH 4, NS 246. Rural outside: 132,879; suburban: 234,282; urban: 68,250.

Queen integer-grid adjacency has one component, no islands and mean degree 7.41. Seed 42, 9,999 permutations, two-sided local pseudo p-values with Benjamini-Yekutieli adjustment over 400 tests. `lisaPValue` now contains the adjusted value used for classification. Rook sensitivity covers 2.5%; selected cells are sensitive to the neighbour definition.

## Regenerate

```powershell
python scripts/export_dataset.py --source ../geospatial-urban-analytics --output public/data/broadband-synthetic.v2.json
bun test
bun run check
```

The exporter fails on input or output hash mismatches. Upstream REPORT.md documents the analytical command and tolerance. No observed household need, causal impact or actual subsidy eligibility is established. The current source fixture is v2; deployment status is checked separately. Earlier browser verification applies to the historical release, not this fixture.
