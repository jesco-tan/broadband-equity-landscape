import { expect, test } from "bun:test";
import { initialState, reduce } from "../src/state";
test("story steps apply their exact states and preserve inspection", () => {
  let s = reduce(initialState(), { type: "inspect", id: "abc" });
  s = reduce(s, { type: "story", step: 1 });
  expect(s).toMatchObject({
    layer: "lisa",
    targetingMode: "ll",
    view: "tilted",
    emphasis: "targeted",
    inspectedTractId: "abc",
  });
  s = reduce(s, { type: "story", step: 2 });
  expect(s.view).toBe("tilted");
  s = reduce(s, { type: "story", step: 3 });
  expect(s.emphasis).toBe("outside");
  expect(s.targetingMode).toBe("ll");
});
test("inspection and search keep story and targeting; manual controls explore", () => {
  let s = reduce(initialState(), { type: "story", step: 2 });
  s = reduce(s, { type: "search", value: "rural" });
  s = reduce(s, { type: "inspect", id: "abc" });
  expect(s.mode).toBe("story");
  expect(s.targetingMode).toBe("ll");
  s = reduce(s, { type: "manual", patch: { layer: "income" } });
  expect(s.mode).toBe("exploration");
  expect(s.inspectedTractId).toBe("abc");
  s = reduce(s, { type: "resume" });
  expect(s.layer).toBe("lisa");
  expect(s.search).toBe("rural");
  expect(s.inspectedTractId).toBe("abc");
});
test("flat view, emphasis, clear inspection never change targeting", () => {
  let s = reduce(initialState(), { type: "story", step: 3 });
  for (const patch of [
    { view: "flat" as const },
    { emphasis: "none" as const },
  ])
    s = reduce(s, { type: "manual", patch });
  s = reduce(s, { type: "inspect", id: null });
  expect(s.targetingMode).toBe("ll");
});
test("restart clears search and inspection and restores initial state", () => {
  const s = {
    ...initialState(),
    search: "abc",
    inspectedTractId: "abc",
    step: 3,
  };
  expect(reduce(s, { type: "restart" })).toEqual(initialState());
  expect(initialState().view).toBe("tilted");
});
