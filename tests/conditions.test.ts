import { expect, test } from "vitest";

import { machine } from "../src";
import { Hero, heroMachineDict, HeroState } from "../examples/hero";

test("check to see if transition can fallback", () => {
  const hero = machine(new Hero("idle"), heroMachineDict);
  expect(hero.state).toBe<HeroState>("idle");
  hero.trigger("patrol");
  expect(hero.state).toBe<HeroState>("idle");
  hero.trigger("patrol");
  expect(hero.state).toBe<HeroState>("sleeping");
});
