import { expect, test } from "vitest";

import { machine } from "../src";
import { Hero, heroMachineDict } from "../examples/hero";

test("check to see if potential transitions works", () => {
  const hero = machine(new Hero("idle"), heroMachineDict);
  hero.trigger("patrol");
  const potential = hero.potentialTransitions;
  expect(potential.filter((transition) => transition.satisfied).length).toBe(2);
});

test("check to see if potential transitions with state list works", () => {
  const hero = machine(new Hero("idle"), ["idle", "sleeping"]);
  const potential = hero.potentialTransitions;
  expect(potential.filter((transition) => transition.satisfied).length).toBe(1);
});
