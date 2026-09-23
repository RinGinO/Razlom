import { describe, expect, it } from 'vitest';
import { resolveBuilding, resolvePulse, resolveWeaving } from '../src/resolve.js';
import { resolveConvergence, advanceEpoch, completeSets } from '../src/score.js';
import { ARCHMAGES } from '../src/cards.js';
import type { BuildingAction, Color, StandingOrder } from '../src/types.js';
import { essence, expectRule, find, makeGame, weave, weaveAll } from './helpers.js';

function grant(g: ReturnType<typeof makeGame>, id: string, who = 'p0') {
  const p = find(g, who);
  if (ARCHMAGES.some((a) => a.id === id)) p.archmage = id as never;
  else p.charms = [...p.charms, id];
}

const build = (playerId: string, over: Partial<BuildingAction> = {}): BuildingAction => ({
  kind: 'building', playerId, pick: null, consolationColor: 'red', exchanges: [], ...over,
});

const use = (charmId: string, target?: string): StandingOrder => ({
  id: `o-${charmId}`,
  trigger: { type: 'always' },
  effect: target
    ? { type: 'use-charm', charmId, target }
    : { type: 'use-charm', charmId },
});

describe('обмены', () => {
  it('Родник меняет эссенцию на три маны', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'spring');
    find(g, 'p0').essence = essence({ red: 2 });
    find(g, 'p0').mana = 5;
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', { fire: 8 }, 0, {
      exchanges: [{ charmId: 'spring', from: 'red' }],
    });
    const { next, events } = resolveWeaving(g, actions);   // 5 + 3 = 8 хватило ровно
    expect(events.some((e) => e.t === 'EssenceExchanged')).toBe(true);
    // 2 отдал Роднику одну, затем взял Огонь и получил две: 2 − 1 + 2
    expect(find(next, 'p0').essence.red).toBe(3);
    // мана: 5 + 3 от Родника − 8 на ставку, победа её сожгла, остался доход
    expect(find(next, 'p0').mana).toBe(3);
  });

  it('Родник не сработает дважды за раунд', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'spring');
    find(g, 'p0').essence = essence({ red: 4 });
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', {}, 0, {
      exchanges: [
        { charmId: 'spring', from: 'red' },
        { charmId: 'spring', from: 'red' },
      ],
    });
    expectRule(() => resolveWeaving(g, actions), 'no-uses-left');
  });

  it('Алхимик меняет две эссенции одного цвета на одну любого', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'alchemist');
    find(g, 'p0').essence = essence({ red: 3 });
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', {}, 0, {
      exchanges: [{ charmId: 'alchemist', from: 'red', to: 'blue' }],
    });
    const { next } = resolveWeaving(g, actions);
    expect(find(next, 'p0').essence.red).toBe(1);
    expect(find(next, 'p0').essence.blue).toBe(1);
  });

  it('Тигель меняет в Строительстве, а не в Плетении', () => {
    const g = makeGame(2, { phase: 'building' });
    grant(g, 'crucible');
    find(g, 'p0').essence = essence({ green: 4 });
    const { next } = resolveBuilding(g, {
      p0: build('p0', { exchanges: [{ charmId: 'crucible', from: 'green', to: 'purple' }] }),
      p1: build('p1'),
    });
    expect(find(next, 'p0').essence.green).toBe(2);
    expect(find(next, 'p0').essence.purple).toBe(1);
  });

  it('Тигель в Плетении не работает', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'crucible');
    find(g, 'p0').essence = essence({ green: 4 });
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', {}, 0, {
      exchanges: [{ charmId: 'crucible', from: 'green', to: 'red' }],
    });
    expectRule(() => resolveWeaving(g, actions), 'wrong-phase');
  });
});

