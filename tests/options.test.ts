import { expect, test } from "vitest";
import { matterMachineDict, Matter, MatterState } from "../examples/physics";
import { soter } from "../src";

test("check to see if we can throw exceptions with machine.options.exceptions = true", () => {
  const matter = new Matter("solid");
  const objectMachine = soter(matter, matterMachineDict, {
    throwExceptions: false,
  });
  expect(matter.temperature).toBe(0);
  objectMachine.trigger("evaporate");
  expect(objectMachine.state).toBe<MatterState>("solid");
});

test("check to see if we can throw exceptions with options.throwExceptions = true", () => {
  const matter = new Matter("solid");
  const objectMachine = soter(matter, matterMachineDict, {
    throwExceptions: false,
  });
  expect(matter.temperature).toBe(0);

  expect(() =>
    objectMachine.triggerWithOptions("evaporate", {
      throwExceptions: true,
    })
  ).toThrowError("OriginDisallowed");
});
