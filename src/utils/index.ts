export function normalizeArray<U>(value: U | U[]): U[] {
  return Array.isArray(value) ? value : [value];
}

export function replaceUndefined<T>(value: T | undefined, defaultValue: T): T {
  return value === undefined ? defaultValue : value;
}
