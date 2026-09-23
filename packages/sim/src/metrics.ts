/** Свод метрик из §11 спецификации плюс то, что реально измеримо сегодня. */
import { CHARMS, type CharmId } from '@razlom/core';
import type { GameObservation } from './play.js';

export interface Band { label: string; ok: boolean; note: string }

export interface Report {
  games: number;
  playerCount: number;
  policy: string;
  buyRate: number;
  score: { mean: number; sd: number; min: number; max: number; p10: number; p90: number; spread: number };
  overloadRate: [number, number, number];
  corruption: { mean: number; over4: number };
  firstBurn: { mean: number | null; noBurn: number };
  nodesExhausted: number;
  convergenceCorrelation: number | null;
  impliedCorruption: number;   // Скверна, вытекающая из наблюдённых перегрузок
  targetImpliedCorruption: number; // …и из целевых долей 10/25/45%
  seatWinRate: number[];
  seatSpread: number;
  charmBuyRate: Record<CharmId, number>;
  manaBurnedPerGame: number;
  bands: Band[];
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

function percentile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[i] as number;
}

/** Спирмен: Пирсон по рангам. */
function spearman(pairs: Array<[number, number]>): number | null {
  if (pairs.length < 2) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < pairs.length; i++) {
    const a = (xs[i] as number) - mx, b = (ys[i] as number) - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function aggregate(
  obs: GameObservation[], policy: string, buyRate: number,
): Report {
  const playerCount = obs[0]?.playerCount ?? 0;
  const allScores = obs.flatMap((o) => o.scores.map((s) => s.total));

  const overloadRate = [0, 1, 2].map((e) => {
    const over = obs.reduce((s, o) => s + (o.overloadsByEpoch[e] ?? 0), 0);
    const all = obs.reduce((s, o) => s + (o.contestsByEpoch[e] ?? 0), 0);
    return all > 0 ? over / all : 0;
  }) as [number, number, number];

  const corruptions = obs.flatMap((o) => o.corruptionBySeat);
  const burns = obs.map((o) => o.firstBurnRound).filter((x): x is number => x !== null);

  const corrPairs: Array<[number, number]> = [];
  for (const o of obs) {
    if (!o.convergenceIRankBySeat) continue;
    for (let seat = 0; seat < o.rankBySeat.length; seat++) {
      corrPairs.push([o.convergenceIRankBySeat[seat] as number, o.rankBySeat[seat] as number]);
    }
  }

  const seatWins = new Array(playerCount).fill(0);
  for (const o of obs) {
    o.rankBySeat.forEach((rank, seat) => { if (rank === 1) seatWins[seat] += 1; });
  }
  const seatWinRate = seatWins.map((w) => w / Math.max(1, obs.length));

  const charmBuyRate: Record<CharmId, number> = {};
  for (const c of CHARMS) {
    const games = obs.filter((o) => (o.charmBuys[c.id] ?? 0) > 0).length;
    charmBuyRate[c.id] = games / Math.max(1, obs.length);
  }

  const roundsPerEpoch = Math.max(1, Math.round(mean(obs.map((o) => o.rounds)) / 3));
  const implied = roundsPerEpoch * (overloadRate[0] + overloadRate[1] + overloadRate[2]);
  const targetImplied = roundsPerEpoch * (0.10 + 0.25 + 0.45);
  const spread = Math.max(...seatWinRate) - Math.min(...seatWinRate);
  const corr = spearman(corrPairs);
  const corrMean = mean(corruptions);
  const scoreSd = sd(allScores);

  const bands: Band[] = [
    { label: 'Разброс очков', ok: scoreSd >= 6,
      note: `σ = ${scoreSd.toFixed(1)}; если схлопнется к нулю — решения ни на что не влияют` },
    { label: 'Перегрузки I ≈ 10%', ok: Math.abs(overloadRate[0] - 0.10) <= 0.07, note: `${(overloadRate[0] * 100).toFixed(1)}%` },
    { label: 'Перегрузки II ≈ 25%', ok: Math.abs(overloadRate[1] - 0.25) <= 0.10, note: `${(overloadRate[1] * 100).toFixed(1)}%` },
    { label: 'Перегрузки III ≈ 45%', ok: Math.abs(overloadRate[2] - 0.45) <= 0.12, note: `${(overloadRate[2] * 100).toFixed(1)}%` },
    { label: 'Скверна на финиш 1,5–2,5', ok: corrMean >= 1.5 && corrMean <= 2.5, note: corrMean.toFixed(2) },
    { label: 'Схождение I не решает партию', ok: corr === null || corr < 0.7,
      note: corr === null ? 'нет данных' : corr.toFixed(2) },
    { label: 'Нет перекоса по местам за столом', ok: spread <= 0.08,
      note: `разброс винрейта ${(spread * 100).toFixed(1)} п.п.` },
  ];

  return {
    games: obs.length, playerCount, policy, buyRate,
    score: {
      mean: mean(allScores), sd: scoreSd,
      min: Math.min(...allScores), max: Math.max(...allScores),
      p10: percentile(allScores, 0.10), p90: percentile(allScores, 0.90),
      spread: percentile(allScores, 0.90) - percentile(allScores, 0.10),
    },
    overloadRate,
    corruption: { mean: corrMean, over4: corruptions.filter((c) => c > 4).length / Math.max(1, corruptions.length) },
    firstBurn: { mean: burns.length ? mean(burns) : null, noBurn: 1 - burns.length / Math.max(1, obs.length) },
    nodesExhausted: obs.filter((o) => o.endedByNodesExhausted).length / Math.max(1, obs.length),
    convergenceCorrelation: corr,
    impliedCorruption: implied, targetImpliedCorruption: targetImplied,
    seatWinRate, seatSpread: spread,
    charmBuyRate,
    manaBurnedPerGame: mean(obs.map((o) => o.manaBurned)),
    bands,
  };
}
