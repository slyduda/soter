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

export type Transition<StateType, TriggerType extends string, Context> = {
  origins: StateType | StateType[];
  destination: StateType;
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

export type TransitionAttempt<
  StateType,
  TriggerType extends string,
  Context
> = {
  name: TriggerType;
  success: boolean;
  failure: TransitionFailure<TriggerType, Context> | null;
  conditions: ConditionAttempt<Context>[];
  effects: EffectAttempt<Context>[];
  transition: Transition<StateType, TriggerType, Context>;
  context: Context | null;
};

export type TransitionFailure<TriggerType extends string, Context> = {
  type: ErrorName;
  undefined: boolean;
  trigger: TriggerType | null;
  method: Condition<Context> | Effect<Context> | null;
  context: Context | null;
};

export type PendingTransitionResult<
  StateType,
  TriggerType extends string,
  Context
> = {
  success: boolean | null; // Whether the Transition was successful or not
  failure: TransitionFailure<TriggerType, Context> | null;
  initial: StateType;
  current: StateType | null;
  attempts: TransitionAttempt<StateType, TriggerType, Context>[] | null;
  precontext: Context;
  context: Context | null;
};

export type TransitionResult<StateType, TriggerType extends string, Context> = {
  success: boolean; // Whether the Transition was successful or not
  failure: TransitionFailure<TriggerType, Context> | null;
  initial: StateType;
  current: StateType;
  attempts: TransitionAttempt<StateType, TriggerType, Context>[];
  precontext: Context;
  context: Context;
};

export type TransitionInstructions<
  StateType,
  TriggerType extends string,
  Context
> = {
  [K in TriggerType]:
    | Transition<StateType, TriggerType, Context>
    | Transition<StateType, TriggerType, Context>[];
};
export type StateList<StateType> = StateType[];

export type StateMachineInternalOptions<
  StateType,
  Context,
  Stateful,
  K extends keyof Stateful
> = {
  key: K;
  verbose?: boolean;
  throwExceptions?: boolean;
  strictOrigins?: boolean;
  conditionEvaluator?: (conditionFunction: any, context: Context) => boolean;
  getState: <Context extends Stateful>(
    context: Context,
    key: keyof Stateful
  ) => StateType;
  setState: <Context extends Stateful>(
    context: Context,
    state: StateType,
    key: keyof Stateful
  ) => void;
  onBeforeTransition?: (
    plannedState: StateType,
    state: StateType,
    context: Context,
    self: StateMachine<StateType, string, Stateful, K, any>
  ) => void;
  onTransition?: (
    state: StateType,
    oldState: StateType,
    context: Context,
    self: StateMachine<StateType, string, Stateful, K, any>
  ) => void;
};

export type StateMachineOptions<
  StateType,
  Context,
  Stateful,
  K extends keyof Stateful
> = {
  verbose?: boolean;
  throwExceptions?: boolean;
  strictOrigins?: boolean;
  conditionEvaluator?: (conditionFunction: any, context: Context) => boolean;
  onBeforeTransition?: (
    plannedState: StateType,
    state: StateType,
    context: Context,
    self: StateMachine<StateType, string, Stateful, K, any>
  ) => void;
  onTransition?: (
    state: StateType,
    oldState: StateType,
    context: Context,
    self: StateMachine<StateType, string, Stateful, K, any>
  ) => void;
};

export type StateMachineConfig<
  StateType,
  Context,
  Stateful,
  K extends keyof Stateful
> = {
  key: K;
  verbose: boolean;
  throwExceptions: boolean;
  strictOrigins: boolean;
  conditionEvaluator: (conditionFunction: any, context: Context) => boolean;
  getState: <Context extends Stateful>(
    context: Context,
    key: keyof Stateful
  ) => StateType;
  setState: <Context extends Stateful>(
    context: Context,
    state: StateType,
    key: keyof Stateful
  ) => void;
  onBeforeTransition: (
    plannedState: StateType,
    state: StateType,
    context: Context,
    self: StateMachine<StateType, string, Stateful, K, any>
  ) => void;
  onTransition: (
    state: StateType,
    oldState: StateType,
    context: Context,
    self: StateMachine<StateType, string, Stateful, K, any>
  ) => void;
};

export type TransitionOptions<Context> = {
  onError?: (context: Context, precontext: Context) => void;
  throwExceptions?: boolean;
};

export type TransitionProps = {};

export type AvailableTransition<
  StateType,
  TriggerType extends string,
  Context
> = {
  trigger: TriggerType;
  origins: StateType[];
  destination: StateType;
  satisfied: boolean;
  conditions: {
    name: Condition<Context>;
    satisfied: boolean;
  }[];
  effects: Effect<Context>[];
};
