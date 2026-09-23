/**
 * mulberry32: состояние — одно число, значит партия воспроизводится из лога,
 * а тесты детерминированы. Функции чистые: возвращают новое состояние.
 */
import type { RngState } from './types.js';

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

export function nextFloat(rng: RngState): [number, RngState] {
  let a = (rng.s + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { s: a }];
}

export function nextInt(rng: RngState, maxExclusive: number): [number, RngState] {
  const [f, next] = nextFloat(rng);
  return [Math.floor(f * maxExclusive), next];
}

/** Тасование Фишера—Йетса. Исходный массив не трогаем. */
export function shuffle<T>(items: readonly T[], rng: RngState): [T[], RngState] {
  const out = items.slice();
  let r = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(r, i + 1);
    r = next;
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return [out, r];
}
