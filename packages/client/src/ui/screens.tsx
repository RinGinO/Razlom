import { useEffect, useState } from 'react';
import {
  ARCHMAGES, CHARMS, COLOR_ORDER, NODE_ORDER, charm, corruptionPenalty,
  type ArchmageId, type BuildingAction, type CharmId, type Color, type NodeId, type WeavingAction,
} from '@razlom/core';
import {
  playerName, type HotSeat, type ResonanceStep,
} from '../game.js';
import {
  Ava, COLOR_NAME, COLOR_VAR, Dot, Gauge, Hand, NODE_NAME, Screen, Threshold,
  epochMeta, initial, nodeVar,
} from './bits.js';

/* ─────────── Лобби ─────────── */

export function Setup({ onStart }: { onStart: (names: string[], rpe: 4 | 6 | 8) => void }) {
  const [names, setNames] = useState(['Игрок 1', 'Игрок 2', 'Игрок 3']);
  const [rpe, setRpe] = useState<4 | 6 | 8>(6);
  const modes: Array<[4 | 6 | 8, string, string]> = [
    [4, 'Короткий', '12 раундов'], [6, 'Стандартный', '18 раундов'], [8, 'Долгий', '24 раунда'],
  ];
  return (
    <Screen phase="Лобби" meta="хот-сит"
      foot={<button className="primary" onClick={() => onStart(names, rpe)} disabled={names.length < 2}>НАЧАТЬ ПАРТИЮ</button>}>
      <h1 className="title">Один экран на всех</h1>
      <p className="lead">
        Ставки скрытые, поэтому устройство передаётся по кругу: перед каждым игроком
        встаёт заслонка, чтобы он не увидел чужую стопку.
      </p>
      <div className="tiny" style={{ marginBottom: 7 }}>Игроки</div>
      {names.map((n, i) => (
        <div className="row" key={i} style={{ marginBottom: 8 }}>
          <div className="ava">{initial(n)}</div>
          <input value={n} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
            style={{
              flex: 1, height: 40, borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--card-dim)', color: 'var(--text)', padding: '0 12px',
              fontFamily: 'inherit', fontSize: 14,
            }} />
          {names.length > 2 && (
            <button className="ghost" onClick={() => setNames(names.filter((_, j) => j !== i))}>−</button>
          )}
        </div>
      ))}
      {names.length < 8 && (
        <button className="ghost" style={{ width: '100%', marginBottom: 14 }}
          onClick={() => setNames([...names, `Игрок ${names.length + 1}`])}>
          Добавить игрока
        </button>
      )}
      <div className="tiny" style={{ marginBottom: 7 }}>Режим</div>
      <div className="row" style={{ gap: 8 }}>
        {modes.map(([v, label, sub]) => (
          <button key={v} onClick={() => setRpe(v)}
            className={rpe === v ? 'panel pick' : 'panel'}
            style={{ flex: 1, marginBottom: 0, textAlign: 'center', color: 'var(--text)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{sub}</div>
          </button>
        ))}
      </div>
    </Screen>
  );
}

/* ─────────── Заслонка ─────────── */

export function Pass({ hs, seat, onReady }: { hs: HotSeat; seat: number; onReady: () => void }) {
  const id = hs.state.players[seat]?.id ?? 'p0';
  return (
    <Screen phase="Передача" meta={epochMeta(hs)}>
      <div className="curtain">
        <div className="tiny">устройство переходит к</div>
        <div className="who">{playerName(hs, id)}</div>
        <p className="lead" style={{ maxWidth: 280 }}>
          Остальные не смотрят на экран. Ставка скрыта до общего вскрытия.
        </p>
        <button className="primary" style={{ maxWidth: 260 }} onClick={onReady}>Я готов</button>
      </div>
    </Screen>
  );
}

/* ─────────── Драфт ─────────── */

export function Draft({ hs, seat, onPick }: { hs: HotSeat; seat: number; onPick: (a: ArchmageId) => void }) {
  const [sel, setSel] = useState<ArchmageId | null>(null);
  const id = hs.state.players[seat]?.id ?? 'p0';
  const hand = hs.drafts[seat] ?? [];
  return (
    <Screen phase="Драфт" meta={playerName(hs, id)}
      foot={<button className="primary" disabled={!sel} onClick={() => sel && onPick(sel)}>ВЗЯТЬ АРХИМАГА</button>}>
      <h1 className="title">Выберите архимага</h1>
      <p className="lead">Три случайных из восьми. Двое могут взять одного и того же.</p>
      {hand.map((a) => {
        const card = ARCHMAGES.find((x) => x.id === a);
        return (
          <button key={a} onClick={() => setSel(a)}
            className={sel === a ? 'panel pick' : 'panel'}
            style={{ width: '100%', textAlign: 'left', color: 'var(--text)' }}>
            <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 18, fontWeight: 700 }}>{card?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
              Способности появятся на Этапе 6 — сейчас персонаж только выбирается.
            </div>
          </button>
        );
      })}
    </Screen>
  );
}

