export type ErrorName =
  | "ConditionValue"
  | "ConditionUndefined"
  | "TriggerUndefined"
  | "EffectError"
  | "EffectUndefined"
  | "OriginDisallowed"
  | "DestinationInvalid";

// Key of T ensures only methods of T can be used as effects
// This req was dropped in 0.0.10 in order to allow the flexibility of simple examples
// Transition failures from typeguards and exceptions will be how we handle string types
type Effect<T> = keyof T | string;
type Condition<T> = keyof T | string;

export const isFunction = (obj: unknown): obj is CallableFunction =>
  obj instanceof Function;

export type Transition<StateType, TriggerType extends string, T> = {
  origins: StateType | StateType[];
  destination: StateType;
  conditions?: Condition<T> | Condition<T>[];
  effects?: Effect<T> | Effect<T>[];
};

export type ConditionAttempt<T> = {
  name: Condition<T>;
  success: boolean;
  context: T | null;
};

export type EffectAttempt<T> = {
  name: Effect<T>;
  success: boolean;
  context: T | null;
};

export type TransitionAttempt<StateType, TriggerType extends string, T> = {
  name: TriggerType;
  success: boolean;
  failure: TransitionFailure<TriggerType, T> | null;
  conditions: ConditionAttempt<T>[];
  effects: EffectAttempt<T>[];
  transition: Transition<StateType, TriggerType, T>;
  context: T | null;
};

export type TransitionFailure<TriggerType extends string, T> = {
  type: ErrorName;
  undefined: boolean;
  trigger: TriggerType | null;
  method: Condition<T> | Effect<T> | null;
  context: T | null;
};

export type PendingTransitionResult<
  StateType,
  TriggerType extends string,
  T
> = {
  success: boolean | null; // Whether the Transition was successful or not
  failure: TransitionFailure<TriggerType, T> | null;
  initial: StateType;
  current: StateType | null;
  attempts: TransitionAttempt<StateType, TriggerType, T>[] | null;
  precontext: T;
  context: T | null;
};

export type TransitionResult<StateType, TriggerType extends string, T> = {
  success: boolean; // Whether the Transition was successful or not
  failure: TransitionFailure<TriggerType, T> | null;
  initial: StateType;
  current: StateType;
  attempts: TransitionAttempt<StateType, TriggerType, T>[];
  precontext: T;
  context: T;
};

export type TransitionInstructions<StateType, TriggerType extends string, T> = {
  [K in TriggerType]:
    | Transition<StateType, TriggerType, T>
    | Transition<StateType, TriggerType, T>[];
};
export type StateList<StateType> = StateType[];



export type StateMachineInternalOptions<StateType, T, U, K extends keyof U> = {
  key: K;
  verbose?: boolean;
  throwExceptions?: boolean;
  strictOrigins?: boolean;
  conditionEvaluator?: (conditionFunction: any, context: T) => boolean;
  getState: <T extends U>(context: T, key: keyof U) => StateType;
  setState: <T extends U>(context: T, state: StateType, key: keyof U) => void;
  onBeforeTransition?: (
    plannedState: StateType,
    state: StateType,
    context: T
  ) => void;
  onTransition?: (state: StateType, oldState: StateType, context: T) => void;
};

export type StateMachineOptions<StateType, T, U, K extends keyof U> = {
  verbose?: boolean;
  throwExceptions?: boolean;
  strictOrigins?: boolean;
  conditionEvaluator?: (conditionFunction: any, context: T) => boolean;
  onBeforeTransition?: (
    plannedState: StateType,
    state: StateType,
    context: T
  ) => void;
  onTransition?: (state: StateType, oldState: StateType, context: T) => void;
};

export type StateMachineConfig<StateType, T, U, K extends keyof U> = {
  key: K;
  verbose: boolean;
  throwExceptions: boolean;
  strictOrigins: boolean;
  conditionEvaluator: (conditionFunction: any, context: T) => boolean;
  getState: <T extends U>(context: T, key: keyof U) => StateType;
  setState: <T extends U>(context: T, state: StateType, key: keyof U) => void;
  onBeforeTransition: (
    plannedState: StateType,
    state: StateType,
    context: T
  ) => void;
  onTransition: (state: StateType, oldState: StateType, context: T) => void;
};

export type TransitionOptions<T> = {
  onError?: (context: T, precontext: T) => void;
  throwExceptions?: boolean;
};

export type TransitionProps = {};

export type AvailableTransition<StateType, TriggerType extends string, T> = {
  trigger: TriggerType;
  origins: StateType[];
  destination: StateType;
  satisfied: boolean;
  conditions: {
    name: Condition<T>;
    satisfied: boolean;
  }[];
  effects: Effect<T>[];
};
