/**
 * Политика-агент для симуляции.
 *
 * Это НЕ бот в игре: ботов в «Разломе» нет. Агент живёт только здесь, вызывает
 * ядро напрямую и никогда не подключается к комнате. Он читает лишь то, что
 * видно игроку публично — Порог, свою руку, ману соперников и историю раундов.
 */
import {
  ABYSS_MANA, NEEDS_COLOR, NODE_ORDER, REWARD, charm, nextFloat, nextInt,
  type BuildingAction, type Color, type GameState, type NodeId,
  type RngState, type WeavingAction,
} from '@razlom/core';

export interface Policy {
  name: string;
  weaving(state: GameState, playerId: string, rng: RngState): [WeavingAction, RngState];
  building(state: GameState, playerId: string, rng: RngState): [BuildingAction, RngState];
}

const COLORS: Color[] = ['red', 'blue', 'green', 'white', 'purple'];

function me(state: GameState, id: string) {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`нет игрока ${id}`);
  return p;
}

function activeNodes(state: GameState): NodeId[] {
  return NODE_ORDER.filter((id) => state.nodes.some((n) => n.id === id && n.active));
}

/** Сколько маны в запасе у соперников — величина публичная (§8). */
function othersMana(state: GameState, playerId: string): number {
  return state.players.filter((p) => p.id !== playerId).reduce((s, p) => s + p.mana, 0);
}

/**
 * Ожидаемая суммарная чужая ставка на узел.
 *
 * Априорная догадка идёт от запаса соперников, разложенного по узлам, а не от
 * Порога: иначе на первом раунде агент считает, что до Порога уйма места, и
 * весь стол вываливается в один узел.
 *
 * С историей смешиваем пополам. Чистая история даёт качели: после общей
 * перегрузки все разом уходят с узла, история показывает ноль, и на следующем
 * раунде они возвращаются туда же все вместе.
 */
function expectedOthers(state: GameState, playerId: string, node: NodeId): number {
  const nodes = Math.max(1, activeNodes(state).length);
  const prior = othersMana(state, playerId) / nodes;
  const recent = state.history.slice(-3);
  if (recent.length === 0) return prior;
  let sum = 0;
  for (const r of recent) {
    const stacks = r.stacks[node] ?? {};
    for (const [pid, v] of Object.entries(stacks)) if (pid !== playerId) sum += v;
  }
  return 0.5 * prior + 0.5 * (sum / recent.length);
}

/** Сколько соперников обычно стоит на узле — чтобы прикинуть сильнейшего из них. */
function expectedContenders(state: GameState, playerId: string, node: NodeId): number {
  const recent = state.history.slice(-3);
  if (recent.length === 0) {
    return Math.max(1, (state.players.length - 1) / Math.max(1, activeNodes(state).length));
  }
  const prior = (state.players.length - 1) / Math.max(1, activeNodes(state).length);
  let n = 0;
  for (const r of recent) {
    const stacks = r.stacks[node] ?? {};
    n += Object.keys(stacks).filter((pid) => pid !== playerId).length;
  }
  return Math.max(1, 0.5 * prior + 0.5 * (n / recent.length));
}

/** Плата за Чару: сначала тратим самые бедные цвета, чтобы не рушить своё большинство. */
function payFrom(essence: Record<Color, number>, amount: number): Partial<Record<Color, number>> | null {
  const order = COLORS.filter((c) => essence[c] > 0).sort((a, b) => essence[a] - essence[b]);
  const pay: Partial<Record<Color, number>> = {};
  let left = amount;
  for (const c of order) {
    if (left <= 0) break;
    const take = Math.min(essence[c], left);
    pay[c] = take;
    left -= take;
  }
  return left === 0 ? pay : null;
}

function buildingFor(
  state: GameState, playerId: string, rng: RngState, buyRate: number,
): [BuildingAction, RngState] {
  const p = me(state, playerId);
  const [roll, r1] = nextFloat(rng);
  const consolationColor = COLORS[0] as Color;
  if (roll >= buyRate) {
    return [{ kind: 'building', playerId, pick: null, consolationColor, exchanges: [] }, r1];
  }
  const affordable = state.market
    .map((id) => ({ id, price: charm(id).price }))
    .filter((c) => COLORS.reduce((s, col) => s + p.essence[col], 0) >= c.price)
    .sort((a, b) => a.price - b.price);
  const target = affordable[0];
  if (!target) return [{ kind: 'building', playerId, pick: null, consolationColor, exchanges: [] }, r1];
  const pay = payFrom(p.essence, target.price);
  if (!pay) return [{ kind: 'building', playerId, pick: null, consolationColor, exchanges: [] }, r1];
  // Столп и Друид требуют объявить цвет при покупке: берём самый обильный —
  // Столпу он даст надбавку там, где большинство вероятнее, Друиду закроет
  // нехватку остальных цветов.
  const richest = COLORS.reduce((a, b) => (p.essence[a] >= p.essence[b] ? a : b));
  const pick = NEEDS_COLOR.includes(target.id)
    ? { charmId: target.id, overbid: 0, pay, choice: richest }
    : { charmId: target.id, overbid: 0, pay };
  return [{ kind: 'building', playerId, consolationColor, exchanges: [], pick }, r1];
}

