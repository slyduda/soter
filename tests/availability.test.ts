import { expect, test } from "vitest";

import { addStateMachine } from "../src";
import { Hero, heroMachineDict } from "../examples/hero";

test("check to see if available transitions works", () => {
  const hero = addStateMachine(new Hero("idle"), heroMachineDict);
  hero.trigger("patrol");
  const available = hero.getAvailableTransitions();
  expect(available.filter((transition) => transition.satisfied).length).toBe(2);
});