/* ─────────── Плетение ─────────── */

export function Weaving({ hs, seat, onSubmit }: {
  hs: HotSeat; seat: number; onSubmit: (a: WeavingAction) => void;
}) {
  const p = hs.state.players[seat];
  const [stacks, setStacks] = useState<Partial<Record<NodeId, number>>>({});
  const [abyss, setAbyss] = useState(0);
  useEffect(() => { setStacks({}); setAbyss(0); }, [seat, hs.state.round]);
  if (!p) return null;

  const active = NODE_ORDER.filter((n) => hs.state.nodes.some((x) => x.id === n && x.active));
  const placed = Object.values(stacks).reduce<number>((s, v) => s + (v ?? 0), 0);
  const budget = p.mana + 2 * abyss - placed;
  const bump = (n: NodeId, d: number) => {
    const cur = stacks[n] ?? 0;
    const next = Math.max(0, cur + d);
    if (d > 0 && budget <= 0) return;
    setStacks({ ...stacks, [n]: next });
  };

  return (
    <Screen phase="Плетение" meta={`${playerName(hs, p.id)} · ${epochMeta(hs)}`}
      foot={
        <>
          <button className="dashed" style={{ marginBottom: 10 }} onClick={() => setAbyss(abyss + 1)}>
            Черпнуть из бездны · +2 маны за 1 Скверну{abyss > 0 ? ` (взято ${abyss})` : ''}
          </button>
          <div className="mana-row">
            <div>
              <div className="tiny">Мана</div>
              <div className="row" style={{ alignItems: 'baseline', gap: 3 }}>
                <span className="mana-num">{budget}</span>
                <span className="cap">/ {p.mana + 2 * abyss}</span>
              </div>
            </div>
            <button className="primary" style={{ flex: 1 }}
              onClick={() => onSubmit({
                kind: 'weaving', playerId: p.id, stacks,
                corruptionTaken: abyss, standingOrders: [], exchanges: [], targeted: [],
              })}>
              ГОТОВО
            </button>
          </div>
        </>
      }>
      <Threshold value={hs.state.threshold} />
      {active.map((n) => {
        const v = stacks[n] ?? 0;
        const emp = hs.state.nodes.find((x) => x.id === n)?.empowered;
        return (
          <div className="node" key={n}>
            <Dot node={n} lit={v > 0} />
            <span className="name">{NODE_NAME[n]}</span>
            {emp && <span className="badge">×2</span>}
            <button className="step" disabled={v === 0} onClick={() => bump(n, -1)}>−</button>
            <span className={`amount${v === 0 ? ' zero' : ''}`}>{v}</span>
            <button className="step plus" disabled={budget <= 0} onClick={() => bump(n, 1)}>+</button>
          </div>
        );
      })}
      <Hand hs={hs} id={p.id} />
    </Screen>
  );
}

/* ─────────── Раскрытие ─────────── */