/** Уровень 1: равномерно раскидывает случайную долю маны. Годен для нагрузки. */
export function randomPolicy(buyRate = 0.25): Policy {
  return {
    name: 'random',
    weaving(state, playerId, rng) {
      const p = me(state, playerId);
      const nodes = activeNodes(state);
      let r = rng;
      let budget = p.mana;
      const stacks: Partial<Record<NodeId, number>> = {};
      for (const node of nodes) {
        if (budget <= 0) break;
        const [amount, r2] = nextInt(r, budget + 1);
        r = r2;
        if (amount > 0) { stacks[node] = amount; budget -= amount; }
      }
      return [{ kind: 'weaving', playerId, stacks, corruptionTaken: 0, standingOrders: [], exchanges: [], targeted: [] }, r];
    },
    building(state, playerId, rng) { return buildingFor(state, playerId, rng, buyRate); },
  };
}

/**
 * Уровень 2: эвристика из §10 спецификации.
 * Ценность узла — награда с учётом усиления; риск — ожидаемая чужая сумма
 * против Порога. Ставит туда, где отношение лучше, и не лезет туда, где
 * запаса до Порога уже нет. Скверну берёт, только отставая в Эпохе III.
 */
export function heuristicPolicy(buyRate = 0.25, risk = 0.4): Policy {
  return {
    name: 'heuristic',
    weaving(state, playerId, rng) {
      const p = me(state, playerId);
      const reward = REWARD[state.epoch];
      let r = rng;

      // Скверна: только в Эпохе III и только отставая больше чем на 15%
      // Скверна — не рефлекс, а средство: берём, только отставая в Эпохе III
      // и когда запаса не хватает даже на попытку побороться за узел.
      let corruptionTaken = 0;
      if (state.epoch === 3 && p.mana < state.threshold) {
        const best = Math.max(...state.players.map((x) => x.scoredVP));
        if (best > 0 && p.scoredVP < best * 0.85) corruptionTaken = 1;
      }
      let budget = p.mana + ABYSS_MANA * corruptionTaken;

      // Разброс обязателен. Агенты одинаковы и детерминированы, поэтому без
      // шума они ранжируют узлы одинаково и сходятся на одном — гарантированная
      // перегрузка. В игре на скрытых одновременных ставках равновесие смешанное:
      // чистая стратегия здесь проигрывает по построению.
      const ranked = activeNodes(state)
        .map((node) => {
          const empowered = state.nodes.find((n) => n.id === node)?.empowered ?? false;
          const value = reward.first * (empowered ? 2 : 1);
          const expected = expectedOthers(state, playerId, node);
          const contenders = expectedContenders(state, playerId, node);
          const [jitter, rj] = nextFloat(r);
          r = rj;
          return {
            node, value, expected, contenders,
            score: (value / (1 + expected)) * (0.7 + 0.6 * jitter),
          };
        })
        .sort((a, b) => b.score - a.score);

      // Узел выбирается рулеткой пропорционально привлекательности, а не
      // argmax: одинаковые агенты с argmax садятся на один узел и сносят его.
      // Ставим на один узел — двумя ставками шестеро забивают три узла насмерть.
      const stacks: Partial<Record<NodeId, number>> = {};
      const sum = ranked.reduce((acc, c) => acc + c.score, 0);
      if (sum > 0 && budget > 0) {
        const [roll, r3] = nextFloat(r);
        r = r3;
        let acc = 0;
        let pick = ranked[0] as (typeof ranked)[number];
        for (const c of ranked) {
          acc += c.score / sum;
          if (roll <= acc) { pick = c; break; }
        }
        // Запас прочности: считаемся с тем, что придёт на одного соперника
        // больше ожидаемого. Без него редкая толчея из пяти игроков на узле
        // сносит его каждый раз, хотя в среднем там двое.
        const seats = pick.contenders + 2;
        const safe = Math.floor(state.threshold / seats);

        // Одной осторожности мало: победа требует перебить соперника, а не
        // просто не перегрузить узел. Чем дороже узел, тем чаще идём на риск —
        // отсюда и рост доли перегрузок от эпохи к эпохе, заложенный в правилах.
        const topRival = pick.expected / Math.max(1, pick.contenders);
        const contest = Math.ceil(topRival) + 1;
        const appetite = ((reward.first * (pick.value > reward.first ? 2 : 1)) / 10) * risk;
        const [dice, r4] = nextFloat(r);
        r = r4;
        const want = dice < appetite ? Math.max(safe, contest) : safe;
        stacks[pick.node] = Math.max(1, Math.min(budget, want));
      }

      return [{ kind: 'weaving', playerId, stacks, corruptionTaken, standingOrders: [], exchanges: [], targeted: [] }, r];
    },
    building(state, playerId, rng) { return buildingFor(state, playerId, rng, buyRate); },
  };
}

export function policyByName(name: string, buyRate: number, risk = 0.4): Policy {
  if (name === 'random') return randomPolicy(buyRate);
  if (name === 'heuristic') return heuristicPolicy(buyRate, risk);
  throw new Error(`неизвестная политика: ${name} (есть random, heuristic)`);
}
