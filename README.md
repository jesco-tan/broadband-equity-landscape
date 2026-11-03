# Broadband Equity Landscape

Interactive explorer for a synthetic 400-cell targeting exercise. The corrected v2 fixture uses verified queen topology and BY-adjusted local tests. LL targeting covers 16.5% of the defined underserved population proxy; 83.5% remains outside. Rook sensitivity covers 2.5%.

See [data validation](docs/data-validation.md) for exact totals, provenance, limitations and regeneration. Counts are generated population proxies, not observed household estimates.

```powershell
bun install
bun test
bun run check
```

The owner runs development and production builds separately. No build is required for these checks. Publishing main triggers the existing site workflow; source publication alone does not verify deployment.
