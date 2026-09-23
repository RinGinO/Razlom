/** Карты из §9 и §10 правил. Эффекты не реализованы — это Этап 6. */
import type { ArchmageId, CharmId, Epoch } from './types.js';

export interface CharmCard {
  id: CharmId;
  name: string;
  epoch: Epoch;
  price: number;
}

export const CHARMS: readonly CharmCard[] = [
  // Эпоха I — Основания
  { id: 'apprentice',    name: 'Ученик',          epoch: 1, price: 3 },
  { id: 'spring',        name: 'Родник',          epoch: 1, price: 3 },
  { id: 'chronicle',     name: 'Летопись',        epoch: 1, price: 3 },
  { id: 'reservoir',     name: 'Резервуар',       epoch: 1, price: 4 },
  { id: 'compass',       name: 'Компас',          epoch: 1, price: 4 },
  { id: 'lesser-seal',   name: 'Печать малая',    epoch: 1, price: 4 },
  { id: 'gatherer',      name: 'Собиратель',      epoch: 1, price: 5 },
  { id: 'ash-keeper',    name: 'Хранитель праха', epoch: 1, price: 5 },
  { id: 'branching',     name: 'Разветвление',    epoch: 1, price: 5 },
  { id: 'manaduct',      name: 'Мановод',         epoch: 1, price: 6 },
  // Эпоха II — Влияние
  { id: 'collusion',     name: 'Сговор',          epoch: 2, price: 5 },
  { id: 'eye',           name: 'Око',             epoch: 2, price: 6 },
  { id: 'crucible',      name: 'Тигель',          epoch: 2, price: 6 },
  { id: 'depth',         name: 'Глубина',         epoch: 2, price: 6 },
  { id: 'seal',          name: 'Печать',          epoch: 2, price: 7 },
  { id: 'mirror',        name: 'Зеркало',         epoch: 2, price: 7 },
  { id: 'brand',         name: 'Клеймо',          epoch: 2, price: 7 },
  { id: 'lightning-rod', name: 'Громоотвод',      epoch: 2, price: 8 },
  { id: 'tollman',       name: 'Мытарь',          epoch: 2, price: 8 },
  { id: 'weaver',        name: 'Ткач',            epoch: 2, price: 9 },
  // Эпоха III — Коллапс
  { id: 'pillar',        name: 'Столп',           epoch: 3, price: 8 },
  { id: 'devourer',      name: 'Пожиратель',      epoch: 3, price: 9 },
  { id: 'last-breath',   name: 'Последний вздох', epoch: 3, price: 9 },
  { id: 'abyss-anchor',  name: 'Якорь бездны',    epoch: 3, price: 10 },
  { id: 'mute-node',     name: 'Немой узел',      epoch: 3, price: 10 },
  { id: 'vault',         name: 'Свод',            epoch: 3, price: 11 },
  { id: 'druid-charm',   name: 'Друид',           epoch: 3, price: 11 },
  { id: 'harvest',       name: 'Жатва',           epoch: 3, price: 12 },
  { id: 'rainbow',       name: 'Радуга',          epoch: 3, price: 12 },
  { id: 'crown',         name: 'Венец',           epoch: 3, price: 14 },
] as const;

const BY_ID = new Map(CHARMS.map((c) => [c.id, c]));

export function charm(id: CharmId): CharmCard {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`неизвестная Чара: ${id}`);
  return c;
}

export function charmsOfEpoch(epoch: Epoch): CharmId[] {
  return CHARMS.filter((c) => c.epoch === epoch).map((c) => c.id);
}

export interface ArchmageCard {
  id: ArchmageId;
  name: string;
  /** Владыка Пустоты не раздаётся, пока Пустоты нет на поле (§9). */
  minPlayers: number;
}

export const ARCHMAGES: readonly ArchmageCard[] = [
  { id: 'pyromancer',  name: 'Пиромант',        minPlayers: 2 },
  { id: 'seer',        name: 'Провидец',        minPlayers: 2 },
  { id: 'necromancer', name: 'Некромант',       minPlayers: 2 },
  { id: 'illusionist', name: 'Иллюзионист',     minPlayers: 2 },
  { id: 'keeper',      name: 'Хранитель',       minPlayers: 2 },
  { id: 'alchemist',   name: 'Алхимик',         minPlayers: 2 },
  { id: 'druid',       name: 'Друид',           minPlayers: 2 },
  { id: 'voidlord',    name: 'Владыка Пустоты', minPlayers: 6 },
] as const;
