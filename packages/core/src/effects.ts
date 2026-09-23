/**
 * Эффекты Чар и Архимагов (§9 и §10 правил).
 *
 * Реестр намеренно плоский: маленькие функции, каждая отвечает на один вопрос
 * в одной точке разрешения. Обобщённая система хуков читалась бы хуже, а
 * эффектов всего три десятка.
 *
 * Здесь только то, что считается по уже имеющимся данным заявки. Эффекты,
 * требующие отдельного решения игрока (выбрать цвет, указать соперника,
 * активировать «раз за эпоху»), перечислены в NEEDS_PLAYER_INPUT: под них
 * нужны новые поля в заявке, и это следующий заход.
 */
import type { CharmId, Color, NodeId, PlayerState } from './types.js';
import { COLOR_ORDER, NODE_COLOR } from './types.js';

/** Есть ли у игрока эта Чара или этот Архимаг. */
export function has(p: PlayerState, id: string): boolean {
  return p.archmage === id || p.charms.includes(id);
}

/**
 * Эффекты, ждущие расширения заявки. Сейчас пусто: все тридцать Чар и восемь
 * Архимагов реализованы. Механизм оставлен — он пригодится новым картам, и
 * тест честности разметки не даст ему протухнуть.
 */
export const NEEDS_PLAYER_INPUT: Record<string, string> = {};

/**
 * Окно, в котором карта срабатывает один раз.
 * Счётчик обнуляется: round — в начале раунда, epoch — при смене эпохи.
 */
export const USE_LIMIT: Record<CharmId, 'round' | 'epoch'> = {
  spring: 'round',
  alchemist: 'round',
  seal: 'round',
  'lesser-seal': 'epoch',
  'lightning-rod': 'epoch',
  'mute-node': 'epoch',
  harvest: 'epoch',
};

export function canUse(p: PlayerState, id: CharmId): boolean {
  if (!has(p, id)) return false;
  if (!(id in USE_LIMIT)) return true;
  return (p.charmUses[id] ?? 0) < 1;
}

export function markUsed(p: PlayerState, id: CharmId): void {
  if (id in USE_LIMIT) p.charmUses[id] = (p.charmUses[id] ?? 0) + 1;
}

/** Обнулить счётчики закончившегося окна. Смена эпохи закрывает и раундовое. */
export function resetUses(p: PlayerState, scope: 'round' | 'epoch'): void {
  for (const [id, limit] of Object.entries(USE_LIMIT)) {
    if (limit === scope || scope === 'epoch') delete p.charmUses[id];
  }
}

/* ── обмены ── */

export const SPRING_MANA = 3;      // Родник: 1 эссенция → 3 маны
export const CONVERT_COST = 2;     // Алхимик и Тигель: 2 одного цвета → 1 любого

/** Родник и Алхимик меняют в Плетении, Тигель — в Строительстве, перед подсчётом. */
export const EXCHANGE_PHASE: Record<CharmId, 'weaving' | 'building'> = {
  spring: 'weaving',
  alchemist: 'weaving',
  crucible: 'building',
};

/* ── нацеленные карты ── */

/** Печати закрывают узел сопернику; Клеймо утяжеляет его вклад. */
export const TARGETED: Record<CharmId, { needsNode: boolean }> = {
  'lesser-seal': { needsNode: true },
  seal: { needsNode: true },
  brand: { needsNode: false },
};

export const BRAND_WEIGHT = 2;     // Клеймо: +2 к вкладу цели при проверке Порога

/* ── выбор цвета при покупке ── */

/** Карты, требующие объявить цвет в момент покупки. */
export const NEEDS_COLOR: CharmId[] = ['pillar', 'druid-charm'];

/** Столп: +2 ПО к бонусу за большинство по объявленному цвету. */
export function pillarBonus(p: PlayerState, color: Color): number {
  return has(p, 'pillar') && p.charmChoices['pillar'] === color ? 2 : 0;
}

/**
 * Цвета, универсальные при подсчёте наборов.
 * §12: Чара «Друид» и Архимаг «Друид» у одного игрока дают два разных цвета,
 * и эффекты складываются.
 */
export function wildcardColors(p: PlayerState): Color[] {
  const out = new Set<Color>();
  const charmColor = p.charmChoices['druid-charm'];
  if (has(p, 'druid-charm') && charmColor) out.add(charmColor);
  if (has(p, 'druid') && p.druidColor) out.add(p.druidColor);
  return COLOR_ORDER.filter((c) => out.has(c));
}

