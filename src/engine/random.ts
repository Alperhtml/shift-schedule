export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
}

/** mulberry32: small, fast, deterministic. The seed is reduced to uint32. */
export function createRng(seed: number): Rng {
  let a = Math.floor(Math.abs(seed)) >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => Math.floor(next() * n);
  const pick = <T>(arr: readonly T[]): T => {
    const v = arr[int(arr.length)];
    if (v === undefined) throw new Error('pick from an empty array');
    return v;
  };
  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = int(i + 1);
      const x = arr[i];
      const y = arr[j];
      if (x === undefined || y === undefined) continue;
      arr[i] = y;
      arr[j] = x;
    }
    return arr;
  };
  return { next, int, pick, shuffle };
}
