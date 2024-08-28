export type ErrorName =
  | "TransitionsUndefined"
  | "ConditionValue"
  | "ConditionUndefined"
  | "TriggerUndefined"
  | "EffectError"
  | "EffectUndefined"
  | "OriginDisallowed"
  | "DestinationInvalid";

type Effect<T> = keyof T; // Ensures only methods of T can be used as effects
type Condition<T> = keyof T; // Ensures only methods of T can be used as conditions

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

export type TransitionDict<StateType, TriggerType extends string, T> = {
  [K in TriggerType]:
    | Transition<StateType, TriggerType, T>
    | Transition<StateType, TriggerType, T>[];
};
export type StateList<StateType> = StateType[];

export interface Stateful<StateType> {
  state: StateType;
}

export type StateMachineOptions = {
  verbosity?: boolean;
  throwExceptions?: boolean;
  strictOrigins?: boolean;
  conditionEvaluator?: <T>(conditionFunction: any, context: T) => boolean;
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