export function Reveal({ hs, onNext, onSkip }: { hs: HotSeat; onNext: () => void; onSkip: () => void }) {
  return (
    <Screen phase="Раскрытие" meta={epochMeta(hs)}
      foot={
        <div className="row">
          <button className="ghost" onClick={onSkip}>Пропустить</button>
          <span className="spacer" />
          <button className="primary" style={{ width: 180 }} onClick={onNext}>РЕЗОНАНС →</button>
        </div>
      }>
      <h1 className="title">Стопки вскрыты</h1>
      <p className="lead">Порог этого раунда — {hs.state.threshold}.</p>
      {hs.steps.map((s) => (
        <div className="panel" key={s.node} style={s.overloaded ? { borderColor: 'oklch(0.40 0.11 30)' } : undefined}>
          <div className="row">
            <Dot node={s.node} />
            <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 15, fontWeight: 600 }}>
              {NODE_NAME[s.node]}
            </span>
            <span className="spacer" />
            <span style={{
              fontFamily: 'Cinzel, Georgia, serif', fontSize: 20, fontWeight: 700,
              color: s.overloaded ? 'var(--red-l)' : 'var(--text)',
            }}>{s.total}</span>
            <span style={{ fontSize: 10, color: s.overloaded ? 'var(--red-l)' : 'var(--muted)' }}>
              {s.overloaded ? `› ${s.threshold}` : `из ${s.threshold}`}
            </span>
          </div>
          <div style={{ height: 1, background: 'oklch(0.28 0.03 288)', margin: '7px 0 5px' }} />
          {s.stacks.map((c) => (
            <div className="row" key={c.playerId} style={{ height: 26 }}>
              <Ava hs={hs} id={c.playerId} />
              <span style={{ fontSize: 12.5 }}>{playerName(hs, c.playerId)}</span>
              <span className="spacer" />
              <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 15, fontWeight: 700 }}>{c.mana}</span>
            </div>
          ))}
        </div>
      ))}
      {hs.steps.length === 0 && <p className="lead">В этом раунде никто не выложил ни одной маны.</p>}
    </Screen>
  );
}

/* ─────────── Резонанс ─────────── */

export function Resonance({ hs, step, onNext, onSkip }: {
  hs: HotSeat; step: number; onNext: () => void; onSkip: () => void;
}) {
  const s = hs.steps[step] as ResonanceStep | undefined;
  if (!s) return null;
  const next = hs.steps[step + 1];
  return (
    <Screen phase="Резонанс" meta={epochMeta(hs)}
      foot={
        <div className="row">
          <button className="ghost" onClick={onSkip}>Пропустить</button>
          <span className="spacer" />
          <button className="primary" style={{ width: 200 }} onClick={onNext}>
            {next ? `ДАЛЬШЕ: ${NODE_NAME[next.node].toUpperCase()}` : 'К ВОЗВРАТУ'}
          </button>
        </div>
      }>
      <div className="row" style={{ gap: 6, padding: '4px 0 12px' }}>
        {hs.steps.map((x, i) => (
          <div key={x.node} style={{
            flex: 1, height: 44, borderRadius: 10, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            background: i === step ? 'linear-gradient(oklch(0.30 0.07 68), oklch(0.22 0.05 66))' : 'oklch(0.175 0.026 288)',
            border: `1px solid ${i === step ? 'oklch(0.64 0.13 72)' : 'oklch(0.25 0.03 288)'}`,
          }}>
            <Dot node={x.node} lit={i <= step} size={9} />
            <span style={{ fontSize: 8.5, color: i === step ? 'var(--amber)' : 'var(--faint)' }}>
              {NODE_NAME[x.node]}
            </span>
          </div>
        ))}
      </div>

      <div className="center" style={{ padding: '14px 0 20px', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: '50%', top: 60, transform: 'translate(-50%,-50%)',
          width: 300, height: 150, pointerEvents: 'none', borderRadius: '50%',
          background: `radial-gradient(ellipse, ${s.overloaded ? 'var(--red)' : nodeVar(s.node)} 0%, transparent 66%)`,
          opacity: 0.26,
        }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <Dot node={s.node} size={72} />
        </div>
        <div style={{
          position: 'relative', fontFamily: 'Cinzel, Georgia, serif', fontSize: 32,
          fontWeight: 700, letterSpacing: '.06em', marginTop: 10,
        }}>{NODE_NAME[s.node]}</div>
      </div>

      <Gauge total={s.total} threshold={s.threshold} />

      {s.overloaded ? (
        <div className="panel warn" style={{ marginTop: 24 }}>
          <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 19, fontWeight: 700, color: 'var(--red-l)' }}>
            ПЕРЕГРУЗКА
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.4, color: 'oklch(0.80 0.04 30)', marginTop: 6 }}>
            Узел схлопнулся. Эссенцию не получает никто, а Скверну берут все, кто на нём стоял.
            {s.burned && ' Узел выгорел — он ушёл с поля навсегда.'}
          </div>
        </div>
      ) : (
        <div className="panel good" style={{ marginTop: 24 }}>
          <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 19, fontWeight: 700, color: 'oklch(0.88 0.13 148)' }}>
            {s.total === s.threshold ? 'УЗЕЛ УСТОЯЛ' : 'УЗЕЛ ВЗЯТ'}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.4, color: 'oklch(0.82 0.04 152)', marginTop: 6 }}>
            {s.total === s.threshold
              ? 'Сумма ровно равна Порогу — это ещё не перегрузка.'
              : `Эссенция ${COLOR_NAME[s.color]} уходит победителю.`}
          </div>
        </div>
      )}

      <div className="tiny" style={{ marginTop: 14, marginBottom: 6 }}>
        {s.overloaded ? 'Последствия' : 'Награда'}
      </div>
      {s.overloaded
        ? s.corrupted.map((id) => (
            <div className="row" key={id} style={{ height: 36 }}>
              <Ava hs={hs} id={id} />
              <span style={{ fontSize: 13 }}>{playerName(hs, id)}</span>
              <span className="spacer" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red-l)' }}>+1 Скверна</span>
            </div>
          ))
        : s.gains.map((g, i) => (
            <div className="row" key={`${g.playerId}-${i}`} style={{ height: 36 }}>
              <Ava hs={hs} id={g.playerId} />
              <span style={{ fontSize: 13 }}>{playerName(hs, g.playerId)}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {g.reason === 'first' ? 'первое место' : 'второе место'}
              </span>
              <span className="spacer" />
              <span style={{ fontSize: 13, fontWeight: 600, color: COLOR_VAR[s.color] }}>
                +{g.amount} {COLOR_NAME[s.color]}
              </span>
            </div>
          ))}
    </Screen>
  );
}

