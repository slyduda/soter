import { StateMachine } from "./machine";

export type ErrorName =
  | "ConditionValue"
  | "ConditionUndefined"
  | "TriggerUndefined"
  | "EffectError"
  | "EffectUndefined"
  | "OriginDisallowed"
  | "DestinationInvalid";

// Key of Context ensures only methods of Context can be used as effects
// This req was dropped in 0.0.10 in order to allow the flexibility of simple examples
// InstructionRecord failures from typeguards and exceptions will be how we handle string types
type Effect<Context> = keyof Context | (string & {});
type Condition<Context> = keyof Context | (string & {});
type Prepare<Context> = keyof Context | (string & {});
type Before<Context> = keyof Context | (string & {});
type After<Context> = keyof Context | (string & {});
type Exception<Context> = keyof Context | (string & {});

export const isFunction = (obj: unknown): obj is CallableFunction =>
  obj instanceof Function;

// If changing the functionality of the Instruction Record:
// Make sure that the InstructionMap initializer handles deep copying correctly
// Example: If changing anything to () => void, a better deep copy must be made
export type InstructionRecord<State, Trigger = string, Context = {}> = {
  origins: State | State[];
  destination: State;
  conditions?: Condition<Context> | Condition<Context>[];
  effects?: Effect<Context> | Effect<Context>[];
  onPrepare?: Prepare<Context> | Prepare<Context>[];
  onBefore?: Before<Context> | Before<Context>[];
  onAfter?: After<Context> | After<Context>[];
  onException?: Exception<Context> | Exception<Context>[];
};
export type InstructionDict<
  State,
  Trigger extends string = string,
  Context = {}
> = {
  [K in Trigger]:
    | InstructionRecord<State, Trigger, Context>
    | InstructionRecord<State, Trigger, Context>[];
};

export type ConditionAttempt<Context> = {
  name: Condition<Context>;
  success: boolean;
  context: Context | null;
};

export type EffectAttempt<Context> = {
  name: Effect<Context>;
  success: boolean;
  context: Context | null;
};

export type TransitionAttempt<State, Trigger, Context> = {
  name: Trigger;
  success: boolean;
  failure: TransitionFailure<State, Trigger, Context> | null;
  conditions: ConditionAttempt<Context>[];
  effects: EffectAttempt<Context>[];
  transition: InstructionRecord<State, Trigger, Context>;
  context: Context | null;
};

export type TransitionFailure<State, Trigger, Context> = {
  type: ErrorName;
  undefined: boolean;
  trigger: Trigger | null;
  method: Condition<Context> | Effect<Context> | null;
  context: Context | null;
};

export type PendingTransitionResult<State, Trigger, Context> = {
  success: boolean | null; // Whether the InstructionRecord was successful or not
  failure: TransitionFailure<State, Trigger, Context> | null;
  initial: State;
  current: State | null;
  attempts: TransitionAttempt<State, Trigger, Context>[] | null;
  precontext: Context;
  context: Context | null;
};

export type TransitionResult<State, Trigger, Context> = {
  success: boolean; // Whether the InstructionRecord was successful or not
  failure: TransitionFailure<State, Trigger, Context> | null;
  initial: State;
  current: State;
  attempts: TransitionAttempt<State, Trigger, Context>[];
  precontext: Context;
  context: Context;
};

export type StateList<State> = State[];

export type StateMachineOptions<
  Context,
  State,
  Trigger,
  Stateful,
  K extends keyof Stateful
> = {
  verbose?: boolean;
  throwExceptions?: boolean;
  strictOrigins?: boolean;
  instructionScope?: "global" | "local";
  conditionEvaluator?: (conditionFunction: any, context: Context) => boolean;
  onPrepare?: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onBefore?: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onAfter?: (
    state: State,
    oldState: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onException?: (
    attemptedState: State,
    state: State,
    precontext: Context,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onReset?: (
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
};

export type StateMachineInternalOptions<
  Context,
  State,
  Trigger,
  Stateful,
  K extends keyof Stateful
> = {
  key: K;
  verbose?: boolean;
  throwExceptions?: boolean;
  strictOrigins?: boolean;
  instructionScope?: "global" | "local";
  conditionEvaluator?: (conditionFunction: any, context: Context) => boolean;
  contextCopier?: (context: Context) => Context | any;
  getState: <Context extends Stateful>(
    context: Context,
    key: keyof Stateful
  ) => State;
  setState: <Context extends Stateful>(
    context: Context,
    state: State,
    key: keyof Stateful
  ) => void;
  onPrepare?: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onBefore?: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onAfter?: (
    state: State,
    oldState: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onException?: (
    attemptedState: State,
    state: State,
    precontext: Context,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onReset?: (
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
};

export type StateMachineConfig<
  Context,
  State,
  Trigger,
  Stateful,
  K extends keyof Stateful
> = {
  key: K;
  verbose: boolean;
  throwExceptions: boolean;
  strictOrigins: boolean;
  conditionEvaluator: (conditionFunction: any, context: Context) => boolean;
  contextCopier: (context: Context) => Context | any;
  getState: <Context extends Stateful>(
    context: Context,
    key: keyof Stateful
  ) => State;
  setState: <Context extends Stateful>(
    context: Context,
    state: State,
    key: keyof Stateful
  ) => void;
  onPrepare: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onBefore: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onAfter: (
    state: State,
    oldState: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onException: (
    attemptedState: State,
    state: State,
    precontext: Context,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onReset: (
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
};

export type TransitionOptions<
  Context,
  State,
  Trigger,
  Stateful,
  K extends keyof Stateful
> = {
  onPrepare?:
    | ((
        plannedState: State,
        state: State,
        context: Context,
        self: StateMachine<any, State, string, Stateful, K>
      ) => void)
    | null;
  onBefore?:
    | ((
        plannedState: State,
        state: State,
        context: Context,
        self: StateMachine<any, State, string, Stateful, K>
      ) => void)
    | null;
  onAfter?:
    | ((
        state: State,
        oldState: State,
        context: Context,
        self: StateMachine<any, State, string, Stateful, K>
      ) => void)
    | null;
  onException?:
    | ((
        attemptedState: State,
        state: State,
        precontext: Context,
        context: Context,
        self: StateMachine<any, State, string, Stateful, K>
      ) => void)
    | null;
  throwExceptions?: boolean;
};

export type ConsolidatedOptions<
  Context,
  State,
  Trigger,
  Stateful,
  K extends keyof Stateful
> = {
  throwExceptions: boolean;
  onPrepare: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onBefore: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onAfter: (
    state: State,
    oldState: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onException: (
    attemptedState: State,
    state: State,
    precontext: Context,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
};

export type TransitionProps = {};

export type AvailableTransition<State, Trigger, Context> = {
  trigger: Trigger;
  origins: State[];
  destination: State;
  satisfied: boolean;
  conditions: {
    name: Condition<Context>;
    satisfied: boolean;
  }[];
  effects: Effect<Context>[];
};
