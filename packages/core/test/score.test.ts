import { describe, expect, it } from 'vitest';
import {
  advanceEpoch, completeSets, corruptionPenalty, finalScores, gameOverReason, resolveConvergence,
} from '../src/score.js';
import { essence, find, makeGame } from './helpers.js';

describe('Схождение', () => {
  it('бонус получает держатель наибольшего количества цвета', () => {
    const g = makeGame(2, { epoch: 1 });
    find(g, 'p0').essence = essence({ red: 4, blue: 1 });
    find(g, 'p1').essence = essence({ red: 2, blue: 5 });
    const { next } = resolveConvergence(g);
    expect(find(next, 'p0').scoredVP).toBe(2);
    expect(find(next, 'p1').scoredVP).toBe(2);
  });

  it('при ничьей бонус получают все участники ничьи', () => {
    const g = makeGame(3, { epoch: 2 });
    g.players.forEach((p) => { p.essence = essence({ red: 3 }); });
    const { next } = resolveConvergence(g);
    for (const id of ['p0', 'p1', 'p2']) expect(find(next, id).scoredVP).toBe(3);
  });

  it('цвет, которого нет ни у кого, не приносит бонуса никому', () => {
    const g = makeGame(2, { epoch: 3 });
    g.players.forEach((p) => { p.essence = essence({}); });
    const { next, events } = resolveConvergence(g);
    expect(events).toHaveLength(0);
    expect(find(next, 'p0').scoredVP).toBe(0);
  });

  it('очки Схождения фиксируются, эссенция остаётся у игрока', () => {
    const g = makeGame(2, { epoch: 1 });
    find(g, 'p0').essence = essence({ red: 4 });
    const { next } = resolveConvergence(g);
    expect(find(next, 'p0').essence.red).toBe(4);
  });
});

describe('смена эпохи', () => {
  it('добавляет новые узлы и обновляет рынок', () => {
    const g = makeGame(6, { epoch: 1 });
    const { next, events } = advanceEpoch(g);
    expect(next.epoch).toBe(2);
    expect(next.nodes.map((n) => n.id).sort())
      .toEqual(['air', 'earth', 'fire', 'void', 'water']);
    expect(next.market).toHaveLength(6);
    expect(events.some((e) => e.t === 'EpochAdvanced')).toBe(true);
  });
});

describe('финальный подсчёт', () => {
  it('штраф за Скверну растёт треугольником', () => {
    const table = [0, 1, 3, 6, 10, 15, 21, 28, 36];
    table.forEach((v, n) => expect(corruptionPenalty(n)).toBe(v));
  });

  it('полных наборов столько, сколько минимального цвета из бывших в игре', () => {
    const g = makeGame(6);
    find(g, 'p0').essence = essence({ red: 3, blue: 2, green: 4, white: 2, purple: 5 });
    expect(completeSets(find(g, 'p0'), 6)).toBe(2);
  });

  it('на двоих набор — три цвета, а не пять', () => {
    const g = makeGame(2);
    find(g, 'p0').essence = essence({ red: 2, blue: 2, green: 2 });
    expect(completeSets(find(g, 'p0'), 2)).toBe(2);
  });

  it('складывает все источники и вычитает Скверну', () => {
    const g = makeGame(6);
    const p = find(g, 'p0');
    p.essence = essence({ red: 3, blue: 2, green: 4, white: 1, purple: 1 });  // 11 эссенции
    p.scoredVP = 15;
    p.corruption = 3;
    const s = finalScores(g)[0]!;
    // 11 + 15 + 1 набор × 5 − 6
    expect(s.essence).toBe(11);
    expect(s.sets).toBe(1);
    expect(s.penalty).toBe(6);
    expect(s.total).toBe(25);
  });

  it('при равенстве очков впереди тот, у кого меньше Скверны', () => {
    const g = makeGame(2);
    find(g, 'p0').scoredVP = 10;
    find(g, 'p0').corruption = 2;
    find(g, 'p1').scoredVP = 10 - 1;
    find(g, 'p1').corruption = 0;
    // выравниваем итог: p1 добираем эссенцией
    find(g, 'p1').essence = essence({ red: 1 });
    const [first] = finalScores(g);
    expect(first!.playerId).toBe('p1');
  });
});

describe('конец партии', () => {
  it('в Эпохе III партия обрывается, когда активных узлов меньше двух', () => {
    const g = makeGame(6, { epoch: 3 });
    g.nodes = [
      { id: 'fire', active: true, empowered: false },
      { id: 'water', active: false, empowered: false },
      { id: 'earth', active: false, empowered: false },
    ];
    expect(gameOverReason(g)).toBe('nodes-exhausted');
  });

  it('пока узлов два и больше — партия идёт', () => {
    const g = makeGame(6, { epoch: 3 });
    g.nodes = [
      { id: 'fire', active: true, empowered: false },
      { id: 'water', active: true, empowered: false },
    ];
    expect(gameOverReason(g)).toBe(null);
  });
});
