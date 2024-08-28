import { expect, test } from "vitest";
import { matterMachineDict, Matter, MatterState } from "../examples/physics";
import { addStateMachine } from "../src";

test("check to see if passing in props works", () => {
  const matter = new Matter("solid");
  const matterMachine = addStateMachine(matter, matterMachineDict);
  expect(matterMachine.temperature).toBe(0);
  matterMachine.trigger("melt", { temperature: 20 });
  expect(matterMachine.temperature).toBe(20);
});
