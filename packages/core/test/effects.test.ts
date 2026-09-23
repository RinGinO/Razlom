import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveWeaving } from '../src/resolve.js';
import { resolveConvergence, finalScores } from '../src/score.js';
import { CHARMS, ARCHMAGES } from '../src/cards.js';
import { NEEDS_PLAYER_INPUT, VISIBILITY_ONLY } from '../src/effects.js';
import { essence, find, makeGame, weave, weaveAll } from './helpers.js';

/** Выдать игроку Чару или Архимага. */
function grant(g: ReturnType<typeof makeGame>, id: string, who = 'p0') {
  const p = find(g, who);
  if (ARCHMAGES.some((a) => a.id === id)) p.archmage = id as never;
  else p.charms = [...p.charms, id];
}

describe('экономика маны', () => {
  it('Ученик даёт +1 к доходу, Мановод +2', () => {
    const g = makeGame(3, { threshold: 20 });
    grant(g, 'apprentice', 'p0');
    grant(g, 'manaduct', 'p1');
    g.players.forEach((p) => { p.mana = 5; });   // ниже предела, иначе меряем потолок
    const { next } = resolveWeaving(g, weaveAll(g, {}));
    expect(find(next, 'p0').mana).toBe(5 + 3 + 1);
    expect(find(next, 'p1').mana).toBe(5 + 3 + 2);
    expect(find(next, 'p2').mana).toBe(5 + 3);
  });

  it('Резервуар поднимает предел запаса до 16', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'reservoir');
    g.players.forEach((p) => { p.mana = 12; });
    const { next } = resolveWeaving(g, weaveAll(g, {}));
    expect(find(next, 'p0').mana).toBe(15);
    expect(find(next, 'p1').mana).toBe(12);   // без Резервуара предел прежний
  });

  it('Глубина и Владыка Пустоты дают за Скверну по 4 маны', () => {
    const g = makeGame(3, { threshold: 20 });
    grant(g, 'depth', 'p0');
    grant(g, 'voidlord', 'p1');
    const actions = weaveAll(g, {});
    actions['p0'] = weave('p0', {}, 1);
    actions['p1'] = weave('p1', {}, 1);
    actions['p2'] = weave('p2', {}, 1);
    const { next } = resolveWeaving(g, actions);
    expect(find(next, 'p0').mana).toBe(12);   // 8+4+3 срезано пределом
    expect(find(next, 'p1').mana).toBe(12);
    expect(find(next, 'p2').mana).toBe(12);   // 8+2+3 тоже упёрлось
  });

  it('Разветвление возвращает ману с бонусом', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'branching');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 2 }, p1: { fire: 5 } }));
    // p0 проиграл: вернулись 2 + 1 бонус, плюс доход 3
    expect(find(next, 'p0').mana).toBe(8 - 2 + 3 + 3);
  });
});

describe('награды на узле', () => {
  it('Ткач добавляет эссенцию за каждое первое место', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'weaver');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 5 }, p1: { fire: 1 } }));
    expect(find(next, 'p0').essence.red).toBe(3);   // 2 + 1
  });

  it('Собиратель добавляет эссенцию за второе место', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'gatherer', 'p1');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 5 }, p1: { fire: 1 } }));
    expect(find(next, 'p1').essence.red).toBe(2);   // 1 + 1
  });

  it('Владыка Пустоты берёт с Пустоты вдвое', () => {
    const g = makeGame(6, { threshold: 20, epoch: 2 });
    grant(g, 'voidlord');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { void: 3 } }));
    expect(find(next, 'p0').essence.purple).toBe(6);   // награда эпохи 3 × 2
  });

  it('Пиромант получает ману за взятый Огонь и выигрывает ничьи на нём', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'pyromancer');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 4 } }));
    expect(find(next, 'p0').essence.red).toBe(2);   // ничья разрешена в его пользу
    expect(find(next, 'p1').essence.red).toBe(1);
    expect(find(next, 'p0').mana).toBe(8 - 4 + 1 + 3);   // мана победы сгорела, +1 за Огонь
  });

  it('Сговор объявляет владельца победителем при ничьей', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'collusion', 'p1');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { water: 3 }, p1: { water: 3 } }));
    expect(find(next, 'p1').essence.blue).toBe(2);
    expect(find(next, 'p0').essence.blue).toBe(1);
  });

  it('двое со Сговором — ничья остаётся ничьёй', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'collusion', 'p0');
    grant(g, 'collusion', 'p1');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { water: 3 }, p1: { water: 3 } }));
    expect(find(next, 'p0').essence.blue).toBe(1);
    expect(find(next, 'p1').essence.blue).toBe(1);
  });

  it('Мытарь получает ману, когда соперник берёт узел, где он стоял', () => {
    const g = makeGame(2, { threshold: 20 });
    grant(g, 'tollman', 'p1');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 5 }, p1: { fire: 1 } }));
    expect(find(next, 'p1').mana).toBe(8 - 1 + 1 + 1 + 3);  // возврат 1, мыт 1, доход 3
  });
});

