import { describe, expect, it } from 'vitest';
import {
  colorsInPlay, computeThreshold, dealArchmages, nodesAtEpoch, thresholdDivisor,
} from '../src/setup.js';
import { createRng } from '../src/rng.js';
import type { Epoch } from '../src/types.js';

describe('Порог', () => {
  // «Базовые значения без модификатора» из §5 правил
  const SPEC: Record<number, [number, number, number]> = {
    2: [8, 4, 3], 3: [11, 6, 5], 4: [10, 6, 5], 5: [13, 8, 6],
    6: [15, 7, 5], 7: [18, 8, 6], 8: [20, 10, 7],
  };

  it('воспроизводит все 21 значение из таблицы правил', () => {
    for (const [n, row] of Object.entries(SPEC)) {
      for (const e of [1, 2, 3] as Epoch[]) {
        expect(computeThreshold(Number(n), e), `${n} игроков, эпоха ${e}`)
          .toBe(row[e - 1]);
      }
    }
  });

  it('округляет половину вверх — банковское округление сломало бы пять клеток', () => {
    // 2/I = 7.5, 5/I = 12.5, 5/II = 7.5, 3/III = 4.5, 4/III = 4.5
    expect(computeThreshold(2, 1)).toBe(8);
    expect(computeThreshold(5, 1)).toBe(13);
    expect(computeThreshold(5, 2)).toBe(8);
    expect(computeThreshold(3, 3)).toBe(5);
    expect(computeThreshold(4, 3)).toBe(5);
  });

  it('не опускается ниже трёх', () => {
    expect(computeThreshold(2, 3, -2)).toBe(3);
  });

  it('K не уменьшается от выгорания: делитель берётся из таблицы эпохи', () => {
    expect(thresholdDivisor(6, 1)).toBe(3);
    expect(thresholdDivisor(6, 2)).toBe(5);
    expect(thresholdDivisor(6, 3)).toBe(5);
  });
});

describe('масштабирование', () => {
  it('раскладывает узлы по эпохам согласно §3', () => {
    expect(nodesAtEpoch(2, 1)).toEqual(['fire', 'water']);
    expect(nodesAtEpoch(2, 2)).toEqual(['fire', 'water', 'earth']);
    expect(nodesAtEpoch(4, 1)).toEqual(['fire', 'water', 'earth']);
    expect(nodesAtEpoch(4, 2)).toEqual(['fire', 'water', 'earth', 'air']);
    // на 6–8 обе стихии входят разом во II эпоху — иначе Порог не сходится
    expect(nodesAtEpoch(6, 2)).toEqual(['fire', 'water', 'earth', 'air', 'void']);
    expect(nodesAtEpoch(6, 3)).toEqual(['fire', 'water', 'earth', 'air', 'void']);
  });

  it('цветов в игре столько же, сколько узлов за партию', () => {
    expect(colorsInPlay(2)).toHaveLength(3);   // «полный набор — три цвета, а не пять»
    expect(colorsInPlay(4)).toHaveLength(4);
    expect(colorsInPlay(6)).toHaveLength(5);
  });
});

describe('драфт Архимагов', () => {
  it('не раздаёт Владыку Пустоты, пока Пустоты нет на поле', () => {
    const [hands] = dealArchmages(5, createRng(1));
    expect(hands.flat()).not.toContain('voidlord');
  });

  it('на шестерых Владыка Пустоты попадает в пул', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const [hands] = dealArchmages(6, createRng(seed));
      hands.flat().forEach((a) => seen.add(a));
    }
    expect(seen.has('voidlord')).toBe(true);
  });

  it('каждому по три карты', () => {
    const [hands] = dealArchmages(6, createRng(7));
    expect(hands).toHaveLength(6);
    hands.forEach((h) => expect(h).toHaveLength(3));
  });
});
