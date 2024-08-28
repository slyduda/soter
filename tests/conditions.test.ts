import { expect, test } from "vitest";

import { addStateMachine } from "../src";
import { Hero, heroMachineDict, HeroState } from "../examples/hero";

test("check to see if transition can fallback", () => {
  const hero = addStateMachine(new Hero("idle"), heroMachineDict);
  expect(hero.state).toBe<HeroState>("idle");
  hero.trigger("patrol");
  expect(hero.state).toBe<HeroState>("idle");
  hero.trigger("patrol");
  expect(hero.state).toBe<HeroState>("sleeping");
});