describe('нацеленные карты', () => {
  it('Печать обнуляет стопку соперника на узле', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'seal');
    const actions = weaveAll(g, { p1: { fire: 6 } });
    actions['p0'] = weave('p0', { fire: 2 }, 0, {
      targeted: [{ charmId: 'seal', targetPlayerId: 'p1', node: 'fire' }],
    });
    const { next, events } = resolveWeaving(g, actions);
    expect(events.some((e) => e.t === 'NodeSealed')).toBe(true);
    expect(find(next, 'p0').essence.red).toBe(2);   // соперника на узле не осталось
    expect(find(next, 'p1').essence.red).toBe(0);
  });

  it('Печать малая действует раз за эпоху и переживает раунд', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'lesser-seal');
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', { fire: 1 }, 0, {
      targeted: [{ charmId: 'lesser-seal', targetPlayerId: 'p1', node: 'fire' }],
    });
    const after = resolveWeaving(g, actions).next;
    expect(find(after, 'p0').charmUses['lesser-seal']).toBe(1);
    // новый раунд не возвращает эпохальное окно
    const nextRoundState = resolvePulse({ ...after, phase: 'pulse' }).next;
    expect(find(nextRoundState, 'p0').charmUses['lesser-seal']).toBe(1);
  });

  it('нельзя целиться в себя', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'seal');
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', {}, 0, {
      targeted: [{ charmId: 'seal', targetPlayerId: 'p0', node: 'fire' }],
    });
    expectRule(() => resolveWeaving(g, actions), 'bad-target');
  });

  it('Клеймо утяжеляет вклад цели при Пороге, но не при подсчёте мест', () => {
    const g = makeGame(2, { threshold: 8 });
    grant(g, 'brand');
    const actions = weaveAll(g, { p1: { fire: 7 } });
    actions['p0'] = weave('p0', { fire: 2 }, 0, {
      targeted: [{ charmId: 'brand', targetPlayerId: 'p1' }],
    });
    const { next, events } = resolveWeaving(g, actions);
    // 2 + 7 = 9 против Порога 8 — но Клеймо добавило цели ещё 2, итого 11
    expect(events.some((e) => e.t === 'NodeOverloaded')).toBe(true);
    expect(find(next, 'p1').corruption).toBe(1);
  });

  it('без Клейма та же расстановка перегрузки не даёт', () => {
    const g = makeGame(2, { threshold: 10 });
    const { events } = resolveWeaving(g, weaveAll(g, { p0: { fire: 2 }, p1: { fire: 7 } }));
    expect(events.some((e) => e.t === 'NodeOverloaded')).toBe(false);
  });
});

describe('активируемые предзаявкой', () => {
  it('Громоотвод берёт эссенцию как победитель и не берёт Скверну', () => {
    const g = makeGame(2, { threshold: 5, epoch: 2 });
    grant(g, 'lightning-rod');
    const actions = weaveAll(g, { p1: { fire: 4 } });
    actions['p0'] = weave('p0', { fire: 4 }, 0, {
      standingOrders: [use('lightning-rod', 'fire')],
    });
    const { next, events } = resolveWeaving(g, actions);
    expect(events.some((e) => e.t === 'OverloadIgnored')).toBe(true);
    expect(find(next, 'p0').corruption).toBe(0);
    expect(find(next, 'p0').essence.red).toBe(3);
    expect(find(next, 'p1').corruption).toBe(1);
  });

  it('Громоотвод спасает владельца, но не узел: в Эпохе III тот всё равно выгорает', () => {
    const g = makeGame(6, { threshold: 4, epoch: 3 });
    grant(g, 'lightning-rod');
    const actions = weaveAll(g, { p1: { fire: 3 } });
    actions['p0'] = weave('p0', { fire: 3 }, 0, {
      standingOrders: [use('lightning-rod', 'fire')],
    });
    const { next } = resolveWeaving(g, actions);
    expect(next.nodes.find((n) => n.id === 'fire')?.active).toBe(false);
  });

  it('Немой узел отменяет перегрузку целиком', () => {
    const g = makeGame(2, { threshold: 5, epoch: 2 });
    grant(g, 'mute-node');
    const actions = weaveAll(g, { p1: { fire: 2 } });
    actions['p0'] = weave('p0', { fire: 5 }, 0, {
      standingOrders: [use('mute-node', 'fire')],
    });
    const { next, events } = resolveWeaving(g, actions);
    expect(events.some((e) => e.t === 'OverloadCancelled')).toBe(true);
    expect(events.some((e) => e.t === 'NodeOverloaded')).toBe(false);
    expect(find(next, 'p0').essence.red).toBe(3);   // узел разрешился нормально
    expect(find(next, 'p1').essence.red).toBe(1);
    expect(find(next, 'p0').corruption).toBe(0);
  });

  it('Немой узел не спасает узел, на котором владелец не стоял', () => {
    const g = makeGame(3, { threshold: 5, epoch: 2 });
    grant(g, 'mute-node');
    const actions = weaveAll(g, { p1: { fire: 4 }, p2: { fire: 4 } });
    actions['p0'] = weave('p0', { water: 1 }, 0, {
      standingOrders: [use('mute-node', 'fire')],
    });
    const { events } = resolveWeaving(g, actions);
    expect(events.some((e) => e.t === 'NodeOverloaded')).toBe(true);
  });

  it('Жатва удваивает эссенцию, полученную в раунде', () => {
    const g = makeGame(2, { threshold: 20, epoch: 2 });
    grant(g, 'harvest');
    const actions = weaveAll(g, { p1: { fire: 1 } });
    actions['p0'] = weave('p0', { fire: 5 }, 0, { standingOrders: [use('harvest')] });
    const { next, events } = resolveWeaving(g, actions);
    expect(events.some((e) => e.t === 'HarvestDoubled')).toBe(true);
    expect(find(next, 'p0').essence.red).toBe(6);   // 3 за первое место, удвоено
    expect(find(next, 'p1').essence.red).toBe(1);
  });

  it('карту без права активации предзаявкой не активировать', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'weaver');
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', { fire: 1 }, 0, { standingOrders: [use('weaver')] });
    expectRule(() => resolveWeaving(g, actions), 'not-activatable');
  });
});