/* ─────────── Возврат ─────────── */

export function Upkeep({ hs, onNext }: { hs: HotSeat; onNext: () => void }) {
  return (
    <Screen phase="Возврат" meta={epochMeta(hs)}
      foot={<button className="primary" onClick={onNext}>К СТРОИТЕЛЬСТВУ →</button>}>
      <h1 className="title">Возврат</h1>
      <div className="panel" style={{ background: 'oklch(0.20 0.045 70)', borderColor: 'oklch(0.40 0.09 70)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>
          Мана расходуется только при победе
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--muted)', marginTop: 3 }}>
          Поэтому проигрывать дёшево: отстающий копит запас и через два-три раунда продавит любой узел.
        </div>
      </div>
      {hs.upkeep.map((u) => (
        <div className="row" key={u.playerId} style={{ height: 46, borderBottom: '1px solid oklch(0.22 0.026 288)' }}>
          <Ava hs={hs} id={u.playerId} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13 }}>{playerName(hs, u.playerId)}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
              {u.spent.length > 0
                ? `сгорело ${u.spent.reduce((s, x) => s + x.amount, 0)} за ${u.spent.map((x) => NODE_NAME[x.node]).join(', ')}`
                : 'ничего не выиграно — мана вернулась целиком'}
              {u.burnedIncome > 0 && ` · предел срезал ${u.burnedIncome}`}
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'oklch(0.88 0.13 148)' }}>+{u.returned + u.income}</span>
          <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 22, fontWeight: 700, minWidth: 34, textAlign: 'right' }}>
            {u.manaAfter}
          </span>
        </div>
      ))}
    </Screen>
  );
}

/* ─────────── Строительство ─────────── */

