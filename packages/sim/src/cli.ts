/**
 * CLI симуляции баланса.
 *   pnpm sim --players 8 --rounds-per-epoch 6 --games 10000 --policy heuristic
 */
import { parseArgs } from 'node:util';
import { CHARMS, charm } from '@razlom/core';
import { policyByName } from './policy.js';
import { playGame } from './play.js';
import { aggregate, type Report } from './metrics.js';

const { values } = parseArgs({
  options: {
    players: { type: 'string', default: '6' },
    'rounds-per-epoch': { type: 'string', default: '6' },
    games: { type: 'string', default: '2000' },
    policy: { type: 'string', default: 'heuristic' },
    'buy-rate': { type: 'string', default: '0.25' },
    risk: { type: "string", default: "0.4" },
    seed: { type: 'string', default: '1' },
    json: { type: 'boolean', default: false },
  },
});

const players = Number(values.players);
const rpe = Number(values['rounds-per-epoch']) as 4 | 6 | 8;
const games = Number(values.games);
const buyRate = Number(values['buy-rate']);
const baseSeed = Number(values.seed);
const risk = Number(values.risk);

if (![4, 6, 8].includes(rpe)) throw new Error('--rounds-per-epoch: 4, 6 или 8');
if (players < 2 || players > 8) throw new Error('--players: от 2 до 8');

const policy = policyByName(values.policy as string, buyRate, risk);
const t0 = Date.now();
const obs = Array.from({ length: games }, (_, i) => playGame(players, rpe, policy, baseSeed + i));
const report = aggregate(obs, policy.name, buyRate);
const ms = Date.now() - t0;

if (values.json) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const mark = (ok: boolean) => (ok ? '  ок ' : ' мимо');

function line(label: string, value: string) {
  console.log(`  ${label.padEnd(34)} ${value}`);
}

console.log(`\nРАЗЛОМ · симуляция баланса`);
console.log(`  ${games} партий · ${players} игроков · ${rpe} раундов в эпохе · политика ${policy.name} · риск ${risk} · ${ms} мс\n`);

console.log('Очки');
line('среднее', report.score.mean.toFixed(1));
line('станд. отклонение', report.score.sd.toFixed(1));
line('от / до', `${report.score.min} … ${report.score.max}`);
line('коридор 10–90%', `${report.score.p10} … ${report.score.p90} (ширина ${report.score.spread})`);

console.log('\nПерегрузки по эпохам');
line('Эпоха I   (цель ≈10%)', pct(report.overloadRate[0]));
line('Эпоха II  (цель ≈25%)', pct(report.overloadRate[1]));
line('Эпоха III (цель ≈45%)', pct(report.overloadRate[2]));

console.log('\nСкверна и коллапс');
line('средняя на финиш (цель 1,5–2,5)', report.corruption.mean.toFixed(2));
line('доля игроков со Скверной > 4', pct(report.corruption.over4));
line('Скверна, вытекающая из перегрузок', report.impliedCorruption.toFixed(2));
line('первое выгорание, раунд', report.firstBurn.mean === null ? '—' : report.firstBurn.mean.toFixed(1));
line('партий без единого выгорания', pct(report.firstBurn.noBurn));
line('партий, оборванных по узлам', pct(report.nodesExhausted));
line('дохода срезано пределом, за партию', report.manaBurnedPerGame.toFixed(1));

console.log('\nРанняя предопределённость');
line('корреляция Схождения I с финалом', report.convergenceCorrelation === null ? '—' : report.convergenceCorrelation.toFixed(3));

console.log('\nМеста за столом (ничьи решаются по номеру места)');
report.seatWinRate.forEach((w, i) => line(`место ${i}`, pct(w)));
line('разброс', `${(report.seatSpread * 100).toFixed(1)} п.п.`);

console.log('\nЧары — частота покупки хотя бы раз за партию');
const sorted = CHARMS.slice().sort((a, b) => (report.charmBuyRate[b.id] ?? 0) - (report.charmBuyRate[a.id] ?? 0));
for (const c of sorted.slice(0, 8)) {
  line(`${c.name} (эпоха ${c.epoch}, цена ${charm(c.id).price})`, pct(report.charmBuyRate[c.id] ?? 0));
}
console.log('  …остальные реже\n');

console.log('Итог');
for (const b of report.bands) console.log(`  [${mark(b.ok)}] ${b.label.padEnd(32)} ${b.note}`);

console.log(`
Находка: целевые показатели §11 не сходятся между собой.
  Доли перегрузок 10 / 25 / 45 % при ${rpe} раундах в эпохе сами по себе дают
  ${report.targetImpliedCorruption.toFixed(1)} Скверны на игрока — каждая перегрузка выдаёт по жетону всем
  участникам узла. Целевая же Скверна на финиш — 1,5–2,5, то есть вдвое
  меньше. Либо доли перегрузок завышены, либо цель по Скверне занижена,
  либо перегрузка не должна выдавать жетон каждому. Это следует из правил
  и арифметики, а не из поведения агента.

Оговорки, без которых цифры выше врут:
  • Эффекты Чар и Архимагов не реализованы (Этап 6). Покупка сейчас — чистый
    убыток, поэтому частота покупок ничего не говорит о балансе карт, а на
    распределение очков покупки влияют искажающе. Для чистого замера очков
    запускайте с --buy-rate 0.
  • Винрейт по Архимагам не считается: способностей нет, все играют одним
    персонажем. Появится вместе с эффектами.
  • Зато перекос по местам за столом измерим уже сейчас: ничьи решаются
    номером места, и если разброс велик — это настоящая находка, а не шум.
`);

const failed = report.bands.filter((b) => !b.ok);
if (failed.length > 0) {
  console.log(`Вне коридора: ${failed.map((b) => b.label).join(', ')}`);
  console.log('Главная ручка — коэффициент Порога по эпохам (1,5 / 1,2 / 0,9),');
  console.log('вторая — награда за узел (2 / 3 / 5), третья — доход +3 и предел 12.\n');
}

export type { Report };
