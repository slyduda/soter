import { expect, test } from "vitest";

import { soter } from "../src";
import { Hero, heroMachineDict, HeroState } from "../examples/hero";

test("check to see if transition can fallback", () => {
  const hero = soter(new Hero("idle"), heroMachineDict);
  expect(hero.state).toBe<HeroState>("idle");
  hero.trigger("patrol");
  expect(hero.state).toBe<HeroState>("idle");
  hero.trigger("patrol");
  expect(hero.state).toBe<HeroState>("sleeping");
});
