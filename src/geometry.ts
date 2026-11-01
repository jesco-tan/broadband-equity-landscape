import { Shape, Path, Vector2, ExtrudeGeometry } from "three";
import { polygons, type Tract, type Polygon } from "./data";
export function bounds(tracts: Tract[]) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const t of tracts)
    for (const p of polygons(t.geometry))
      for (const ring of p)
        for (const [x, y] of ring) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    extent: Math.max(maxX - minX, maxY - minY),
  };
}
export function makeShape(p: Polygon, b: ReturnType<typeof bounds>) {
  const points = (ring: Polygon[number]) =>
    ring.map(
      ([x, y]) =>
        new Vector2(
          ((x - b.cx) / b.extent) * 100,
          ((y - b.cy) / b.extent) * 100,
        ),
    );
  const shape = new Shape(points(p[0]));
  for (const hole of p.slice(1)) shape.holes.push(new Path(points(hole)));
  return shape;
}
export function makeGeometry(p: Polygon, b: ReturnType<typeof bounds>) {
  return new ExtrudeGeometry(makeShape(p, b), {
    depth: 1,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
}
