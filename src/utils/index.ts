export function normalizeArray<U>(value: U | U[]): U[] {
  return Array.isArray(value) ? value : [value];
}

