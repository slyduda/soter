import { TransitionError } from "./errors";
import { InstructionMap } from "./instructions";
import type {
  ConditionAttempt,
  EffectAttempt,
  InstructionDict,
  StateMachineOptions,
  InstructionRecord,
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
  ConsolidatedOptions,
} from "./types";
import { normalizeArray, replaceUndefined } from "./utils";

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

export class StateMachine<
  Context extends Stateful,
  State,
  Trigger extends string,
  Stateful,
  K extends keyof Stateful
> {
  // A list of all TransitionResults
  history: PendingTransitionResult<State, Trigger, Context>[];

  private ___context: Context; // Maybe expose this as .value?
  private ___instructions: InstructionMap<State, Trigger, Context>;
  private ___config: StateMachineConfig<Context, State, Trigger, Stateful, K>;

  constructor(
    context: Context,
    instructions:
      | InstructionMap<State, Trigger, Context>
      | InstructionDict<State, Trigger, Context>
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
      onPrepare = noop,
      onBefore = noop,
      onAfter = noop,
      onException = noop,
      onReset = noop,
      instructionScope = "global",
    } = options ?? {};

    this.history = [];
    this.___context = context;
    if (Array.isArray(instructions)) {
      this.___instructions = new InstructionMap(instructions);
    } else if ("___global" in instructions) {
      // If the instructions passed are specified as local Instructions meaning a deep copy and not the ref
      if (instructionScope === "local") {
        this.___instructions = new InstructionMap(instructions, false);
      } else {
        this.___instructions = instructions;
      }
    } else {
      this.___instructions = new InstructionMap(instructions);
    }
    this.___config = {
      key,
      verbose,
      throwExceptions,
      strictOrigins,
      conditionEvaluator,
      contextCopier,
      getState,
      setState,
      onPrepare,
      onBefore,
      onAfter,
      onException,
      onReset,
    };
  }

  private ___getState(): State {
    const { getState } = this.___config;

    const state: State = getState(this.___context, this.___config.key);
    if (!state) throw new Error("Current state is undefined");
    return state;
  }

  private ___setState(
    state: State,
    onBefore?: (
      plannedState: State,
      state: State,
      context: Context,
      self: StateMachine<any, State, string, Stateful, K>
    ) => void,
    onAfter?: (
      state: State,
      oldState: State,
      context: Context,
      self: StateMachine<any, State, string, Stateful, K>
    ) => void
  ) {
    const { setState, verbose } = this.___config;

    // Get the state before the transition
    const oldState = this.___getState();

    if (onBefore) onBefore(state, oldState, this.___context, this);
    setState(this.___context, state, this.___config.key);

    // Get the state after the transition
    const newState = this.___getState();

    if (verbose) console.info(`State changed to ${newState}`);
    if (onAfter) onAfter(newState, oldState, this.___context, this);
  }

  private ___getCurrentContext(): Context {
    // TODO: Benchmark and Cache
    const { contextCopier } = this.___config;
    const deepCopy = contextCopier(this.___context);
    return deepCopy;
  }

  private ___createPendingTransitionResult(): PendingTransitionResult<
    State,
    Trigger,
    Context
  > {
    const context = this.___getCurrentContext();
    const result = {
      success: null,
      failure: null,
      initial: this.___getState(),
      current: null,
      attempts: null,
      precontext: context,
      context: null,
    };
    this.history.push(result);
    return result;
  }

  private ___prepareTransitionResult(
    pending: PendingTransitionResult<State, Trigger, Context>,
    {
      success,
      failure,
    }: {
      success: boolean;
      failure: TransitionFailure<State, Trigger, Context> | null;
    }
  ): TransitionResult<State, Trigger, Context> {
    const result: TransitionResult<State, Trigger, Context> = {
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
    pending: PendingTransitionResult<State, Trigger, Context>,
    failure: TransitionFailure<State, Trigger, Context>,
    message: string,
    {
      throwExceptions,
    }: {
      throwExceptions: boolean;
    }
  ): TransitionResult<State, Trigger, Context> {
    const result = this.___prepareTransitionResult(pending, {
      success: false,
      failure,
    });

    if (throwExceptions)
      throw new TransitionError({
        name: failure.type,
        message,
        result: result,
      });
    if (this.___config.verbose) console.info(message);

    return result;
  }

  private ___getOriginsFromTransitions(
    transitions: InstructionRecord<State, Trigger, Context>[]
  ) {
    return Array.from(
      transitions.reduce(
        (acc: Set<State>, curr: InstructionRecord<State, Trigger, Context>) => {
          normalizeArray(curr.origins).forEach((item) => acc.add(item));
          return acc;
        },
        new Set()
      )
    );
  }

  private ___createTransitionLifecycleCallback(
    key: (keyof Context | (string & {})) | (keyof Context | (string & {}))[]
  ): (() => void) | undefined {
    const funcs: Context[keyof Context][] = normalizeArray(key).map(
      (k) => this.___context[k as keyof Context]
    );
    return funcs.filter((fn) => typeof fn === "function").length
      ? () => {
          for (const func of funcs) {
            if (typeof func !== "function") continue;
            func.call(this.___context);
          }
        }
      : undefined;
  }

  private ___getOptions(
    machineOptions: StateMachineConfig<Context, State, Trigger, Stateful, K>,
    triggerOptions?: TransitionOptions<Context, State, Trigger, Stateful, K>,
    transitionOptions?: InstructionRecord<State, Trigger, Context>
  ): ConsolidatedOptions<Context, State, Trigger, Stateful, K> {
    const onPrepare =
      replaceUndefined(
        replaceUndefined(
          triggerOptions?.onPrepare,
          this.___createTransitionLifecycleCallback(
            transitionOptions?.onPrepare ?? []
          )
        ),
        machineOptions.onPrepare
      ) ?? noop;

    const onBefore =
      replaceUndefined(
        replaceUndefined(
          triggerOptions?.onBefore,
          this.___createTransitionLifecycleCallback(
            transitionOptions?.onBefore ?? []
          )
        ),
        machineOptions.onBefore
      ) ?? noop;

    const onAfter =
      replaceUndefined(
        replaceUndefined(
          triggerOptions?.onAfter,
          this.___createTransitionLifecycleCallback(
            transitionOptions?.onAfter ?? []
          )
        ),
        machineOptions.onAfter
      ) ?? noop;

    const onException =
      replaceUndefined(
        replaceUndefined(
          triggerOptions?.onException,
          this.___createTransitionLifecycleCallback(
            transitionOptions?.onException ?? []
          )
        ),
        machineOptions.onException
      ) ?? noop;

    const throwExceptions = replaceUndefined(
      triggerOptions?.throwExceptions,
      machineOptions.throwExceptions
    );

    return {
      throwExceptions,
      onPrepare,
      onBefore,
      onAfter,
      onException,
    };
  }

  get states(): StateList<State> {
    return this.___instructions.states;
  }

  get transitions(): InstructionDict<State, Trigger, Context> {
    return this.___instructions.transitions;
  }

  addTransition(
    trigger: string,
    transition:
      | InstructionRecord<State, Trigger, Context>
      | InstructionRecord<State, Trigger, Context>[],
    index?: number
  ): StateMachine<Context, State, Trigger, Stateful, K> {
    this.___instructions.addTransition(trigger, transition, index);
    return this;
  }

  to(
    state: State,
    options?: TransitionOptions<Context, State, Trigger, Stateful, K>
  ) {
    const { onPrepare, onBefore, onAfter, onException, throwExceptions } =
      this.___getOptions(this.___config, options);

    if (!this.states.includes(state)) {
      const message = `Destination ${state} is not included in the list of existing states`;
      if (throwExceptions)
        throw new TransitionError({
          name: "DestinationInvalid",
          message,
          result: null,
        });
      return;
    }

    onPrepare(state, this.___getState(), this.___context, this);
    const precontext = this.___getCurrentContext();
    try {
      this.___setState(state, onBefore, onAfter);
    } catch (e) {
      if (throwExceptions)
        onException(
          state,
          this.___getState(),
          precontext,
          this.___getCurrentContext(),
          this
        );
    }
  }

  triggerWithOptions(
    trigger: Trigger,
    props: TransitionProps,
    options: TransitionOptions<Context, State, Trigger, Stateful, K>
  ): TransitionResult<State, Trigger, Context>;
  triggerWithOptions(
    trigger: Trigger,
    options: TransitionOptions<Context, State, Trigger, Stateful, K>
  ): TransitionResult<State, Trigger, Context>;

  triggerWithOptions(
    trigger: Trigger,
    secondParameter?:
      | TransitionProps
      | TransitionOptions<Context, State, Trigger, Stateful, K>,
    thirdParameter?: TransitionOptions<Context, State, Trigger, Stateful, K>
  ): TransitionResult<State, Trigger, Context> {
    let passedProps: TransitionProps | undefined = undefined;
    let passedOptions:
      | TransitionOptions<Context, State, Trigger, Stateful, K>
      | undefined = undefined;

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
    options?: TransitionOptions<Context, State, Trigger, Stateful, K>
  ): TransitionResult<State, Trigger, Context> {
    // Generate a pending transition result to track state transition history
    const pending = this.___createPendingTransitionResult();
    const attempts: TransitionAttempt<State, Trigger, Context>[] = [];

    // Unpack and configure options for current transition
    const { throwExceptions, onException } = this.___getOptions(
      this.___config,
      options
    );

    const transitions = normalizeArray(this.___instructions.get(trigger) ?? []);

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
        { throwExceptions }
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
        { throwExceptions }
      );
    }

    // Set the pending.transitions = [] so that the result can include a list
    // since we know there are valid transitions
    pending.attempts = attempts;

    // Loop through all transitions
    transitionLoop: for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i];

      const {
        onPrepare,
        onBefore,
        onAfter,
        onException: onLocalException,
      } = this.___getOptions(this.___config, options, transition);

      const nextTransition:
        | InstructionRecord<State, Trigger, Context>
        | undefined = transitions?.[i + 1];

      const transitionAttempt: TransitionAttempt<State, Trigger, Context> = {
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

      if (onPrepare)
        onPrepare(
          transition.destination,
          this.___getState(),
          this.___context,
          this
        );

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
          const failure: TransitionFailure<State, Trigger, Context> = {
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
            { throwExceptions }
          );
        }

        // Check if condition passes falsey
        // This abstraction is necessary to support the reactive version of this state machine
        if (
          !this.___config.conditionEvaluator(conditionFunction, this.___context)
        ) {
          const message = `Condition ${String(condition)} false. `;
          const failure: TransitionFailure<State, Trigger, Context> = {
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
            if (this.___config.verbose)
              console.info(message + " Skipping to next transition.");
            transitionAttempt.failure = failure;
            continue transitionLoop;
          } else {
            return this.___handleFailure(
              pending,
              failure,
              message + " InstructionRecord aborted.",
              {
                throwExceptions,
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
          const failure: TransitionFailure<State, Trigger, Context> = {
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
            { throwExceptions }
          );
        }

        try {
          transitionAttempt.failure = null;
          effectFunction.call(this.___context, props);
        } catch (e) {
          const failure: TransitionFailure<State, Trigger, Context> = {
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
            { throwExceptions }
          );

          onLocalException(
            transition.destination,
            this.___getState(),
            response.precontext,
            response.context,
            this
          );

          return response;
        }

        effectAttempt.success = true;
      }

      // Change the state to the destination state
      try {
        this.___setState(transition.destination, onBefore, onAfter);
      } catch (e) {
        onLocalException(
          transition.destination,
          this.___getState(),
          pending.precontext,
          this.___getCurrentContext(),
          this
        );
      }

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
    const potentialTransitions: AvailableTransition<State, Trigger, Context>[] =
      [];
    const currentState = this.___getState();

    for (const [trigger, transitionList] of this.___instructions) {
      const transitions = normalizeArray(transitionList) as InstructionRecord<
        State,
        Trigger,
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
                this.___context[condition as keyof Context];

              if (conditionFunction === undefined) {
                throw new Error(
                  `Condition "${String(condition)}" is not defined.`
                );
              }

              satisfied = this.___config.conditionEvaluator(
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

  clear(): PendingTransitionResult<State, Trigger, Context>[] {
    const history = this.history.slice();
    this.history.length = 0;
    return history;
  }
}

export function soter<
  Context extends SimpleStateful<State>,
  State,
  Trigger extends string
>(
  context: Context,
  instructions:
    | InstructionMap<State, Trigger, Context>
    | InstructionDict<State, Trigger, Context>
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
