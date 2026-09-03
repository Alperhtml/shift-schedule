/** Index helpers for `noUncheckedIndexedAccess`. `at` throws on a hole, which is a bug. */

export function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`index ${i} out of range (length ${arr.length})`);
  return v;
}

export function get(arr: readonly number[], i: number): number {
  return arr[i] ?? 0;
}

export function inc(arr: number[], i: number, delta: number): void {
  arr[i] = (arr[i] ?? 0) + delta;
}
