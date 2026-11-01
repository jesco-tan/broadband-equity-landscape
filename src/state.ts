import type { Targeting } from "./analytics";
export type Layer = "adoption" | "income" | "county" | "lisa";
export type Emphasis = "none" | "targeted" | "outside";
export interface State {
  inspectedTractId: string | null;
  targetingMode: Targeting;
  emphasis: Emphasis;
  layer: Layer;
  view: "flat" | "tilted";
  mode: "story" | "exploration";
  step: number;
  search: string;
}
export const initialState = (): State => ({
  inspectedTractId: null,
  targetingMode: "all",
  emphasis: "none",
  layer: "adoption",
  view: "tilted",
  mode: "story",
  step: 0,
  search: "",
});
const steps: Pick<State, "layer" | "view" | "targetingMode" | "emphasis">[] = [
  { layer: "adoption", view: "tilted", targetingMode: "all", emphasis: "none" },
  { layer: "lisa", view: "flat", targetingMode: "ll", emphasis: "targeted" },
  { layer: "lisa", view: "tilted", targetingMode: "ll", emphasis: "targeted" },
  { layer: "lisa", view: "tilted", targetingMode: "ll", emphasis: "outside" },
];
export type Action =
  | { type: "inspect"; id: string | null }
  | { type: "search"; value: string }
  | {
      type: "manual";
      patch: Partial<
        Pick<State, "layer" | "view" | "targetingMode" | "emphasis">
      >;
    }
  | { type: "story"; step: number }
  | { type: "explore" }
  | { type: "restart" }
  | { type: "resume" };
export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "inspect":
      return { ...s, inspectedTractId: a.id };
    case "search":
      return { ...s, search: a.value };
    case "manual":
      return { ...s, ...a.patch, mode: "exploration" };
    case "story": {
      const step = Math.max(0, Math.min(3, a.step));
      return { ...s, ...steps[step], step, mode: "story" };
    }
    case "explore":
      return { ...s, mode: "exploration" };
    case "restart":
      return initialState();
    case "resume":
      return reduce(s, { type: "story", step: s.step });
  }
}
