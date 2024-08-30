import { TransitionError } from "./errors";
import {
  type ConditionAttempt,
  type EffectAttempt,
  type TransitionInstructions,
  type StateMachineOptions,
  type Transition,
  type TransitionAttempt,
  type TransitionFailure,
  type TransitionOptions,
  type TransitionProps,
  type TransitionResult,
  type StateList,
  type PendingTransitionResult,
  type AvailableTransition,
  StateMachineConfig,
  StateMachineInternalOptions,
} from "./types";
import { normalizeArray } from "./utils";

interface SimpleStateful<StateType> {
  state: StateType;
}

function defaultConditionEvaluator<Context>(
  conditionFunction: any,
  context: Context
): boolean {
  if (typeof conditionFunction === "function") {
    return conditionFunction.call(context);
  } else {
    return Boolean(conditionFunction);
  }
}

function defaultGetState<
  Context extends SimpleStateful<StateType>,
  K extends keyof SimpleStateful<StateType>,
  StateType
>(context: Context, key: K): StateType {
  return context[key];
}

function defaultSetState<
  Context extends SimpleStateful<StateType>,
  K extends keyof SimpleStateful<StateType>,
  StateType
>(context: Context, state: StateType, key: K) {
  context[key] = state;
}

const noop = () => {};

function createTriggerKeys<StateType, TriggerType extends string>(
  states: StateList<StateType>
): TriggerType[] {
  return states.map((state) => `to_${state}` as TriggerType);
}

export class StateMachine<
  StateType,
  TriggerType extends string,
  Stateful,
  K extends keyof Stateful,
  Context extends Stateful
