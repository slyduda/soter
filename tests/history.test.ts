import { expect, test } from "vitest";
import {
  exampleMachineDict,
  ExampleObject,
  ExampleObjectState,
} from "../examples";
import { soter } from "../src";

const START_ENERGY = 1;

test("check to see if base precontext context comparison works", () => {
  const myObject = new ExampleObject(START_ENERGY);
  const objectMachine = soter(myObject, exampleMachineDict);
  expect(myObject.energy).toBe(1);
  const response = objectMachine.trigger("walk");
  expect(response.context?.energy).toBe(0);
});

test("check to see if condition attempt context works", () => {
  const myObject = new ExampleObject(START_ENERGY);
  const objectMachine = soter(myObject, exampleMachineDict);
  expect(myObject.state).toBe<ExampleObjectState>("stopped");
  const response = objectMachine.trigger("walk");
  expect(response.attempts?.[0].conditions?.[0].context?.energy).toBe(1);
});

test("check to see if effects attempt context works", () => {
  const myObject = new ExampleObject(START_ENERGY);
  const objectMachine = soter(myObject, exampleMachineDict);
  expect(myObject.state).toBe<ExampleObjectState>("stopped");
  const response = objectMachine.trigger("walk");
  expect(response.attempts?.[0].effects?.[0].context?.energy).toBe(1);
});

test("check to see if failure history works", () => {
  const myObject = new ExampleObject(START_ENERGY);
  const objectMachine = soter(myObject, exampleMachineDict, {
    throwExceptions: false,
  });
  expect(myObject.state).toBe<ExampleObjectState>("stopped");
  objectMachine.trigger("walk");
  objectMachine.trigger("stop");
  const response = objectMachine.trigger("walk");
  expect(response.success).toBe(false);
  expect(response.failure).toBeTruthy();
  expect(response.attempts[0].failure).toBeTruthy();
});
