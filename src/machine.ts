import { TransitionError } from "./errors";
import {
  type ConditionAttempt,
  type EffectAttempt,
  type TransitionDict,
  type Stateful,
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
} from "./types";
import { normalizeArray } from "./utils";

function evaluateCondition<T>(conditionFunction: any, context: T): boolean {
  if (typeof conditionFunction === "function") {
    return conditionFunction.call(context);
  } else {
    return Boolean(conditionFunction);
  }
}

class StateMachineWrapper<
  StateType,
  TriggerType extends string,
  T extends Stateful<StateType>
> {
  private context: T;
  private cache: T | null;
  private transitions: TransitionDict<StateType, TriggerType, T> | null;
  private conditionEvaluator: <T>(
    conditionFunction: any,
    context: T
  ) => boolean;
  private states: StateList<StateType>;
  private verbosity: boolean;
  private throwExceptions: boolean;
  private strictOrigins: boolean;

  constructor(
    context: T,
    blueprint: TransitionDict<StateType, TriggerType, T> | StateList<StateType>,
    options?: StateMachineOptions
  ) {
    const {
      verbosity = false,
      throwExceptions = true,
      strictOrigins = false,
      conditionEvaluator = evaluateCondition,
    } = options ?? {};

    this.conditionEvaluator = evaluateCondition;
    this.context = context;
    if (Array.isArray(blueprint)) {
      this.states = blueprint;
      this.transitions = null;
    } else {
      this.states = this.getStatesFromTransitionDict(blueprint);
      this.transitions = blueprint;
    }
    this.state = context.state; // Directly set the state from context
    this.cache = null;
    this.verbosity = verbosity;
    this.throwExceptions = throwExceptions;
    this.strictOrigins = strictOrigins; // Whether a called trigger will fail if state is not in origin
  }

  get state(): StateType {
    return this.context.state;
  }

  set state(state: StateType) {
    this.context.state = state;
  }

  private getStatesFromTransitionDict(
    dict: TransitionDict<StateType, TriggerType, T>
  ): StateList<StateType> {
    const states = new Set<StateType>();
    const transitions = Object.values<
      | Transition<StateType, TriggerType, T>
      | Transition<StateType, TriggerType, T>[]
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

  private deepCopyContext(): T {
    // TODO: Benchmark
    // const deepCopy: T = structuredClone(this.context);
    const deepCopy: T = JSON.parse(JSON.stringify(this.context));
    // this.cache = deepCopy;
    return deepCopy;
  }

  private createPendingTransitionResult(): PendingTransitionResult<
    StateType,
    TriggerType,
    T
  > {
    const context = this.deepCopyContext();
    return {
      success: null,
      failure: null,
      initial: this.context.state,
      current: null,
      attempts: null,
      precontext: context,
      context: null,
    };
  }

  private prepareTransitionResult(
    pending: PendingTransitionResult<StateType, TriggerType, T>,
    {
      success,
      failure,
    }: {
      success: boolean;
      failure: TransitionFailure<TriggerType, T> | null;
    }
  ): TransitionResult<StateType, TriggerType, T> {
    const result: TransitionResult<StateType, TriggerType, T> = {
      ...pending,
      success,
      failure,
      context: failure?.context ?? this.deepCopyContext(),
      current: this.state,
      attempts: pending.attempts ?? [], // change this to null if there wasnt a matching transition?
    };
    return result;
  }

  private handleFailure(
    pending: PendingTransitionResult<StateType, TriggerType, T>,
    failure: TransitionFailure<TriggerType, T>,
    message: string,
    {
      shouldThrowException,
    }: {
      shouldThrowException: boolean;
    }
  ): TransitionResult<StateType, TriggerType, T> {
    const result = this.prepareTransitionResult(pending, {
      success: false,
      failure,
    });

    if (shouldThrowException)
      throw new TransitionError({
        name: failure.type,
        message,
        result: result,
      });
    if (this.verbosity) console.info(message);

    return result;
  }

  private getOriginsFromTransitions(
    transitions: Transition<StateType, TriggerType, T>[]
  ) {
    return Array.from(
      transitions.reduce(
        (acc: Set<StateType>, curr: Transition<StateType, TriggerType, T>) => {
          normalizeArray(curr.origins).forEach((item) => acc.add(item));
          return acc;
        },
        new Set()
      )
    );
  }

  to(state: StateType) {
    if (!this.states.includes(state)) {
      const message = `Destination ${state} is not included in the list of existing states`;
      throw new TransitionError({
        name: "DestinationInvalid",
        message,
        result: null,
      });
    }
    this.state = state;
  }

  triggerWithOptions(
    trigger: TriggerType,
    props: TransitionProps,
    options: TransitionOptions<T>
  ): TransitionResult<StateType, TriggerType, T>;
  triggerWithOptions(
    trigger: TriggerType,
    options: TransitionOptions<T>
  ): TransitionResult<StateType, TriggerType, T>;

  triggerWithOptions(
    trigger: TriggerType,
    secondParameter?: TransitionProps | TransitionOptions<T>,
    thirdParameter?: TransitionOptions<T>
  ): TransitionResult<StateType, TriggerType, T> {
    let passedProps: TransitionProps | undefined = undefined;
    let passedOptions: TransitionOptions<T> | undefined = undefined;

    if (thirdParameter !== undefined) {
      passedProps = secondParameter;
      passedOptions = thirdParameter;
    } else {
      // Cast sinve we know it will be Trigger Options
      passedOptions = secondParameter;
    }

    const options = passedOptions ?? {};
    const props = passedProps ?? {};

    return this.trigger(trigger, props, options);
  }

  trigger(
    trigger: TriggerType,
    props?: TransitionProps,
    options?: TransitionOptions<T>
  ): TransitionResult<StateType, TriggerType, T> {
    // Generate a pending transition result to track state transition history
    const pending = this.createPendingTransitionResult();
    const attempts: TransitionAttempt<StateType, TriggerType, T>[] = [];

    // Unpack and configure options for current transition
    const { onError, throwExceptions }: TransitionOptions<T> = options ?? {};
    const shouldThrowException = throwExceptions ?? this.throwExceptions;

    // This can happen if a StateList was supplied
    // TODO: Make StateList generate simple transitions to all from all
    if (!this.transitions) {
      // Handle transitions undefined
      return this.handleFailure(
        pending,
        {
          type: "TransitionsUndefined",
          method: null,
          undefined: true,
          trigger,
          context: this.deepCopyContext(),
        },
        `trigger("${trigger}") called, but machine does not have transitions defined.`,
        { shouldThrowException }
      );
    }

    const transitions = normalizeArray(this.transitions[trigger]);

    // If the transitions don't exist trigger key did not exist
    if (!transitions.length) {
      // Handle trigger undefined
      return this.handleFailure(
        pending,
        {
          type: "TriggerUndefined",
          method: null,
          undefined: true,
          trigger,
          context: this.deepCopyContext(),
        },
        `Trigger "${trigger}" is not defined in the machine.`,
        { shouldThrowException }
      );
    }

    // Get a set of all origins
    // We can do this before looping over so we do.
    const origins = this.getOriginsFromTransitions(transitions);

    // If the transition picked does not have the current state listed in any origins
    if (!origins.includes(this.state)) {
      // Handle Origin Disallowed
      return this.handleFailure(
        pending,
        {
          type: "OriginDisallowed",
          method: null,
          undefined: false,
          trigger,
          context: this.deepCopyContext(),
        },
        `Invalid transition from ${this.state} using trigger ${trigger}`,
        { shouldThrowException }
      );
    }

    // Set the pending.transitions = [] so that the result can include a list
    // since we know there are valid transitions
    pending.attempts = attempts;

    // Loop through all transitions
    transitionLoop: for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i];
      const nextTransition: Transition<StateType, TriggerType, T> | undefined =
        transitions?.[i + 1];

      const transitionAttempt: TransitionAttempt<StateType, TriggerType, T> = {
        name: trigger,
        success: false,
        failure: null,
        conditions: [],
        effects: [],
        transition,
        context: this.deepCopyContext(),
      };
      attempts.push(transitionAttempt);

      const effects = normalizeArray(transition.effects || []);
      const conditions = normalizeArray(transition.conditions || []);

      // Loop through all conditions
      for (let j = 0; j < conditions.length; j++) {
        const condition = conditions[j];
        const conditionFunction = this.context[condition];

        // Create the Condition attempt
        const conditionAttempt: ConditionAttempt<T> = {
          name: condition,
          success: false,
          context: this.deepCopyContext(),
        };
        transitionAttempt.conditions.push(conditionAttempt);

        // Check if the method is of type function
        if (conditionFunction === undefined) {
          // Handle ConditionUndefined error
          const failure: TransitionFailure<TriggerType, T> = {
            type: "ConditionUndefined",
            method: condition,
            undefined: true,
            trigger,
            context: this.deepCopyContext(),
          };

          // TODO: Refactor this. The point of abstracting handlefailure was to separate this.
          transitionAttempt.failure = failure;

          return this.handleFailure(
            pending,
            failure,
            `Condition ${String(condition)} is not defined in the machine.`,
            { shouldThrowException }
          );
        }

        // Check if condition passes falsey
        // This abstraction is necessary to support the reactive version of this state machine
        if (!this.conditionEvaluator(conditionFunction, this.context)) {
          const message = `Condition ${String(
            condition
          )} false, transition aborted.`;
          const failure: TransitionFailure<TriggerType, T> = {
            type: "ConditionValue",
            method: condition,
            undefined: false,
            trigger,
            context: this.deepCopyContext(),
          };
          // TODO: Refactor this. The point of abstracting handlefailure was to separate this.
          transitionAttempt.failure = failure;

          // Don't fail on bad conditions if there is a possibility for a next transition to succeed
          if (nextTransition) {
            if (this.verbosity) console.info(message);
            transitionAttempt.failure = failure;
            continue transitionLoop;
          } else {
            return this.handleFailure(pending, failure, message, {
              shouldThrowException,
            });
          }
        }

        // Set the attempt to success once the checks have been made
        conditionAttempt.success = true;
      }

      // Loop through all effects
      for (let j = 0; j < effects.length; j++) {
        const effect = effects[j];
        const effectFunction = this.context[effect];

        // Create the Effect attempt
        const effectAttempt: EffectAttempt<T> = {
          name: effect,
          success: false,
          context: this.deepCopyContext(),
        };
        transitionAttempt.effects.push(effectAttempt);

        // Check if the method is of type function
        if (typeof effectFunction !== "function") {
          const failure: TransitionFailure<TriggerType, T> = {
            type: "EffectUndefined",
            method: effect,
            undefined: true,
            trigger,
            context: this.deepCopyContext(),
          };

          // TODO: Refactor this. The point of abstracting handlefailure was to separate this.
          transitionAttempt.failure = failure;

          return this.handleFailure(
            pending,
            failure,
            `Effect ${String(effect)} is not defined in the machine.`,
            { shouldThrowException }
          );
        }

        try {
          transitionAttempt.failure = null;
          effectFunction.call(this.context, props);
        } catch (e) {
          const failure: TransitionFailure<TriggerType, T> = {
            type: "EffectError",
            method: effect,
            undefined: false,
            trigger,
            context: this.deepCopyContext(),
          };

          // TODO: Refactor this. The point of abstracting handlefailure was to separate this.
          transitionAttempt.failure = failure;

          const response = this.handleFailure(
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
      this.state = transition.destination;
      if (this.verbosity) console.info(`State changed to ${this.state}`);

      transitionAttempt.success = true;

      break transitionLoop;
    }

    const result = this.prepareTransitionResult(pending, {
      success: true,
      failure: null,
    });
    return result;
  }

  getAvailableTransitions() {
    if (!this.state) {
      throw new Error("Current state is undefined");
    }

    if (!this.transitions) {
      throw new Error("No transitions defined in the state machine");
    }

    const availableTransitions: AvailableTransition<
      StateType,
      TriggerType,
      T
    >[] = [];
    const currentState = this.state;

    for (const [trigger, transitionList] of Object.entries(this.transitions)) {
      const transitions = normalizeArray(transitionList) as Transition<
        StateType,
        TriggerType,
        T
      >[];

      for (const transition of transitions) {
        const origins = normalizeArray(transition.origins);
        const conditions = normalizeArray(transition.conditions || []);
        const effects = normalizeArray(transition.effects || []);
        if (origins.includes(currentState)) {
          const conditionsDict = conditions.map((condition) => {
            let satisfied = false;

            try {
              const conditionFunction = this.context?.[condition];

              if (typeof conditionFunction === "function") {
                satisfied = conditionFunction.call(this.context);
              } else {
                throw new Error(
                  `Condition "${String(condition)}" is not a function.`
                );
              }
            } catch (error) {
              console.error(
                `Error running condition "${String(condition)}":`,
                error
              );
            }

            return {
              name: condition,
              satisfied: satisfied,
            };
          });

          availableTransitions.push({
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

    return availableTransitions;
  }
}

export function addStateMachine<
  StateType extends string,
  TriggerType extends string,
  T extends Stateful<StateType>
>(
  context: T,
  blueprint: TransitionDict<StateType, TriggerType, T> | StateList<StateType>,
  options?: StateMachineOptions
): T & StateMachineWrapper<StateType, TriggerType, T> {
  const wrapper = new StateMachineWrapper(context, blueprint, options);

  const proxy = new Proxy(
    context as T & StateMachineWrapper<StateType, TriggerType, T>,
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