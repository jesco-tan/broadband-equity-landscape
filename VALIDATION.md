# Validation

I checked the v2 fixture against the analytical run manifest and reconciled all 400 cell records, final classifications and population-proxy targeting totals. All 25 Bun tests and the TypeScript check passed.

The tests cover fixture validation, coverage arithmetic, geometry and state transitions. They check that inspection, search and presentation controls preserve the targeting rule unless a targeting action explicitly changes it.

## Scope

The explorer displays saved results from a synthetic spatial analysis; it does not rerun inference in the browser or establish actual household need. These checks do not constitute a new browser or deployment verification of v2. See [data-validation.md](docs/data-validation.md) for provenance and reproduction. Earlier browser checks apply to the historical release described in [verification.md](docs/verification.md).
