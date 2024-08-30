import { expect, test } from "vitest";
import { addStateMachine } from "../src";
import { Matter, matterMachineDict, MatterState } from "../examples/physics";

test("check to see if onBeforeTransition works", () => {
  let beforeTransitionState: MatterState | null = null;
  const matter = addStateMachine(new Matter("solid", 10), matterMachineDict, {
    onBeforeTransition: (plannedState, state, context) => {
      beforeTransitionState = context.state;
    },
  });
  matter.trigger("melt");
  expect(beforeTransitionState).toBe("solid");
});

test("check to see if onTransition works", () => {
  let postTransitionState: MatterState | null = null;
  const matter = addStateMachine(new Matter("solid", 10), matterMachineDict, {
    onTransition: (state, oldState, context) => {
      postTransitionState = context.state;
    },
  });
  matter.trigger("melt");
  expect(postTransitionState).toBe("liquid");
});
