import { expect, test } from "vitest";
import { instructions, InstructionMap } from "../src/instructions";
import { soter } from "../src";
import { matterMachineDict, useMatter } from "../examples/composable";

type MatterState = "solid" | "liquid" | "gas" | "plasma" | "obsidian";
const states: MatterState[] = ["solid", "liquid", "gas", "plasma"];
const dict = {
  melt: [
    {
      origins: "solid",
      destination: "liquid",
      effects: "setEnvironment",
      conditions: "canMelt",
    },
  ],
};

test("instruction states initialization", () => {
  const inst = new InstructionMap<MatterState>(states);
  const other = instructions(states);

  expect(inst).toBeDefined();
  expect(other).toBeDefined();
});

test("instruction transitions initialization", () => {
  const inst = new InstructionMap(dict);
  const other = instructions(dict);

  expect(inst).toBeDefined();
  expect(other).toBeDefined();
});

test("instruction addState", () => {
  const inst = new InstructionMap(states);
  expect(inst.states.length).toBe(4);
  expect(Object.entries(inst.transitions).length).toBe(4);

  inst.addState("obsidian");
  expect(inst.states.length).toBe(5);
  expect(Object.entries(inst.transitions).length).toBe(5);
});

test("instruction addTransition", () => {
  const inst = new InstructionMap(dict);
  expect(Object.entries(inst.transitions).length).toBe(1);

  inst.addTransition("melt", {
    origins: "solid",
    destination: "liquid",
  });
  expect(inst.states.length).toBe(2);
  expect(Object.entries(inst.transitions).length).toBe(1);

  inst.addTransition("to_obsidian", {
    origins: "solid",
    destination: "obsidian",
  });
  expect(inst.states.length).toBe(3);
  expect(Object.entries(inst.transitions).length).toBe(2);
});

test("instruction destructuring failure", () => {
  const { addState } = instructions(states);
  expect(() => addState("obsidian")).toThrowError("undefined");
});

test("instruction globals", () => {
  const inst = instructions(states);
  const matter1 = soter(useMatter("solid"), inst);
  const matter2 = soter(useMatter("solid"), inst);
  const matter3 = soter(useMatter("solid"), instructions(states));
  inst.addState("obsidian");
  matter1.to("obsidian");
  matter2.to("obsidian");
  expect(() => matter3.to("obsidian")).toThrowError("DestinationInvalid");
});

test("instruction globals from machine", () => {
  const inst = instructions(states);
  const matter1 = soter(useMatter("solid"), inst);
  const matter2 = soter(useMatter("solid"), inst);
  const matter3 = soter(useMatter("solid"), instructions(states));
  matter1.addTransition("to_obsidian", {
    origins: matter1.states,
    destination: "obsidian",
  });
  matter1.trigger("to_obsidian");
  matter2.trigger("to_obsidian");
  expect(() => matter3.trigger("to_obsidian")).toThrowError("TriggerUndefined");
});
