import { expect, test } from "bun:test";
import { makeGeometry } from "../src/geometry";
test("polygon holes are triangulated without filling the hole", () => {
  const g = makeGeometry(
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
    { minX: 0, minY: 0, maxX: 100, maxY: 100, cx: 0, cy: 0, extent: 100 },
  );
  const p = g.attributes.position;
  let area = 0;
  for (let i = 0; i < p.count; i += 3) {
    if (p.getZ(i) !== 1 || p.getZ(i + 1) !== 1 || p.getZ(i + 2) !== 1) continue;
    area +=
      Math.abs(
        (p.getX(i + 1) - p.getX(i)) * (p.getY(i + 2) - p.getY(i)) -
          (p.getX(i + 2) - p.getX(i)) * (p.getY(i + 1) - p.getY(i)),
      ) / 2;
  }
  expect(area).toBeCloseTo(96, 8);
  g.dispose();
});