export function Building({ hs, seat, onSubmit }: {
  hs: HotSeat; seat: number; onSubmit: (a: BuildingAction) => void;
}) {
  const p = hs.state.players[seat];
  const [pickId, setPickId] = useState<CharmId | null>(null);
  const [overbid, setOverbid] = useState(0);
  const [pay, setPay] = useState<Partial<Record<Color, number>>>({});
  useEffect(() => { setPickId(null); setOverbid(0); setPay({}); }, [seat, hs.state.round]);
  if (!p) return null;

  const total = pickId ? charm(pickId).price + overbid : 0;
  const paid = COLOR_ORDER.reduce((s, c) => s + (pay[c] ?? 0), 0);
  const left = total - paid;
  const bumpPay = (c: Color, d: number) => {
    const cur = pay[c] ?? 0;
    const next = Math.max(0, Math.min(p.essence[c], cur + d));
    if (d > 0 && left <= 0) return;
    setPay({ ...pay, [c]: next });
  };
  const canBuy = pickId !== null && left === 0;

  return (
    <Screen phase="Строительство" meta={`${playerName(hs, p.id)} · ${epochMeta(hs)}`}
      foot={
        <div className="row">
          <button className="ghost"
            onClick={() => onSubmit({ kind: 'building', playerId: p.id, pick: null, consolationColor: 'red', exchanges: [] })}>
            Пасовать
          </button>
          <span className="spacer" />
          <button className="primary" style={{ width: 150 }} disabled={!canBuy}
            onClick={() => pickId && onSubmit({
              kind: 'building', playerId: p.id, consolationColor: 'red', exchanges: [],
              pick: { charmId: pickId, overbid, pay },
            })}>
            ГОТОВО
          </button>
        </div>
      }>
      <div className="panel">
        <div className="row">
          <span className="tiny">Ваша эссенция</span>
          <span className="spacer" />
          <Hand hs={hs} id={p.id} />
        </div>
        <div style={{ fontSize: 10.5, lineHeight: 1.35, color: 'oklch(0.74 0.09 40)', marginTop: 4 }}>
          Потраченная эссенция не считается на Схождении — покупка стоит вам большинства.
        </div>
      </div>

      <div className="tiny" style={{ margin: '4px 0 6px' }}>Рынок · {hs.state.market.length} карт</div>
      <div className="grid2">
        {hs.state.market.map((id) => {
          const c = CHARMS.find((x) => x.id === id);
          const afford = COLOR_ORDER.reduce((s, col) => s + p.essence[col], 0) >= (c?.price ?? 0);
          return (
            <button key={id} onClick={() => { setPickId(id); setOverbid(0); setPay({}); }}
              disabled={!afford}
              className={pickId === id ? 'panel pick' : 'panel'}
              style={{ textAlign: 'left', color: 'var(--text)', opacity: afford ? 1 : 0.45, minHeight: 92 }}>
              <div className="row">
                <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 14, fontWeight: 700, flex: 1 }}>
                  {c?.name}
                </span>
                <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 16, fontWeight: 700, color: 'var(--amber)' }}>
                  {c?.price}
                </span>
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--faint)', marginTop: 5 }}>
                эффект — Этап 6
              </div>
            </button>
          );
        })}
      </div>

      {pickId && (
        <div className="panel pick" style={{ marginTop: 12 }}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div className="tiny">Берёте</div>
              <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 17, fontWeight: 700 }}>
                {CHARMS.find((x) => x.id === pickId)?.name} <span style={{ fontSize: 12, color: 'var(--muted)' }}>· цена {charm(pickId).price}</span>
              </div>
            </div>
            <div className="center">
              <div className="tiny">надбавка</div>
              <div style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 18, fontWeight: 700, color: 'var(--amber)' }}>
                +{overbid}
              </div>
            </div>
            <button className="step" disabled={overbid === 0} onClick={() => setOverbid(overbid - 1)}>−</button>
            <button className="step plus" onClick={() => setOverbid(overbid + 1)}>+</button>
          </div>
          <div style={{ height: 1, background: 'oklch(0.34 0.05 70)', margin: '10px 0 8px' }} />
          <div className="tiny" style={{ marginBottom: 6 }}>
            Чем платите — осталось внести {left}
          </div>
          {COLOR_ORDER.filter((c) => p.essence[c] > 0).map((c) => (
            <div className="row" key={c} style={{ height: 40 }}>
              <span className="gem lit" style={{ background: COLOR_VAR[c], color: COLOR_VAR[c] }} />
              <span style={{ fontSize: 12.5, flex: 1 }}>{COLOR_NAME[c]} · есть {p.essence[c]}</span>
              <button className="step" style={{ width: 36, height: 36, fontSize: 18 }}
                disabled={(pay[c] ?? 0) === 0} onClick={() => bumpPay(c, -1)}>−</button>
              <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 18, fontWeight: 700, minWidth: 22, textAlign: 'center' }}>
                {pay[c] ?? 0}
              </span>
              <button className="step plus" style={{ width: 36, height: 36, fontSize: 18 }}
                disabled={left <= 0 || (pay[c] ?? 0) >= p.essence[c]} onClick={() => bumpPay(c, 1)}>+</button>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}

