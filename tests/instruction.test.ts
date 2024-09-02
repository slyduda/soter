import { expect, test } from "vitest";
import { instructions, InstructionMap } from "../src/instructions";

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
