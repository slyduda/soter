import { expect, test } from "vitest";
import { addStateMachine } from "../src";
import { matterMachineDict, useMatter } from "../examples/composable";

test("check if state is mutatable", () => {
  const matter = addStateMachine(useMatter("solid"), matterMachineDict);
  matter.state = "liquid";
  expect(matter.state).toBe("liquid");
});

test("check if trigger is the state trigger", () => {
  const matter = addStateMachine(
    { state: "liquid", trigger: 1 },
    matterMachineDict
  );
  expect(matter.trigger).not.toBe(1);
});