/* ─────────── Схождение ─────────── */

export function Convergence({ hs, onNext }: { hs: HotSeat; onNext: () => void }) {
  const bonus = { 1: 2, 2: 3, 3: 5 }[hs.state.epoch];
  return (
    <Screen phase="Схождение" meta={epochMeta(hs)}
      foot={<button className="primary" onClick={onNext}>
        {hs.state.epoch === 3 ? 'К ИТОГАМ →' : 'СЛЕДУЮЩАЯ ЭПОХА →'}
      </button>}>
      <h1 className="title">Схождение {'I'.repeat(hs.state.epoch)}</h1>
      <p className="lead">
        За каждый цвет — тому, у кого его больше всего прямо сейчас. По {bonus} ПО.
        Очки фиксируются, эссенция остаётся.
      </p>
      {COLOR_ORDER.map((c) => {
        const best = Math.max(...hs.state.players.map((p) => p.essence[c]));
        if (best <= 0) return null;
        const leaders = hs.state.players.filter((p) => p.essence[c] === best);
        return (
          <div className="panel" key={c}>
            <div className="row">
              <span className="gem lit" style={{ background: COLOR_VAR[c], color: COLOR_VAR[c] }} />
              <span style={{ fontSize: 12.5, width: 84 }}>{COLOR_NAME[c]}</span>
              <div className="row" style={{ flex: 1, gap: 7 }}>
                {leaders.map((p) => (
                  <span key={p.id} className="row" style={{ gap: 5 }}>
                    <Ava hs={hs} id={p.id} />
                    <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 16, fontWeight: 700, color: COLOR_VAR[c] }}>
                      {best}
                    </span>
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
                +{bonus}{leaders.length > 1 ? ' обоим' : ''}
              </span>
            </div>
          </div>
        );
      })}
      <div className="tiny" style={{ marginTop: 6, marginBottom: 6 }}>Очки после Схождения</div>
      <table className="score">
        <tbody>
          {[...hs.state.players].sort((a, b) => b.scoredVP - a.scoredVP).map((p) => (
            <tr key={p.id}>
              <td>{playerName(hs, p.id)}</td>
              <td className="num">{p.scoredVP}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Screen>
  );
}

/* ─────────── Итоги ─────────── */

export function Final({ hs, onRestart }: { hs: HotSeat; onRestart: () => void }) {
  const scores = hs.scores ?? [];
  return (
    <Screen phase="Финал" meta="партия завершена"
      foot={<button className="primary" onClick={onRestart}>НОВАЯ ПАРТИЯ</button>}>
      <h1 className="title">Итоги</h1>
      <p className="lead">
        {hs.state.round} раундов · {hs.state.players.length} архимагов
        {hs.state.nodes.some((n) => !n.active) && ' · поле схлопнулось до срока'}
      </p>
      {scores.map((s, i) => (
        <div className="panel" key={s.playerId} style={i === 0 ? { borderColor: 'oklch(0.62 0.13 72)' } : undefined}>
          <div className="row">
            <span style={{ width: 18, color: 'var(--faint)', fontSize: 12 }}>{i + 1}</span>
            <Ava hs={hs} id={s.playerId} me={i === 0} />
            <span style={{ flex: 1, fontSize: 14 }}>{playerName(hs, s.playerId)}</span>
            <span style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 26, fontWeight: 700 }}>{s.total}</span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
            эссенция {s.essence} · Схождения {s.convergences} · наборы {s.sets}×5
            {s.penalty > 0 && (
              <span style={{ color: 'var(--red-l)' }}>
                {' '}· Скверна {s.corruption} → −{corruptionPenalty(s.corruption)}
              </span>
            )}
          </div>
        </div>
      ))}
    </Screen>
  );
}
