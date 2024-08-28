import { expect, test } from "vitest";
import {
  exampleMachineDict,
  ExampleObject,
  ExampleObjectState,
} from "../examples";
import { addStateMachine } from "../src";

// This test initializes the ExampleObject
// We trigger the walk transition which by default transitions the object to walking state
test("check to see if state machine can transition", () => {
  const myObject = new ExampleObject();
  const objectMachine = addStateMachine(myObject, exampleMachineDict);
  expect(myObject.state).toBe<ExampleObjectState>("stopped");
  objectMachine.trigger("walk");
  expect(myObject.state).toBe<ExampleObjectState>("walking");
});

// This test initializes the ExampleObject with energy of 0
// We trigger the walk transition which checks to see if energy is > 0
test("check to see if conditions work", () => {
  const myObject = new ExampleObject(0);
  const objectMachine = addStateMachine(myObject, exampleMachineDict, {
    throwExceptions: false,
  });
  expect(myObject.state).toBe<ExampleObjectState>("stopped");
  objectMachine.trigger("walk");
  expect(myObject.state).toBe<ExampleObjectState>("stopped");
});

// This test initializes the ExampleObject with energy of 1
// We trigger the walk transition which reduces energy by 1
test("check to see if effects work", () => {
  const myObject = new ExampleObject(1);
  const objectMachine = addStateMachine(myObject, exampleMachineDict);
  expect(myObject.state).toBe<ExampleObjectState>("stopped");
  objectMachine.trigger("walk");
  expect(myObject.energy).toBe(0);
});
