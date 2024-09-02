import { expect, test } from "vitest";
import { soter } from "../src";
import { MatterState } from "../examples/physics";

test("checks to see if we can make valid transitions with .to()", () => {
  const matter = soter({ state: "solid" }, ["solid", "liquid"]);
  matter.to("liquid");
  expect(matter.state).toBe("liquid");
});

test("checks to see if invalid transitions throw errors", () => {
  const matter = soter({ state: "solid" }, [
    "solid",
    "liquid",
  ] as MatterState[]); // Cast simple state list as MatterState list to prevent error on next line

  expect(() => matter.to("plasma")).toThrowError("DestinationInvalid");
});

test("checks to see if we can make valid transitions with .trigger(`to_{destination}`) with state list", () => {
  const matter = soter({ state: "solid" }, ["solid", "liquid"]);
  matter.trigger("to_liquid");
  expect(matter.state).toBe("liquid");
});

test("checks to see if bad destination .trigger(`to_{destination}`) with state list causes error", () => {
  const matter = soter({ state: "solid" }, ["solid", "liquid"]);
  expect(() => matter.trigger("to_nonexistent")).toThrowError();
});
