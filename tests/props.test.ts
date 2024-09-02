import { expect, test } from "vitest";
import { matterMachineDict, Matter, MatterState } from "../examples/physics";
import { soter } from "../src";

test("check to see if passing in props works", () => {
  const matter = new Matter("solid", 10);
  const matterMachine = soter(matter, matterMachineDict);
  expect(matterMachine.temperature).toBe(10);
  matterMachine.trigger("melt", { temperature: 20 });
  expect(matterMachine.temperature).toBe(20);
});
