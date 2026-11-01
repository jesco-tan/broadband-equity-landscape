# Data validation

Pinned run: `35056d8c204c1f631be3ff2f5ac00a2495113a52`.

The export adapter decoded all 400 records from the committed LISA map and
reconciled counts with `outputs/run_summary.json` from the same commit.

| Measure | Exported value |
| --- | ---: |
| Tracts | 400 |
| Total population-based household proxy | 1,222,162 |
| Underserved proxy | 521,152 |
| Significant LL tracts | 113 |
| Underserved proxy in LL | 119,165 |
| Underserved proxy outside LL | 401,987 |
| LL coverage, unrounded | 0.2286568985631831 |
| LL coverage, display | 22.9% |

Cluster counts: HH 92, LL 113, HL 0, LH 4, NS 191.
There is no discrepancy with the committed summary or rounded report coverage.
The geographic framing in upstream prose is not adopted as a measured finding.

| Synthetic county type | Underserved proxy | Inside LL | Outside LL |
| --- | ---: | ---: | ---: |
| Rural | 218,620 | 119,165 | 99,455 |
| Suburban | 234,282 | 0 | 234,282 |
| Urban | 68,250 | 0 | 68,250 |

Integer counts are exact. Dataset reconciliation tolerances are 1e-8 for counts
and 1e-10 for rates. Display precision is zero decimals for proxy counts and
income, one decimal for percentage rates. Aggregation always uses unrounded
values. Source p-values are retained; rounding does not determine membership.

Export checks include count and cluster reconciliation, unique IDs, count bounds,
finite coordinates and closed nonempty rings. The browser additionally checks
schema version, metadata, optional value bounds, required fields, geometry,
cluster vocabulary and all reference summary values, rejecting the whole load
if any record fails. Optional null values remain missing, never zero.

Automated fixtures exercise empty and complete targeting, zero denominators,
fractional counts, missing optional fields, unknown county groups, polygon holes,
multipolygons and malformed records. See docs/verification.md for results.
