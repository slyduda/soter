import { StateList, InstructionRecord, InstructionDict } from "./types";
import { normalizeArray } from "./utils";

function createTriggerKeys<State, Trigger extends string>(
  states: StateList<State>
): Trigger[] {
  return states.map((state) => `to_${state}` as Trigger);
}

export class InstructionMap<
  State,
  Trigger extends string = string,
  Context = {}
> extends Map<string, InstructionRecord<State, Trigger, Context>[]> {
  ___instructions = true;

  constructor(
    instructions: InstructionDict<State, Trigger, Context> | StateList<State>
  ) {
    super();
    const instruct = Array.isArray(instructions)
      ? this.___generateInstructions(instructions)
      : instructions;

    for (const [trigger, transition] of Object.entries<
      | InstructionRecord<State, Trigger, Context>
      | InstructionRecord<State, Trigger, Context>[]
    >(instruct)) {
      this.set(trigger, normalizeArray(transition));
    }
  }

  // These are unrelated to the potential Context states in theory
  get states(): StateList<State> {
    const states: Set<State> = new Set();
    for (const [trigger, transitions] of this) {
      for (const transition of transitions) {
        states.add(transition.destination);
        const origins = normalizeArray(transition.origins);
        origins.forEach((origin) => {
          states.add(origin);
        });
      }
    }
    return new Array(...states);
  }

  get transitions(): InstructionDict<State, Trigger, Context> {
    const instructions: Partial<InstructionDict<State, Trigger, Context>> = {};

    for (const [trigger, transitions] of this.entries()) {
      instructions[trigger as Trigger] = transitions;
    }

    return instructions as InstructionDict<State, Trigger, Context>;
  }

  addTransition(
    trigger: string,
    transition:
      | InstructionRecord<State, Trigger, Context>
      | InstructionRecord<State, Trigger, Context>[],
    index?: number
  ): InstructionMap<State, Trigger, Context> {
    const transitions = this.get(trigger);
    if (transitions) {
      const normalizedTransitions = normalizeArray(transition);

      if (index !== undefined && index >= 0 && index < transitions.length) {
        transitions.splice(index, 0, ...normalizedTransitions);
      } else {
        transitions.push(...normalizedTransitions);
      }
    } else {
      this.set(trigger, normalizeArray(transition));
    }
    return this;
  }

  addState(
    state: State | StateList<State>
  ): InstructionMap<State, Trigger, Context> {
    // If there is a single intersection of a state. Prevent all new states from being added
    if (normalizeArray(state).every((state) => this.states.includes(state)))
      return this;

    // Generate new instructions for the new states
    const newInstructions = this.___generateInstructions([
      ...normalizeArray(state),
      ...this.states,
    ]);

    // Merge new instructions with existing instructions
    // We only want to add triggers that don't exist. If the trigger exists we can't guarantee it will be in the right position
    for (const [trigger, newTransition] of Object.entries(newInstructions) as [
      Trigger,
      (
        | InstructionRecord<State, Trigger, Context>
        | InstructionRecord<State, Trigger, Context>[]
      )
    ][]) {
      if (!this.has(trigger)) {
        this.set(trigger, normalizeArray(newTransition));
      }
    }

    return this;
  }

  private ___generateInstructions(
    states: StateList<State>
  ): InstructionDict<State, Trigger, Context> {
    const instructions: Partial<
      Record<Trigger, InstructionRecord<State, Trigger, Context>>
    > = {};

    const triggers = createTriggerKeys<State, Trigger>(states);

    for (const trigger of triggers) {
      const destination = trigger.replace("to_", "") as State;
      const origins = states.filter((state) => state !== destination);

      instructions[trigger] = {
        origins,
        destination,
      };
    }

    return instructions as InstructionDict<State, Trigger, Context>;
  }
}

export const instructions = <
  State,
  Trigger extends string = string,
  Context = {}
>(
  instructions: InstructionDict<State, Trigger, Context> | StateList<State>
) => {
  return new InstructionMap(instructions);
};
