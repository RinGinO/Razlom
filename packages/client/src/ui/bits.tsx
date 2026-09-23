import type { ReactNode } from 'react';
import { COLOR_ORDER, NODE_COLOR, type Color, type NodeId } from '@razlom/core';
import type { HotSeat } from '../game.js';
import { playerName } from '../game.js';

export const NODE_NAME: Record<NodeId, string> = {
  fire: 'Огонь', water: 'Вода', earth: 'Земля', air: 'Воздух', void: 'Пустота',
};

export const COLOR_NAME: Record<Color, string> = {
  red: 'красная', blue: 'синяя', green: 'зелёная', white: 'белая', purple: 'фиолетовая',
};

export const COLOR_VAR: Record<Color, string> = {
  red: 'var(--fire)', blue: 'var(--water)', green: 'var(--earth)',
  white: 'var(--air)', purple: 'var(--void)',
};

export const nodeVar = (n: NodeId): string => COLOR_VAR[NODE_COLOR[n]];

export function Head({ phase, meta }: { phase: string; meta: string }) {
  return (
    <div className="head">
      <div>
        <span className="wordmark">РАЗЛОМ</span>
        <span className="phase">{phase}</span>
      </div>
      <div className="meta">{meta}</div>
    </div>
  );
}

export function Threshold({ value }: { value: number }) {
  return (
    <div className="threshold">
      <div className="label">ПОРОГ</div>
      <div className="value">{value}</div>
      <div className="hint">сумма выше — узел схлопнется</div>
    </div>
  );
}

export function Dot({ node, lit = true, size = 13 }: { node: NodeId; lit?: boolean; size?: number }) {
  return (
    <div
      className={`dot${lit ? ' lit' : ''}`}
      style={{ width: size, height: size, background: nodeVar(node), color: nodeVar(node), opacity: lit ? 1 : 0.4 }}
    />
  );
}

/**
 * Метка игрока. Имена по умолчанию — «Игрок 1», «Игрок 2»: первая буква у всех
 * одна, поэтому если имя кончается цифрой, берём её, а не первую букву.
 */
export function initial(name: string): string {
  const tail = name.trim().match(/(\d+)$/);
  return tail ? (tail[1] as string).slice(-2) : name.trim().slice(0, 1).toUpperCase();
}

export function Ava({ hs, id, me = false }: { hs: HotSeat; id: string; me?: boolean }) {
  return <div className={`ava${me ? ' me' : ''}`}>{initial(playerName(hs, id))}</div>;
}

/** Рука: эссенция по цветам, Скверна, число Чар. */
export function Hand({ hs, id }: { hs: HotSeat; id: string }) {
  const p = hs.state.players.find((x) => x.id === id);
  if (!p) return null;
  return (
    <div className="hand">
      {COLOR_ORDER.map((c) => (
        <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            className={`gem${p.essence[c] > 0 ? ' lit' : ''}`}
            style={{ background: COLOR_VAR[c], color: COLOR_VAR[c], opacity: p.essence[c] > 0 ? 1 : 0.4 }}
          />
          <span style={{ color: p.essence[c] > 0 ? 'var(--text)' : 'var(--faint)' }}>{p.essence[c]}</span>
        </span>
      ))}
      <span className="spacer" />
      <span style={{ color: 'oklch(0.74 0.13 306)' }}>Скверна {p.corruption}</span>
      <span style={{ color: 'var(--muted)' }}>Чары {p.charms.length}</span>
    </div>
  );
}

export function Gauge({ total, threshold }: { total: number; threshold: number }) {
  const max = Math.max(total, threshold) * 1.25 || 1;
  const th = (threshold / max) * 100;
  const fill = (Math.min(total, threshold) / max) * 100;
  const over = total > threshold ? ((total - threshold) / max) * 100 : 0;
  return (
    <>
      <div className="gauge">
        <div className="fill" style={{ width: `${fill}%` }} />
        {over > 0 && <div className="over" style={{ left: `${th}%`, width: `${over}%` }} />}
        <div className="mark" style={{ left: `${th}%` }} />
      </div>
      <div className="row" style={{ marginTop: 9, fontSize: 11, color: 'var(--muted)' }}>
        <span>
          сумма на узле{' '}
          <b style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 16, color: over ? 'var(--red-l)' : 'var(--text)' }}>
            {total}
          </b>
        </span>
        <span className="spacer" />
        <span>
          порог <b style={{ fontFamily: 'Cinzel, Georgia, serif', fontSize: 16, color: 'var(--amber)' }}>{threshold}</b>
        </span>
      </div>
    </>
  );
}

export function Screen({ phase, meta, children, foot }: {
  phase: string; meta: string; children: ReactNode; foot?: ReactNode;
}) {
  return (
    <div className="app">
      <Head phase={phase} meta={meta} />
      <div className="body">{children}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}

export function epochMeta(hs: HotSeat): string {
  const { epoch, round, config } = hs.state;
  return `Эпоха ${'I'.repeat(epoch)} · раунд ${round} / ${config.roundsPerEpoch * 3}`;
}