describe('перегрузка', () => {
  it('Хранитель не берёт Скверну и забирает половину эссенции', () => {
    const g = makeGame(2, { threshold: 5, epoch: 2 });
    grant(g, 'keeper');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 4 }, p1: { fire: 4 } }));
    expect(find(next, 'p0').corruption).toBe(0);
    expect(find(next, 'p0').essence.red).toBe(1);   // половина от 3, вниз
    expect(find(next, 'p1').corruption).toBe(1);
    expect(find(next, 'p1').essence.red).toBe(0);
  });

  it('Хранитель праха берёт Скверну только будучи крупнейшим вкладчиком', () => {
    const g = makeGame(2, { threshold: 5 });
    grant(g, 'ash-keeper');
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 2 }, p1: { fire: 5 } }));
    expect(find(next, 'p0').corruption).toBe(0);
    expect(find(next, 'p1').corruption).toBe(1);
  });

  it('Пожиратель забирает по мане у каждого участника перегруженного узла', () => {
    const g = makeGame(3, { threshold: 5 });
    grant(g, 'devourer');
    g.players.forEach((p) => { p.mana = 6; });
    const { next } = resolveWeaving(g, weaveAll(g, { p0: { fire: 2 }, p1: { fire: 2 }, p2: { fire: 2 } }));
    // все трое перегрузили узел; p1 и p2 отдали по мане, p0 получил две
    expect(find(next, 'p0').mana).toBe(6 + 3 + 2);
    expect(find(next, 'p1').mana).toBe(6 + 3 - 1);
  });

  it('Свод приносит эссенцию за каждый выгоревший узел', () => {
    const g = makeGame(6, { threshold: 4, epoch: 3 });
    grant(g, 'vault');
    const { next } = resolveWeaving(g, weaveAll(g, { p1: { fire: 3 }, p2: { fire: 3 } }));
    expect(next.nodes.find((n) => n.id === 'fire')?.active).toBe(false);
    expect(find(next, 'p0').essence.red).toBe(2);   // сам на узле не стоял
  });
});

describe('очки', () => {
  it('Летопись даёт очко за Схождение с большинством', () => {
    const g = makeGame(2, { epoch: 1 });
    grant(g, 'chronicle');
    find(g, 'p0').essence = essence({ red: 5 });
    const { next } = resolveConvergence(g);
    expect(find(next, 'p0').scoredVP).toBe(2 + 1);
    expect(find(next, 'p1').scoredVP).toBe(0);
  });

  it('Летопись молчит, если большинства не было', () => {
    const g = makeGame(2, { epoch: 1 });
    grant(g, 'chronicle');
    find(g, 'p1').essence = essence({ red: 5 });
    const { next } = resolveConvergence(g);
    expect(find(next, 'p0').scoredVP).toBe(0);
  });

  it('Радуга даёт за набор 8 очков вместо 5, Венец добавляет 4 в финале', () => {
    const g = makeGame(2);
    grant(g, 'rainbow');
    grant(g, 'crown');
    find(g, 'p0').essence = essence({ red: 2, blue: 2, green: 2 });
    const s = finalScores(g).find((x) => x.playerId === 'p0')!;
    expect(s.sets).toBe(2);
    expect(s.setPoints).toBe(16);
    expect(s.charmPoints).toBe(4);
  });
});