describe('выбор цвета при покупке', () => {
  it('Столп требует объявить цвет', () => {
    const g = makeGame(2, { phase: 'building', epoch: 3 });
    g.market = ['pillar', 'crown', 'rainbow', 'vault', 'harvest', 'devourer'];
    find(g, 'p0').essence = essence({ red: 8 });
    expectRule(() => resolveBuilding(g, {
      p0: build('p0', { pick: { charmId: 'pillar', overbid: 0, pay: { red: 8 } } }),
      p1: build('p1'),
    }), 'needs-color');
  });

  it('Столп добавляет два очка к большинству по объявленному цвету', () => {
    const g = makeGame(2, { epoch: 2 });
    grant(g, 'pillar');
    find(g, 'p0').charmChoices = { pillar: 'green' as Color };
    find(g, 'p0').essence = essence({ green: 5, red: 5 });
    const { next } = resolveConvergence(g);
    expect(find(next, 'p0').scoredVP).toBe(3 + 2 + 3);   // зелёное с надбавкой, красное обычное
  });

  it('Друид-Чара делает цвет универсальным при подсчёте наборов', () => {
    const g = makeGame(6);
    grant(g, 'druid-charm');
    const p = find(g, 'p0');
    p.charmChoices = { 'druid-charm': 'red' as Color };
    p.essence = essence({ red: 6, blue: 1, green: 1, white: 1, purple: 1 });
    expect(completeSets(p, 6)).toBe(2);   // красное закрывает нехватку остальных
  });

  it('без Друида те же запасы дают один набор', () => {
    const g = makeGame(6);
    const p = find(g, 'p0');
    p.essence = essence({ red: 6, blue: 1, green: 1, white: 1, purple: 1 });
    expect(completeSets(p, 6)).toBe(1);
  });
});

describe('Друид-Архимаг', () => {
  it('объявляет цвет в Строительстве Эпохи I', () => {
    const g = makeGame(2, { phase: 'building', epoch: 1 });
    grant(g, 'druid');
    const { next, events } = resolveBuilding(g, {
      p0: build('p0', { druidColor: 'blue' }),
      p1: build('p1'),
    });
    expect(find(next, 'p0').druidColor).toBe('blue');
    expect(events.some((e) => e.t === 'ColorDeclared')).toBe(true);
  });

  it('во второй эпохе объявить уже нельзя', () => {
    const g = makeGame(2, { phase: 'building', epoch: 2 });
    grant(g, 'druid');
    expectRule(() => resolveBuilding(g, {
      p0: build('p0', { druidColor: 'blue' }),
      p1: build('p1'),
    }), 'wrong-phase');
  });

  it('§12: Чара и Архимаг вместе дают два универсальных цвета', () => {
    const g = makeGame(6);
    grant(g, 'druid');
    grant(g, 'druid-charm');
    const p = find(g, 'p0');
    p.druidColor = 'red';
    p.charmChoices = { 'druid-charm': 'blue' as Color };
    p.essence = essence({ red: 4, blue: 4, green: 1, white: 1, purple: 1 });
    expect(completeSets(p, 6)).toBe(2);
  });
});

describe('счётчик использований', () => {
  it('раундовое окно открывается заново на новом Пульсе', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'spring');
    find(g, 'p0').essence = essence({ red: 4 });
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', {}, 0, { exchanges: [{ charmId: 'spring', from: 'red' }] });
    const after = resolveWeaving(g, actions).next;
    expect(find(after, 'p0').charmUses['spring']).toBe(1);
    const fresh = resolvePulse({ ...after, phase: 'pulse' }).next;
    expect(find(fresh, 'p0').charmUses['spring']).toBeUndefined();
  });

  it('эпохальное окно открывается заново при смене эпохи', () => {
    const g = makeGame(6, { epoch: 1 });
    find(g, 'p0').charms = ['lesser-seal'];
    find(g, 'p0').charmUses = { 'lesser-seal': 1 };
    const { next } = advanceEpoch(g);
    expect(find(next, 'p0').charmUses['lesser-seal']).toBeUndefined();
  });
});
