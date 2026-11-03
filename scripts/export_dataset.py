"""Export a manifest-verified upstream run without rerunning statistics.

No third-party Python packages required. The repository owner authorized reuse
on 2026-11-02. Read the canonical GeoJSON after checking the executed analytical
manifest, without scraping rendered maps.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess



def export(source: Path, output: Path):
    commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    manifest = json.loads((source / "outputs/manifest.json").read_text())
    for name, expected in manifest["inputs"].items():
        if hashlib.sha256((source/name).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Analysis input hash mismatch: {name}")
    for name in ["cells.geojson", "run_summary.json"]:
        if hashlib.sha256((source/"outputs"/name).read_bytes()).hexdigest() != manifest["outputs"][name]:
            raise ValueError(f"Analysis output hash mismatch: {name}")
    collections = [json.loads((source/"outputs/cells.geojson").read_text())]
    features = collections[0]['features']
    # Local equirectangular projection centred on the synthetic box. This keeps
    # grid topology; units are approximate metres, never authentic tract borders.
    radius = 6371008.8
    def point(p):
        return [radius * math.radians(p[0] + 119.25) * math.cos(math.radians(37.25)),
                radius * math.radians(p[1] - 37.25)]
    tracts = []
    for f in features:
        p, g = f['properties'], f['geometry']
        polygons = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        if g['type'] not in ['Polygon', 'MultiPolygon']:
            raise ValueError('Unsupported source geometry')
        count = p['population']
        tracts.append(dict(id=p['GEOID'], geometry=dict(type=g['type'], coordinates=(
            [[point(x) for x in ring] for ring in polygons[0]] if g['type'] == 'Polygon' else
            [[[point(x) for x in ring] for ring in polygon] for polygon in polygons])),
            totalHouseholds=count, underservedHouseholds=count if p['broadband_rate'] < .65 else 0,
            broadbandAdoptionRate=p['broadband_rate'], medianHouseholdIncome=p['median_household_income'],
            countyType=p['county_type'], lisaCluster=p['lisa_cluster'], lisaPValue=p.get('lisa_p_adjusted')))
    summary = json.loads((source / 'outputs/run_summary.json').read_text(encoding='utf-8'))
    total = sum(t['underservedHouseholds'] for t in tracts)
    ll = [t for t in tracts if t['lisaCluster'] == 'LL']
    ll_total = sum(t['underservedHouseholds'] for t in ll)
    counts = dict(Counter(t['lisaCluster'] for t in tracts))
    assert len(tracts) == summary['n_tracts']
    assert counts == summary['lisa_cluster_counts']
    assert total == summary['guardrail']['total_underserved_hh']
    assert ll_total == summary['guardrail']['ll_underserved_hh']
    assert len({t['id'] for t in tracts}) == len(tracts)
    for t in tracts:
        assert 0 <= t['underservedHouseholds'] <= t['totalHouseholds']
        assert 0 <= t['broadbandAdoptionRate'] <= 1
        for polygon in ([t['geometry']['coordinates']] if t['geometry']['type'] == 'Polygon' else t['geometry']['coordinates']):
            for ring in polygon:
                assert len(ring) >= 4 and ring[0] == ring[-1]
                assert all(math.isfinite(v) for p in ring for v in p)
    metadata = dict(datasetId='broadband-synthetic.v2', title='Synthetic broadband landscape', kind='synthetic',
        generatedAt=datetime.now(timezone.utc).isoformat(), sourceRepository='https://github.com/jesco-tan/geospatial-urban-analytics',
        sourceCommit=commit, sourcePaths=['outputs/cells.geojson', 'outputs/run_summary.json', 'outputs/manifest.json', 'scripts/run_analysis.py'],
        sourceSha256=hashlib.sha256((source / 'outputs/cells.geojson').read_bytes()).hexdigest(),
        analysisManifestSha256=hashlib.sha256((source / 'outputs/manifest.json').read_bytes()).hexdigest(),
        sourceState='sourceCommit is the analysis starting commit; input/output hashes identify the exact executed run.',
        reuse='Repository owner explicitly authorized reuse for this application on 2026-11-02. Upstream has no general license file; this permission is not a general upstream license.',
        coordinateSystem='Local equirectangular, origin (-119.25, 37.25), sphere radius 6371008.8 m; x=R*(lon-lon0)*cos(lat0), y=R*(lat-lat0), angles in radians.',
        sourceUnits='Synthetic EPSG:4326 grid degrees; exported approximate metres. Not census boundaries.',
        definitions=dict(adoption='Synthetic broadband subscription rate, fraction [0,1]. Not infrastructure availability.',
            income='Synthetic median household income, USD, no measured vintage.',
            households='Upstream population column used as a household proxy. These are not measured household estimates.',
            underserved='Entire population proxy of tracts with broadband_rate < 0.65; otherwise zero. Not population * (1 - rate).',
            countyType='Synthetic urban_proximity > 0.62: urban; > 0.35: suburban; otherwise rural.'),
        lisa=dict(variable='broadband_rate', significance=.05, comparison='<', correction='Benjamini-Yekutieli across 400 two-sided local pseudo p-values',
            weights='Integer-grid Queen adjacency, row-standardised', permutations=9999, seed=42,
            seedNote='Generator and spatial permutation seed 42. Rook sensitivity is in the analytical run summary. Displayed local p-values are BY-adjusted.'),
        displayPrecision=dict(count=0, rate=1, income=0), tolerances=dict(count=1e-8, rate=1e-10))
    data = dict(schemaVersion=1, metadata=metadata, referenceSummary=dict(tractCount=len(tracts),
        totalHouseholds=sum(t['totalHouseholds'] for t in tracts), underservedHouseholds=total,
        llTractCount=len(ll), llUnderservedHouseholds=ll_total, llCoverage=ll_total / total if total else None,
        source='Hash-verified cells.geojson reconciled with outputs/run_summary.json'), tracts=tracts)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(dict(records=len(tracts), clusters=counts, totalProxy=data['referenceSummary']['totalHouseholds'],
        underservedProxy=total, llProxy=ll_total, llCoverage=ll_total / total, output=str(output)), indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    export(args.source.resolve(), args.output.resolve())
