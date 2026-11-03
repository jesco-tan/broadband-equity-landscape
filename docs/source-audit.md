# Source audit

Audited repository: https://github.com/jesco-tan/geospatial-urban-analytics

Pinned commit: `35056d8c204c1f631be3ff2f5ac00a2495113a52`.

The repository owner explicitly authorized reuse in this application on
2026-11-02. Upstream has no LICENSE file. This task-specific permission resolves
the application fixture reuse gate; it does not assert an open license for
unrelated reuse of the upstream repository. No report images or presentation
assets are copied into this app.

## Inputs inspected

- `notebooks/geo_walkthrough.ipynb`: generation, analysis and summary export cells.
- `src/geo_urban/fetch.py`: synthetic generator and seed.
- `src/geo_urban/spatial_stats.py`: weights and final LISA labels.
- `src/geo_urban/regression.py`: `population_coverage_analysis` definition.
- `src/geo_urban/maps.py`: serialization of complete records in the LISA map.
- `config/default.yaml`: synthetic seed, threshold and analytical settings.
- `outputs/run_summary.json`: reconciliation reference.
- `outputs/choropleth_lisa.html`: full embedded GeoJSON record export.
- `README.md`, `REPORT.md`, `requirements.txt` and repository file inventory.

The committed JSON summary contains aggregates only. No standalone full-record
GeoJSON, CSV or geospatial file is committed. The saved LISA map contains a
complete GeoJSON FeatureCollection generated directly by `gdf.to_json()`.
The adapter decodes that structured JSON argument using Python's JSON decoder;
it does not read tooltip text, scrape displayed values or execute JavaScript.
This preserves the exact committed geometry, full-precision attributes, p-values
and significance-qualified classifications. It is preferable here to invoking
the pipeline again, because the LISA random seed is not recorded and regenerated
membership may differ. The adapter verifies the checkout commit and rejects local
changes to both input artifacts. It never changes the upstream checkout.

## Field mapping and integrity

| Application field | Upstream source | Meaning |
| --- | --- | --- |
| id | GEOID | Synthetic stable identifier, not an authentic tract identifier |
| geometry | geometry | Synthetic 20 by 20 grid within a California-like bounding box |
| totalHouseholds | population | Explicit population-based household proxy |
| underservedHouseholds | population if broadband_rate < 0.65; otherwise 0 | Exact upstream coverage guardrail definition |
| broadbandAdoptionRate | broadband_rate | Synthetic subscription fraction |
| medianHouseholdIncome | median_household_income | Synthetic USD; no observed vintage |
| countyType | county_type | Categories from synthetic urban proximity |
| lisaCluster | lisa_cluster | Final exported HH, LL, HL, LH or NS result |
| lisaPValue | lisa_p_sim | Full precision pseudo p-value from the saved run |

Upstream calls sums of its `population` column households. No actual household
count field exists in the synthetic generator. This app preserves that guardrail
arithmetic and explicitly labels all such counts as population proxies. It must
not represent them as measured household estimates. In particular, underserved
counts are the entire proxy count of low-adoption tracts, not a count estimated
as `population * (1 - broadband_rate)`.

County type comes from the generator's latent urban proximity: values greater
than 0.62 are urban, values greater than 0.35 are suburban, the rest rural.
These are synthetic categories rather than a Census urban/rural designation.

LISA analyzes `broadband_rate` using Queen contiguity, row-standardised weights,
999 permutations and strict `lisa_p_sim < 0.05`. No multiple-testing correction
appears in the code. Generation seed is 42. Local Moran's I has no supplied seed;
its run seed is unavailable. Final labels are preserved, never reconstructed
from rounded p-values. Cluster membership describes association, not causation.

## Coordinates and height

Input grid polygons are tagged EPSG:4326, spanning longitude -124.5 to -114.0
and latitude 32.5 to 42.0. They are artificial boxes, not census boundaries.
The adapter projects once to a local equirectangular system centred on
(-119.25, 37.25), with sphere radius 6371008.8 metres:

```text
x = R * radians(longitude - longitude0) * cos(radians(latitude0))
y = R * radians(latitude - latitude0)
```

Units are approximate metres; this is a display projection, not an area-accurate
analytical CRS. The rendering normalizes both axes by the same longest extent
to preserve the exported aspect ratio. No background basemap implies authentic
geography. Height is linear, zero at ground and 25 scene units at the largest
underserved proxy count, against a longest map extent of 100 scene units.
It is an explicitly exaggerated display encoding, not geographic elevation.

## Reproducibility and environments

The adapter requires Python 3.10+ and Git only. It was run with Python 3.14.5.
It takes an explicit source checkout and output path. See README.md for commands.
The pinned input hash is recorded in fixture metadata. Regenerating from the
same clean inputs changes only the generation timestamp, not the records.

Rerunning the complete upstream analysis is separate and unnecessary for app
development: upstream pins NumPy 1.26.4, GeoPandas 0.14.4, pandas 2.2.2,
libpysal 4.10.0, esda 2.6.0, and other Python requirements. Use a compatible
Python environment, rather than attempting to install those old binary pins
under Python 3.14. The browser never recalculates spatial statistics.

## Analytical limits and source bytes

The pinned analytical weights graph has 45 disconnected components and mean degree 4.25. The explorer preserves the saved labels; it does not validate upstream grid topology or rerun LISA. Local tests use uncorrected pseudo p-values. No causal or eligibility claim follows from these labels.

The recorded source hash is over CRLF bytes. The public raw source is LF-normalized; reconstructing CRLF reproduces the recorded SHA-256. Record content equivalence separately from byte identity. Internal tract and household field names are schema compatibility identifiers for synthetic cells and generated population proxies.
