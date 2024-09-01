import { TransitionError } from "./errors";
import type {
  ConditionAttempt,
  EffectAttempt,
  TransitionInstructions,
  StateMachineOptions,
  Transition,
  TransitionAttempt,
  TransitionFailure,
  TransitionOptions,
  TransitionProps,
  TransitionResult,
  StateList,
  PendingTransitionResult,
  AvailableTransition,
  StateMachineConfig,
  StateMachineInternalOptions,
} from "./types";
import { normalizeArray } from "./utils";

interface SimpleStateful<State> {
  state: State;
}

function defaultContextCopier<Context>(context: Context): Context {
  return JSON.parse(JSON.stringify(context));
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
  Context extends SimpleStateful<State>,
  State,
  K extends keyof SimpleStateful<State>
>(context: Context, key: K): State {
  return context[key];
}

function defaultSetState<
  Context extends SimpleStateful<State>,
  State,
  K extends keyof SimpleStateful<State>
>(context: Context, state: State, key: K) {
  context[key] = state;
}

const noop = () => {};

function createTriggerKeys<State, Trigger extends string>(
  states: StateList<State>
): Trigger[] {
  return states.map((state) => `to_${state}` as Trigger);
}

export class StateMachine<
  Context extends Stateful,
  State,
  Trigger extends string,
  Stateful,
  K extends keyof Stateful
> {
  states: StateList<State>;
  history: TransitionResult<Context, State, Trigger>[];

  private ___context: Context; // Maybe expose this as .value?
  private ___cache: Context | null;
  private ___instructions: TransitionInstructions<Context, State, Trigger>;
  private ___options: StateMachineConfig<Context, State, Trigger, Stateful, K>;

  constructor(
    context: Context,
    instructions:
      | TransitionInstructions<Context, State, Trigger>
      | StateList<State>,
    options: StateMachineInternalOptions<Context, State, Trigger, Stateful, K>
  ) {
    const {
      key,
      verbose = false,
      throwExceptions = true,
      strictOrigins = false,
      conditionEvaluator = defaultConditionEvaluator,
      contextCopier = defaultContextCopier,
      getState,
      setState,
      onTransition = noop,
      onBeforeTransition = noop,
    } = options ?? {};

    this.___context = context;
    this.history = [];
    if (Array.isArray(instructions)) {
      this.states = instructions;
      this.___instructions =
        this.___generateTransitionInstructions(instructions);
    } else {
      this.states = this.___getStatesFromTransitionInstructions(instructions);
      this.___instructions = instructions;
    }
    this.___cache = null;
    this.___options = {
      key,
      verbose,
      throwExceptions,
      strictOrigins,
      conditionEvaluator,
      contextCopier,
      getState,
      setState,
      onTransition,
      onBeforeTransition,
    };
  }

  private ___getState(): State {
    const state: State = this.___options.getState(
      this.___context,
      this.___options.key
    );
    if (!state) throw new Error("Current state is undefined");
    return state;
  }

  private ___setState(state: State) {
    const oldState = this.___getState();
    this.___options.onBeforeTransition(state, oldState, this.___context, this);
    this.___options.setState(this.___context, state, this.___options.key);
    const newState = this.___getState();
    if (this.___options.verbose) console.info(`State changed to ${newState}`);
    this.___options.onTransition(newState, oldState, this.___context, this);
  }

  private ___getStatesFromTransitionInstructions(
    dict: TransitionInstructions<Context, State, Trigger>
  ): StateList<State> {
    const states = new Set<State>();
    const transitions = Object.values<
      | Transition<Context, State, Trigger>
      | Transition<Context, State, Trigger>[]
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

  private ___generateTransitionInstructions(
    states: StateList<State>
  ): TransitionInstructions<Context, State, Trigger> {
    const instructions: Partial<
      Record<Trigger, Transition<Context, State, Trigger>>
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

    return instructions as TransitionInstructions<Context, State, Trigger>;
  }

  private ___getCurrentContext(): Context {
    // TODO: Benchmark
    // const deepCopy: Context = structuredClone(this.___context);

    const deepCopy = this.___options.contextCopier(this.___context);
    // this.cache = deepCopy;
    return deepCopy;
  }

  private ___createPendingTransitionResult(): PendingTransitionResult<
    Context,
    State,
    Trigger
  > {
    const context = this.___getCurrentContext();
    return {
      success: null,
      failure: null,
      initial: this.___getState(),
      current: null,
      attempts: null,
      precontext: context,
      context: null,
    };
  }

  private ___prepareTransitionResult(
    pending: PendingTransitionResult<Context, State, Trigger>,
    {
      success,
      failure,
    }: {
      success: boolean;
      failure: TransitionFailure<Context, State, Trigger> | null;
    }
  ): TransitionResult<Context, State, Trigger> {
    const result: TransitionResult<Context, State, Trigger> = {
      ...pending,
      success,
      failure,
      context: failure?.context ?? this.___getCurrentContext(),
      current: this.___getState(),
      attempts: pending.attempts ?? [], // change this to null if there wasnt a matching transition?
    };
    return result;
  }

  private ___handleFailure(
    pending: PendingTransitionResult<Context, State, Trigger>,
    failure: TransitionFailure<Context, State, Trigger>,
    message: string,
    {
      shouldThrowException,
    }: {
      shouldThrowException: boolean;
    }
  ): TransitionResult<Context, State, Trigger> {
    const result = this.___prepareTransitionResult(pending, {
      success: false,
      failure,
    });

    if (shouldThrowException)
      throw new TransitionError({
        name: failure.type,
        message,
        result: result,
      });
    if (this.___options.verbose) console.info(message);

    return result;
  }

  private ___getOriginsFromTransitions(
    transitions: Transition<Context, State, Trigger>[]
  ) {
    return Array.from(
      transitions.reduce(
        (acc: Set<State>, curr: Transition<Context, State, Trigger>) => {
          normalizeArray(curr.origins).forEach((item) => acc.add(item));
          return acc;
        },
        new Set()
      )
    );
  }

  to(state: State) {
    if (!this.states.includes(state)) {
      const message = `Destination ${state} is not included in the list of existing states`;
      throw new TransitionError({
        name: "DestinationInvalid",
        message,
        result: null,
      });
    }
    this.___setState(state);
  }

  triggerWithOptions(
    trigger: Trigger,
    props: TransitionProps,
    options: TransitionOptions<Context>
  ): TransitionResult<Context, State, Trigger>;
  triggerWithOptions(
    trigger: Trigger,
    options: TransitionOptions<Context>
  ): TransitionResult<Context, State, Trigger>;

  triggerWithOptions(
    trigger: Trigger,
    secondParameter?: TransitionProps | TransitionOptions<Context>,
    thirdParameter?: TransitionOptions<Context>
  ): TransitionResult<Context, State, Trigger> {
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
    trigger: Trigger,
    props?: TransitionProps,
    options?: TransitionOptions<Context>
  ): TransitionResult<Context, State, Trigger> {
    // Generate a pending transition result to track state transition history
    const pending = this.___createPendingTransitionResult();
    const attempts: TransitionAttempt<Context, State, Trigger>[] = [];

    // Unpack and configure options for current transition
    const { onError, throwExceptions }: TransitionOptions<Context> =
      options ?? {};
    const shouldThrowException =
      throwExceptions ?? this.___options.throwExceptions;

    const transitions = normalizeArray(this.___instructions[trigger]);

    // If the transitions don't exist trigger key did not exist
    if (!transitions.length) {
      // Handle trigger undefined
      return this.___handleFailure(
        pending,
        {
          type: "TriggerUndefined",
          method: null,
          undefined: true,
          trigger,
          context: this.___getCurrentContext(),
        },
        `Trigger "${trigger}" is not defined in the machine.`,
        { shouldThrowException }
      );
    }

    // Get a set of all origins
    // We can do this before looping over so we do.
    const origins = this.___getOriginsFromTransitions(transitions);

    // If the transition picked does not have the current state listed in any origins
    if (!origins.includes(this.___getState())) {
      // Handle Origin Disallowed
      return this.___handleFailure(
        pending,
        {
          type: "OriginDisallowed",
          method: null,
          undefined: false,
          trigger,
          context: this.___getCurrentContext(),
        },
        `Invalid transition from ${this.___getState()} using trigger ${trigger}`,
        { shouldThrowException }
      );
    }

    // Set the pending.transitions = [] so that the result can include a list
    // since we know there are valid transitions
    pending.attempts = attempts;

    // Loop through all transitions
    transitionLoop: for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i];
      const nextTransition: Transition<Context, State, Trigger> | undefined =
        transitions?.[i + 1];

      const transitionAttempt: TransitionAttempt<Context, State, Trigger> = {
        name: trigger,
        success: false,
        failure: null,
        conditions: [],
        effects: [],
        transition,
        context: this.___getCurrentContext(),
      };
      attempts.push(transitionAttempt);

      const effects = normalizeArray(transition.effects || []);
      const conditions = normalizeArray(transition.conditions || []);

      // Loop through all conditions
      for (let j = 0; j < conditions.length; j++) {
        const condition = conditions[j];
        const conditionFunction: Context[keyof Context] | undefined =
          this.___context[condition as keyof Context]; // As keyof Context is dangerous but we handle undefined errors

        // Create the Condition attempt
        const conditionAttempt: ConditionAttempt<Context> = {
          name: condition,
          success: false,
          context: this.___getCurrentContext(),
        };
        transitionAttempt.conditions.push(conditionAttempt);

        // Check if the method exists
        if (conditionFunction === undefined) {
          // Handle ConditionUndefined error
          const failure: TransitionFailure<Context, State, Trigger> = {
            type: "ConditionUndefined",
            method: condition,
            undefined: true,
            trigger,
            context: this.___getCurrentContext(),
          };

          // TODO: Refactor this. The point of abstracting ___handleFailure was to separate this.
          transitionAttempt.failure = failure;

          return this.___handleFailure(
            pending,
            failure,
            `Condition ${String(condition)} is not defined in the machine.`,
            { shouldThrowException }
          );
        }

        // Check if condition passes falsey
        // This abstraction is necessary to support the reactive version of this state machine
        if (
          !this.___options.conditionEvaluator(
            conditionFunction,
            this.___context
          )
        ) {
          const message = `Condition ${String(condition)} false. `;
          const failure: TransitionFailure<Context, State, Trigger> = {
            type: "ConditionValue",
            method: condition,
            undefined: false,
            trigger,
            context: this.___getCurrentContext(),
          };
          // TODO: Refactor this. The point of abstracting ___handleFailure was to separate this.
          transitionAttempt.failure = failure;

          // Don't fail on bad conditions if there is a possibility for a next transition to succeed
          if (nextTransition) {
            if (this.___options.verbose)
              console.info(message + " Skipping to next transition.");
            transitionAttempt.failure = failure;
            continue transitionLoop;
          } else {
            return this.___handleFailure(
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
          this.___context[effect as keyof Context]; // As keyof Context is dangerous but we handle undefined errors

        // Create the Effect attempt
        const effectAttempt: EffectAttempt<Context> = {
          name: effect,
          success: false,
          context: this.___getCurrentContext(),
        };
        transitionAttempt.effects.push(effectAttempt);

        // Check if the method is of type function
        if (typeof effectFunction !== "function") {
          const failure: TransitionFailure<Context, State, Trigger> = {
            type: "EffectUndefined",
            method: effect,
            undefined: true,
            trigger,
            context: this.___getCurrentContext(),
          };

          // TODO: Refactor this. The point of abstracting ___handleFailure was to separate this.
          transitionAttempt.failure = failure;

          return this.___handleFailure(
            pending,
            failure,
            `Effect ${String(effect)} is not defined in the machine.`,
            { shouldThrowException }
          );
        }

        try {
          transitionAttempt.failure = null;
          effectFunction.call(this.___context, props);
        } catch (e) {
          const failure: TransitionFailure<Context, State, Trigger> = {
            type: "EffectError",
            method: effect,
            undefined: false,
            trigger,
            context: this.___getCurrentContext(),
          };

          // TODO: Refactor this. The point of abstracting ___handleFailure was to separate this.
          transitionAttempt.failure = failure;

          const response = this.___handleFailure(
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
      this.___setState(transition.destination);

      transitionAttempt.success = true;

      break transitionLoop;
    }

    const result = this.___prepareTransitionResult(pending, {
      success: true,
      failure: null,
    });
    return result;
  }

  get potentialTransitions() {
    const potentialTransitions: AvailableTransition<Context, State, Trigger>[] =
      [];
    const currentState = this.___getState();

    for (const [trigger, transitionList] of Object.entries(
      this.___instructions
    )) {
      const transitions = normalizeArray(transitionList) as Transition<
        Context,
        State,
        Trigger
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
                this.___context[condition as keyof Context];

              if (conditionFunction === undefined) {
                throw new Error(
                  `Condition "${String(condition)}" is not defined.`
                );
              }

              satisfied = this.___options.conditionEvaluator(
                conditionFunction,
                this.___context
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
            trigger: trigger as Trigger,
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

export function machine<
  Context extends SimpleStateful<State>,
  State,
  Trigger extends string
>(
  context: Context,
  instructions:
    | TransitionInstructions<Context, State, Trigger>
    | StateList<State>,
  options?: StateMachineOptions<
    Context,
    State,
    Trigger,
    SimpleStateful<State>,
    "state"
  >
): Context &
  StateMachine<Context, State, Trigger, SimpleStateful<State>, "state"> {
  const internalOptions: StateMachineInternalOptions<
    Context,
    State,
    Trigger,
    SimpleStateful<State>,
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
      StateMachine<Context, State, Trigger, SimpleStateful<State>, "state">,
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
