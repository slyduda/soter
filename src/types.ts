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
// Transition failures from typeguards and exceptions will be how we handle string types
type Effect<Context> = keyof Context | string;
type Condition<Context> = keyof Context | string;

export const isFunction = (obj: unknown): obj is CallableFunction =>
  obj instanceof Function;

export type Transition<Context, State, Trigger> = {
  origins: State | State[];
  destination: State;
  conditions?: Condition<Context> | Condition<Context>[];
  effects?: Effect<Context> | Effect<Context>[];
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

export type TransitionAttempt<Context, State, Trigger> = {
  name: Trigger;
  success: boolean;
  failure: TransitionFailure<Context, State, Trigger> | null;
  conditions: ConditionAttempt<Context>[];
  effects: EffectAttempt<Context>[];
  transition: Transition<Context, State, Trigger>;
  context: Context | null;
};

export type TransitionFailure<Context, State, Trigger> = {
  type: ErrorName;
  undefined: boolean;
  trigger: Trigger | null;
  method: Condition<Context> | Effect<Context> | null;
  context: Context | null;
};

export type PendingTransitionResult<Context, State, Trigger> = {
  success: boolean | null; // Whether the Transition was successful or not
  failure: TransitionFailure<Context, State, Trigger> | null;
  initial: State;
  current: State | null;
  attempts: TransitionAttempt<Context, State, Trigger>[] | null;
  precontext: Context;
  context: Context | null;
};

export type TransitionResult<Context, State, Trigger> = {
  success: boolean; // Whether the Transition was successful or not
  failure: TransitionFailure<Context, State, Trigger> | null;
  initial: State;
  current: State;
  attempts: TransitionAttempt<Context, State, Trigger>[];
  precontext: Context;
  context: Context;
};

export type TransitionInstructions<Context, State, Trigger extends string> = {
  [K in Trigger]:
    | Transition<Context, State, Trigger>
    | Transition<Context, State, Trigger>[];
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
  conditionEvaluator?: (conditionFunction: any, context: Context) => boolean;
  onBeforeTransition?: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onTransition?: (
    state: State,
    oldState: State,
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
  onBeforeTransition?: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onTransition?: (
    state: State,
    oldState: State,
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
  onBeforeTransition: (
    plannedState: State,
    state: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
  onTransition: (
    state: State,
    oldState: State,
    context: Context,
    self: StateMachine<any, State, string, Stateful, K>
  ) => void;
};

export type TransitionOptions<Context> = {
  onError?: (context: Context, precontext: Context) => void;
  throwExceptions?: boolean;
};

export type TransitionProps = {};

export type AvailableTransition<Context, State, Trigger> = {
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
