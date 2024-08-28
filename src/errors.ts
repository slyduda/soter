import { ErrorName } from "./types";

class ErrorBase<T extends string> extends Error {
  name: T;
  message: string;
  result: any | null;

  constructor({
    name,
    message,
    result,
  }: {
    name: T;
    message: string;
    result: any | null;
  }) {
    super();
    this.name = name;
    this.message = name + ": " + message;
    this.result = result;
  }
}

export class TransitionError extends ErrorBase<ErrorName> {}