describe('честность разметки', () => {
  /**
   * Проверяем не перечень, который я веду руками, а сам код: карта считается
   * реализованной, если её идентификатор где-то в ядре встречается. Перечень
   * реализованного протух бы на первой же новой карте.
   */
  const sources = ['effects', 'resolve', 'score', 'standing', 'setup']
    .map((f) => readFileSync(new URL(`../src/${f}.ts`, import.meta.url), 'utf8'))
    .join('\n');

  const mentioned = (id: string) => {
    const esc = id.replace(/-/g, '\\-');
    // в кавычках либо как ключ объекта без кавычек
    return new RegExp(`['\`"]${esc}['\`"]`).test(sources)
      || new RegExp(`^\\s*${esc}:`, 'm').test(sources);
  };

  it('каждая Чара упомянута в коде, в списке ожидающих или среди видящих', () => {
    const pending = new Set(Object.keys(NEEDS_PLAYER_INPUT));
    const visibility = new Set<string>(VISIBILITY_ONLY);
    for (const c of CHARMS) {
      const known = mentioned(c.id) || pending.has(c.id) || visibility.has(c.id);
      expect(known, `Чара «${c.name}» нигде не учтена`).toBe(true);
    }
  });

  it('каждый Архимаг упомянут в коде, в списке ожидающих или среди видящих', () => {
    const pending = new Set(Object.keys(NEEDS_PLAYER_INPUT));
    const visibility = new Set<string>(VISIBILITY_ONLY);
    for (const a of ARCHMAGES) {
      const known = mentioned(a.id) || pending.has(a.id) || visibility.has(a.id);
      expect(known, `Архимаг «${a.name}» нигде не учтён`).toBe(true);
    }
  });

  it('список ожидающих пуст — все карты реализованы', () => {
    expect(Object.keys(NEEDS_PLAYER_INPUT)).toEqual([]);
  });
});

describe('Якорь бездны', () => {
  it('снимает две Скверны сразу при покупке', async () => {
    const { resolveBuilding } = await import('../src/resolve.js');
    const g = makeGame(2, { phase: 'building', epoch: 3 });
    g.market = ['abyss-anchor', 'crown', 'rainbow', 'vault', 'harvest', 'pillar'];
    find(g, 'p0').corruption = 3;
    find(g, 'p0').essence = essence({ red: 10 });
    const { next, events } = resolveBuilding(g, {
      p0: { kind: 'building', playerId: 'p0', consolationColor: 'red', exchanges: [],
            pick: { charmId: 'abyss-anchor', overbid: 0, pay: { red: 10 } } },
      p1: { kind: 'building', playerId: 'p1', pick: null, consolationColor: 'red', exchanges: [] },
    });
    expect(find(next, 'p0').corruption).toBe(1);
    expect(events.some((e) => e.t === 'CorruptionCleared')).toBe(true);
  });

  it('без Скверны не уходит в минус', async () => {
    const { resolveBuilding } = await import('../src/resolve.js');
    const g = makeGame(2, { phase: 'building', epoch: 3 });
    g.market = ['abyss-anchor', 'crown', 'rainbow', 'vault', 'harvest', 'pillar'];
    find(g, 'p0').corruption = 0;
    find(g, 'p0').essence = essence({ red: 10 });
    const { next, events } = resolveBuilding(g, {
      p0: { kind: 'building', playerId: 'p0', consolationColor: 'red', exchanges: [],
            pick: { charmId: 'abyss-anchor', overbid: 0, pay: { red: 10 } } },
      p1: { kind: 'building', playerId: 'p1', pick: null, consolationColor: 'red', exchanges: [] },
    });
    expect(find(next, 'p0').corruption).toBe(0);
    expect(events.some((e) => e.t === 'CorruptionCleared')).toBe(false);
  });
});
