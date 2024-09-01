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

export type Transition<Context, StateType, TriggerType extends string> = {
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
  Context,
  StateType,
  TriggerType extends string
> = {
  name: TriggerType;
  success: boolean;
  failure: TransitionFailure<Context, TriggerType> | null;
  conditions: ConditionAttempt<Context>[];
  effects: EffectAttempt<Context>[];
  transition: Transition<Context, StateType, TriggerType>;
  context: Context | null;
};

export type TransitionFailure<Context, TriggerType extends string> = {
  type: ErrorName;
  undefined: boolean;
  trigger: TriggerType | null;
  method: Condition<Context> | Effect<Context> | null;
  context: Context | null;
};

export type PendingTransitionResult<
  Context,
  StateType,
  TriggerType extends string
> = {
  success: boolean | null; // Whether the Transition was successful or not
  failure: TransitionFailure<Context, TriggerType> | null;
  initial: StateType;
  current: StateType | null;
  attempts: TransitionAttempt<Context, StateType, TriggerType>[] | null;
  precontext: Context;
  context: Context | null;
};

export type TransitionResult<Context, StateType, TriggerType extends string> = {
  success: boolean; // Whether the Transition was successful or not
  failure: TransitionFailure<Context, TriggerType> | null;
  initial: StateType;
  current: StateType;
  attempts: TransitionAttempt<Context, StateType, TriggerType>[];
  precontext: Context;
  context: Context;
};

export type TransitionInstructions<
  Context,
  StateType,
  TriggerType extends string
> = {
  [K in TriggerType]:
    | Transition<Context, StateType, TriggerType>
    | Transition<Context, StateType, TriggerType>[];
};
export type StateList<StateType> = StateType[];

export type StateMachineOptions<
  Context,
  StateType,
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
    self: StateMachine<any, StateType, string, Stateful, K>
  ) => void;
  onTransition?: (
    state: StateType,
    oldState: StateType,
    context: Context,
    self: StateMachine<any, StateType, string, Stateful, K>
  ) => void;
};

export type StateMachineInternalOptions<
  Context,
  StateType,
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
    self: StateMachine<any, StateType, string, Stateful, K>
  ) => void;
  onTransition?: (
    state: StateType,
    oldState: StateType,
    context: Context,
    self: StateMachine<any, StateType, string, Stateful, K>
  ) => void;
};

export type StateMachineConfig<
  Context,
  StateType,
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
    self: StateMachine<any, StateType, string, Stateful, K>
  ) => void;
  onTransition: (
    state: StateType,
    oldState: StateType,
    context: Context,
    self: StateMachine<any, StateType, string, Stateful, K>
  ) => void;
};

export type TransitionOptions<Context> = {
  onError?: (context: Context, precontext: Context) => void;
  throwExceptions?: boolean;
};

export type TransitionProps = {};

export type AvailableTransition<
  Context,
  StateType,
  TriggerType extends string
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