> {
  private __context: Context;
  private __cache: Context | null;
  private __instructions: TransitionInstructions<
    StateType,
    TriggerType,
    Context
  >;
  private __states: StateList<StateType>;
  private __options: StateMachineConfig<StateType, Context, Stateful, K>;

  constructor(
    context: Context,
    instructions:
      | TransitionInstructions<StateType, TriggerType, Context>
      | StateList<StateType>,
    options: StateMachineInternalOptions<StateType, Context, Stateful, K>
  ) {
    const {
      key,
      verbose = false,
      throwExceptions = true,
      strictOrigins = false,
      conditionEvaluator = defaultConditionEvaluator,
      getState,
      setState,
      onTransition = noop,
      onBeforeTransition = noop,
    } = options ?? {};

    this.__context = context;
    if (Array.isArray(instructions)) {
      this.__states = instructions;
      this.__instructions = this.__generateTransitionInstructions(instructions);
    } else {
      this.__states = this.__getStatesFromTransitionInstructions(instructions);
      this.__instructions = instructions;
    }
    this.__cache = null;
    this.__options = {
      key,
      verbose,
      throwExceptions,
      strictOrigins,
      conditionEvaluator,
      getState,
      setState,
      onTransition,
      onBeforeTransition,
    };
  }

  private __getState(): StateType {
    const state: StateType = this.__options.getState(
      this.__context,
      this.__options.key
    );
    if (!state) throw new Error("Current state is undefined");
    return state;
  }

  private __setState(state: StateType) {
    const oldState = this.__getState();
    this.__options.onBeforeTransition(state, oldState, this.__context);
    this.__options.setState(this.__context, state, this.__options.key);
    const newState = this.__getState();
    if (this.__options.verbose) console.info(`State changed to ${newState}`);
    this.__options.onTransition(newState, oldState, this.__context);
  }

  private __getStatesFromTransitionInstructions(
    dict: TransitionInstructions<StateType, TriggerType, Context>
  ): StateList<StateType> {
    const states = new Set<StateType>();
    const transitions = Object.values<
      | Transition<StateType, TriggerType, Context>
      | Transition<StateType, TriggerType, Context>[]
    >(dict);
    for (let i = 0; i < transitions.length; i++) {
      const transitionList = normalizeArray(transitions[i]);
      transitionList.forEach((transition) => {
        states.add(transition.destination);
        const origins = normalizeArray(transition.origins);
        origins.forEach((origin) => {
          states.add(origin);
        });
      });
    }
    return new Array(...states);
  }

  private __generateTransitionInstructions(
    states: StateList<StateType>
  ): TransitionInstructions<StateType, TriggerType, Context> {
    const instructions: Partial<
      Record<TriggerType, Transition<StateType, TriggerType, Context>>
    > = {};

    const triggers = createTriggerKeys<StateType, TriggerType>(states);

    for (const trigger of triggers) {
      const destination = trigger.replace("to_", "") as StateType;
      const origins = states.filter((state) => state !== destination);

      instructions[trigger] = {
        origins,
        destination,
      };
    }

    return instructions as TransitionInstructions<
      StateType,
      TriggerType,
      Context
    >;
  }

  private __getCurrentContext(): Context {
    // TODO: Benchmark
    // const deepCopy: Context = structuredClone(this.__context);
    const deepCopy: Context = JSON.parse(JSON.stringify(this.__context));
    // this.cache = deepCopy;
    return deepCopy;
  }

  private __createPendingTransitionResult(): PendingTransitionResult<
    StateType,
    TriggerType,
    Context
  > {
    const context = this.__getCurrentContext();
    return {
      success: null,
      failure: null,
      initial: this.__getState(),
      current: null,
      attempts: null,
      precontext: context,
      context: null,
    };
  }

  private __prepareTransitionResult(
    pending: PendingTransitionResult<StateType, TriggerType, Context>,
    {
      success,
      failure,
    }: {
      success: boolean;
      failure: TransitionFailure<TriggerType, Context> | null;
    }
  ): TransitionResult<StateType, TriggerType, Context> {
    const result: TransitionResult<StateType, TriggerType, Context> = {
      ...pending,
      success,
      failure,
      context: failure?.context ?? this.__getCurrentContext(),
      current: this.__getState(),
      attempts: pending.attempts ?? [], // change this to null if there wasnt a matching transition?
    };
    return result;
  }

  private __handleFailure(
    pending: PendingTransitionResult<StateType, TriggerType, Context>,
    failure: TransitionFailure<TriggerType, Context>,
    message: string,
    {
      shouldThrowException,
    }: {
      shouldThrowException: boolean;
    }
  ): TransitionResult<StateType, TriggerType, Context> {
    const result = this.__prepareTransitionResult(pending, {
      success: false,
      failure,
    });

    if (shouldThrowException)
      throw new TransitionError({
        name: failure.type,
        message,
        result: result,
      });
    if (this.__options.verbose) console.info(message);

    return result;
  }

  private __getOriginsFromTransitions(
    transitions: Transition<StateType, TriggerType, Context>[]
  ) {
    return Array.from(
      transitions.reduce(
        (
          acc: Set<StateType>,
          curr: Transition<StateType, TriggerType, Context>
        ) => {
          normalizeArray(curr.origins).forEach((item) => acc.add(item));
          return acc;
        },
        new Set()
      )
    );
  }

  to(state: StateType) {
    if (!this.__states.includes(state)) {
      const message = `Destination ${state} is not included in the list of existing states`;
      throw new TransitionError({
        name: "DestinationInvalid",
        message,
        result: null,
      });
    }
    this.__setState(state);
  }

  triggerWithOptions(
    trigger: TriggerType,
    props: TransitionProps,
    options: TransitionOptions<Context>
  ): TransitionResult<StateType, TriggerType, Context>;
  triggerWithOptions(
    trigger: TriggerType,
    options: TransitionOptions<Context>
  ): TransitionResult<StateType, TriggerType, Context>;

  triggerWithOptions(
    trigger: TriggerType,
    secondParameter?: TransitionProps | TransitionOptions<Context>,
    thirdParameter?: TransitionOptions<Context>
  ): TransitionResult<StateType, TriggerType, Context> {
    let passedProps: TransitionProps | undefined = undefined;
    let passedOptions: TransitionOptions<Context> | undefined = undefined;

    if (thirdParameter !== undefined) {
      passedProps = secondParameter;
      passedOptions = thirdParameter;
    } else {
      // Cast since we know it will be Trigger Options
      passedOptions = secondParameter;
    }

    const options = passedOptions ?? {};
    const props = passedProps ?? {};

    return this.trigger(trigger, props, options);
  }

  trigger(
    trigger: TriggerType,
    props?: TransitionProps,
    options?: TransitionOptions<Context>
  ): TransitionResult<StateType, TriggerType, Context> {
    // Generate a pending transition result to track state transition history
    const pending = this.__createPendingTransitionResult();
    const attempts: TransitionAttempt<StateType, TriggerType, Context>[] = [];

    // Unpack and configure options for current transition
    const { onError, throwExceptions }: TransitionOptions<Context> =
      options ?? {};
    const shouldThrowException =
      throwExceptions ?? this.__options.throwExceptions;

    const transitions = normalizeArray(this.__instructions[trigger]);

    // If the transitions don't exist trigger key did not exist
    if (!transitions.length) {
      // Handle trigger undefined
      return this.__handleFailure(
        pending,
        {
          type: "TriggerUndefined",
          method: null,
          undefined: true,
          trigger,
          context: this.__getCurrentContext(),
        },
        `Trigger "${trigger}" is not defined in the machine.`,
        { shouldThrowException }
      );
    }

    // Get a set of all origins
    // We can do this before looping over so we do.
    const origins = this.__getOriginsFromTransitions(transitions);

    // If the transition picked does not have the current state listed in any origins
    if (!origins.includes(this.__getState())) {
      // Handle Origin Disallowed
      return this.__handleFailure(
        pending,
        {
          type: "OriginDisallowed",
          method: null,
          undefined: false,
          trigger,
          context: this.__getCurrentContext(),
        },
        `Invalid transition from ${this.__getState()} using trigger ${trigger}`,
        { shouldThrowException }
      );
    }

    // Set the pending.transitions = [] so that the result can include a list
    // since we know there are valid transitions
    pending.attempts = attempts;

    // Loop through all transitions
    transitionLoop: for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i];
      const nextTransition:
        | Transition<StateType, TriggerType, Context>
        | undefined = transitions?.[i + 1];

      const transitionAttempt: TransitionAttempt<
        StateType,
        TriggerType,
        Context
      > = {
        name: trigger,
        success: false,
        failure: null,
        conditions: [],
        effects: [],
        transition,
        context: this.__getCurrentContext(),
      };
      attempts.push(transitionAttempt);

      const effects = normalizeArray(transition.effects || []);
      const conditions = normalizeArray(transition.conditions || []);

      // Loop through all conditions
      for (let j = 0; j < conditions.length; j++) {
        const condition = conditions[j];
        const conditionFunction: Context[keyof Context] | undefined =
          this.__context[condition as keyof Context]; // As keyof Context is dangerous but we handle undefined errors

        // Create the Condition attempt
        const conditionAttempt: ConditionAttempt<Context> = {
          name: condition,
          success: false,
          context: this.__getCurrentContext(),
        };
        transitionAttempt.conditions.push(conditionAttempt);

        // Check if the method exists
        if (conditionFunction === undefined) {
          // Handle ConditionUndefined error
          const failure: TransitionFailure<TriggerType, Context> = {
            type: "ConditionUndefined",
            method: condition,
            undefined: true,
            trigger,
            context: this.__getCurrentContext(),
          };

          // TODO: Refactor this. The point of abstracting __handleFailure was to separate this.
          transitionAttempt.failure = failure;

          return this.__handleFailure(
            pending,
            failure,
            `Condition ${String(condition)} is not defined in the machine.`,
            { shouldThrowException }
          );
        }

        // Check if condition passes falsey
        // This abstraction is necessary to support the reactive version of this state machine
        if (
          !this.__options.conditionEvaluator(conditionFunction, this.__context)
        ) {
          const message = `Condition ${String(condition)} false. `;
          const failure: TransitionFailure<TriggerType, Context> = {
            type: "ConditionValue",
            method: condition,
            undefined: false,
            trigger,
            context: this.__getCurrentContext(),
          };
          // TODO: Refactor this. The point of abstracting __handleFailure was to separate this.
          transitionAttempt.failure = failure;

          // Don't fail on bad conditions if there is a possibility for a next transition to succeed
          if (nextTransition) {
            if (this.__options.verbose)
              console.info(message + " Skipping to next transition.");
            transitionAttempt.failure = failure;
            continue transitionLoop;
          } else {
            return this.__handleFailure(
              pending,
              failure,
              message + " Transition aborted.",
              {
                shouldThrowException,
              }
            );
          }
        }

        // Set the attempt to success once the checks have been made
        conditionAttempt.success = true;
      }

      // Loop through all effects
      for (let j = 0; j < effects.length; j++) {
        const effect = effects[j];
        const effectFunction: Context[keyof Context] | undefined =
          this.__context[effect as keyof Context]; // As keyof Context is dangerous but we handle undefined errors

        // Create the Effect attempt
        const effectAttempt: EffectAttempt<Context> = {
          name: effect,
          success: false,
          context: this.__getCurrentContext(),
        };
        transitionAttempt.effects.push(effectAttempt);

        // Check if the method is of type function
        if (typeof effectFunction !== "function") {
          const failure: TransitionFailure<TriggerType, Context> = {
            type: "EffectUndefined",
            method: effect,
            undefined: true,
            trigger,
            context: this.__getCurrentContext(),
          };

          // TODO: Refactor this. The point of abstracting __handleFailure was to separate this.
          transitionAttempt.failure = failure;

          return this.__handleFailure(
            pending,
            failure,
            `Effect ${String(effect)} is not defined in the machine.`,
            { shouldThrowException }
          );
        }

        try {
          transitionAttempt.failure = null;
          effectFunction.call(this.__context, props);
        } catch (e) {
          const failure: TransitionFailure<TriggerType, Context> = {
            type: "EffectError",
            method: effect,
            undefined: false,
            trigger,
            context: this.__getCurrentContext(),
          };

          // TODO: Refactor this. The point of abstracting __handleFailure was to separate this.
          transitionAttempt.failure = failure;

          const response = this.__handleFailure(
            pending,
            failure,
            `Effect ${String(effect)} caused an error.`,
            { shouldThrowException }
          );

          // TODO THIS WONT GET CALLED
          // Call onError
          // This can be some kind of rollback function that resets the state of your object
          // Otherwise effects may change the state of your objects
          if (onError) onError(response.precontext, response.context);

          return response;
        }

        effectAttempt.success = true;
      }

      // Change the state to the destination state
      this.__setState(transition.destination);

      transitionAttempt.success = true;

      break transitionLoop;
    }

    const result = this.__prepareTransitionResult(pending, {
      success: true,
      failure: null,
    });
    return result;
  }

  get potentialTransitions() {
    const potentialTransitions: AvailableTransition<
      StateType,
      TriggerType,
      Context
    >[] = [];
    const currentState = this.__getState();

    for (const [trigger, transitionList] of Object.entries(
      this.__instructions
    )) {
      const transitions = normalizeArray(transitionList) as Transition<
        StateType,
        TriggerType,
        Context
      >[];

      for (const transition of transitions) {
        const origins = normalizeArray(transition.origins);
        const conditions = normalizeArray(transition.conditions || []);
        const effects = normalizeArray(transition.effects || []);
        if (origins.includes(currentState)) {
          const conditionsDict = conditions.map((condition) => {
            let satisfied = false;

            try {
              const conditionFunction: Context[keyof Context] | undefined =
                this.__context[condition as keyof Context];

              if (conditionFunction === undefined) {
                throw new Error(
                  `Condition "${String(condition)}" is not defined.`
                );
              }

              satisfied = this.__options.conditionEvaluator(
                conditionFunction,
                this.__context
              );
            } catch (error) {
              console.error(
                `Error running condition "${String(condition)}": `,
                error
              );
            }

            return {
              name: condition,
              satisfied: satisfied,
            };
          });

          potentialTransitions.push({
            trigger: trigger as TriggerType,
            satisfied: conditionsDict.every(
              (conditionDict) => conditionDict.satisfied
            ),
            origins,
            destination: transition.destination,
            conditions: conditionsDict,
            effects,
          });
        }
      }
    }

    return potentialTransitions;
  }

  get validatedTransitions() {
    // Retrieve potential transitions
    const potentialTransitions = this.potentialTransitions;

    // Filter for validated transitions where all conditions are satisfied
    const validatedTransitions = potentialTransitions.filter(
      (transition) => transition.satisfied
    );

    return validatedTransitions;
  }
}

export function addStateMachine<
  StateType,
  TriggerType extends string,
  Context extends SimpleStateful<StateType>
>(
  context: Context,
  instructions:
    | TransitionInstructions<StateType, TriggerType, Context>
    | StateList<StateType>,
  options?: StateMachineOptions<
    StateType,
    Context,
    SimpleStateful<StateType>,
    "state"
  >
): Context &
  StateMachine<
    StateType,
    TriggerType,
    SimpleStateful<StateType>,
    "state",
    Context
  > {
  const internalOptions: StateMachineInternalOptions<
    StateType,
    Context,
    SimpleStateful<StateType>,
    "state"
  > = {
    key: "state",
    getState: defaultGetState,
    setState: defaultSetState,
    ...options,
  };

  const wrapper = new StateMachine(context, instructions, internalOptions);

  const proxy = new Proxy(
    context as Context &
      StateMachine<
        StateType,
        TriggerType,
        SimpleStateful<StateType>,
        "state",
        Context
      >,
    {
      get(target, prop, receiver) {
        if (prop in wrapper) {
          return Reflect.get(wrapper, prop, receiver);
        }
        return Reflect.get(target, prop, receiver);
      },
    }
  );

  return proxy;
}
