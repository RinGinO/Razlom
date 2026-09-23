import { describe, expect, it } from 'vitest';
import { createRng } from '@razlom/core';
import { heuristicPolicy, randomPolicy, policyByName } from '../src/policy.js';
import { playGame } from '../src/play.js';
import { aggregate } from '../src/metrics.js';

describe('политика-агент', () => {
  it('никогда не выкладывает больше, чем есть у игрока', () => {
    for (const name of ['random', 'heuristic']) {
      const policy = policyByName(name, 0.25);
      for (let seed = 0; seed < 40; seed++) {
        const obs = playGame(6, 6, policy, seed);
        expect(obs.rounds).toBeGreaterThan(0);   // ядро отвергло бы невалидную ставку
      }
    }
  });

  it('эвристика всегда делает ход — пас в этой игре строго хуже', () => {
    const policy = heuristicPolicy(0);
    for (let seed = 0; seed < 30; seed++) {
      const obs = playGame(6, 6, policy, seed);
      const contests = obs.contestsByEpoch.reduce((a, b) => a + b, 0);
      expect(contests).toBeGreaterThan(0);
    }
  });

  it('прогон детерминирован по посеву', () => {
    const a = playGame(6, 6, heuristicPolicy(0.25), 777);
    const b = playGame(6, 6, heuristicPolicy(0.25), 777);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('случайная политика тоже доигрывает партию до конца', () => {
    const obs = playGame(4, 4, randomPolicy(0.2), 5);
    expect(obs.scores).toHaveLength(4);
  });
});

describe('свод метрик', () => {
  const obs = Array.from({ length: 60 }, (_, i) => playGame(6, 6, heuristicPolicy(0), i));
  const report = aggregate(obs, 'heuristic', 0);

  it('доли перегрузок лежат между нулём и единицей', () => {
    for (const rate of report.overloadRate) {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it('винрейты по местам за столом суммируются в единицу', () => {
    const sum = report.seatWinRate.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('давление растёт от эпохи к эпохе — так задумано правилами', () => {
    expect(report.overloadRate[2]).toBeGreaterThan(report.overloadRate[0]);
  });

  it('корреляция Схождения I с финалом лежит в допустимом диапазоне', () => {
    if (report.convergenceCorrelation !== null) {
      expect(report.convergenceCorrelation).toBeGreaterThanOrEqual(-1);
      expect(report.convergenceCorrelation).toBeLessThanOrEqual(1);
    }
  });

  it('целевые доли перегрузок сами дают вдвое больше Скверны, чем целевая Скверна', () => {
    // 6 × (0,10 + 0,25 + 0,45) = 4,8 жетона против цели 1,5–2,5
    expect(report.targetImpliedCorruption).toBeGreaterThan(2.5 * 1.5);
  });
});