/** Эффекты, видимые только владельцу: это дело проекции, а не разрешения. */
export const VISIBILITY_ONLY = ['compass', 'eye', 'seer'] as const;

/* ── экономика маны ── */

/** Ученик +1, Мановод +2 к доходу раунда. */
export function incomeBonus(p: PlayerState): number {
  return (has(p, 'apprentice') ? 1 : 0) + (has(p, 'manaduct') ? 2 : 0);
}

/** Резервуар поднимает предел запаса с 12 до 16. */
export function manaCap(p: PlayerState, base: number): number {
  return has(p, 'reservoir') ? Math.max(base, 16) : base;
}

/** Глубина и Владыка Пустоты: Скверна даёт +4 маны вместо +2. */
export function abyssMana(p: PlayerState, base: number): number {
  return has(p, 'depth') || has(p, 'voidlord') ? 4 : base;
}

/** Разветвление: мана с проигранных узлов возвращается с бонусом +1. */
export function returnBonus(p: PlayerState, returned: number): number {
  return returned > 0 && has(p, 'branching') ? 1 : 0;
}

/** Последний вздох: в последнем раунде партии мана считается удвоенной. */
export function manaWeight(p: PlayerState, isLastRound: boolean): number {
  return isLastRound && has(p, 'last-breath') ? 2 : 1;
}

/* ── награды на узле ── */

/** Ткач: +1 эссенция за каждое первое место. Владыка Пустоты: Пустота вдвойне. */
export function firstEssenceBonus(p: PlayerState, node: NodeId, base: number): number {
  let gain = base;
  if (node === 'void' && has(p, 'voidlord')) gain *= 2;
  if (has(p, 'weaver')) gain += 1;
  return gain;
}

/** Собиратель: за второе место на 1 эссенцию больше. */
export function secondEssenceBonus(p: PlayerState, base: number): number {
  return base + (has(p, 'gatherer') ? 1 : 0);
}

/** Пиромант: +1 мана за каждый взятый огненный узел. */
export function firstPlaceManaBonus(p: PlayerState, node: NodeId): number {
  return node === 'fire' && has(p, 'pyromancer') ? 1 : 0;
}

/** Мытарь: +1 мана, когда соперник берёт первое место на узле, где ты стоял. */
export function tollmanBonus(p: PlayerState): number {
  return has(p, 'tollman') ? 1 : 0;
}

/**
 * Ничья за первое место. Сговор объявляет владельца победителем;
 * Пиромант выигрывает все ничьи на Огне.
 * Если таких претендентов несколько, ничья остаётся ничьёй.
 */
export function tieWinner(
  leaders: readonly PlayerState[], node: NodeId,
): PlayerState | null {
  const claimants = leaders.filter(
    (p) => has(p, 'collusion') || (node === 'fire' && has(p, 'pyromancer')),
  );
  return claimants.length === 1 ? (claimants[0] as PlayerState) : null;
}

/* ── перегрузка ── */

/** Хранитель Скверну не берёт. Хранитель праха — только если он крупнейший вкладчик. */
export function takesOverloadCorruption(p: PlayerState, isLargest: boolean): boolean {
  if (has(p, 'keeper')) return false;
  if (has(p, 'ash-keeper')) return isLargest;
  return true;
}

/** Хранитель забирает половину эссенции перегруженного узла, округляя вниз. */
export function overloadSalvage(p: PlayerState, reward: number): number {
  return has(p, 'keeper') ? Math.floor(reward / 2) : 0;
}

/** Пожиратель: при перегрузке забирает по 1 мане у каждого участника узла. */
export function drainsOnOverload(p: PlayerState): boolean {
  return has(p, 'devourer');
}

/** Свод: каждый выгорающий узел приносит 2 эссенции его цвета. */
export function vaultEssence(p: PlayerState, node: NodeId): { color: Color; amount: number } | null {
  return has(p, 'vault') ? { color: NODE_COLOR[node], amount: 2 } : null;
}

/* ── очки ── */

/** Летопись: +1 ПО за каждое Схождение, где взято хотя бы одно большинство. */
export function chronicleBonus(p: PlayerState, tookMajority: boolean): number {
  return tookMajority && has(p, 'chronicle') ? 1 : 0;
}

/** Радуга: полный набор даёт 8 ПО вместо 5. */
export function setPoints(p: PlayerState): number {
  return has(p, 'rainbow') ? 8 : 5;
}

/** Венец: +4 ПО в финале. */
export function finalCharmVP(p: PlayerState): number {
  return has(p, 'crown') ? 4 : 0;
}
