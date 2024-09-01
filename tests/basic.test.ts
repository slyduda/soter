import { expect, test } from "vitest";
import { machine } from "../src";
import { matterMachineDict, useMatter } from "../examples/composable";

test("check if state is mutatable", () => {
  const matter = machine(useMatter("solid"), matterMachineDict);
  matter.state = "liquid";
  expect(matter.state).toBe("liquid");
});

test("check if trigger is the state trigger", () => {
  const matter = machine({ state: "liquid", trigger: 1 }, matterMachineDict);
  expect(matter.trigger).not.toBe(1);
});
