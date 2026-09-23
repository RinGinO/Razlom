import { useState } from 'react';
import {
  advanceStage, createHotSeat, pickArchmage, skipAnimation, submitBuilding, submitWeaving,
  type HotSeat,
} from './game.js';
import {
  Building, Convergence, Draft, Final, Pass, Resonance, Reveal, Setup, Upkeep, Weaving,
} from './ui/screens.js';

export default function App() {
  const [hs, setHs] = useState<HotSeat | null>(null);

  if (!hs) {
    return <Setup onStart={(names, rpe) => setHs(createHotSeat(names, rpe, Date.now() >>> 0))} />;
  }

  const s = hs.stage;
  switch (s.k) {
    case 'pass':
      return <Pass hs={hs} seat={s.seat} onReady={() => setHs(advanceStage(hs))} />;
    case 'draft':
      return <Draft hs={hs} seat={s.seat} onPick={(a) => setHs(pickArchmage(hs, s.seat, a))} />;
    case 'weaving':
      return <Weaving hs={hs} seat={s.seat} onSubmit={(a) => setHs(submitWeaving(hs, s.seat, a))} />;
    case 'reveal':
      return <Reveal hs={hs} onNext={() => setHs(advanceStage(hs))} onSkip={() => setHs(skipAnimation(hs))} />;
    case 'resonance':
      return <Resonance hs={hs} step={s.step} onNext={() => setHs(advanceStage(hs))} onSkip={() => setHs(skipAnimation(hs))} />;
    case 'upkeep':
      return <Upkeep hs={hs} onNext={() => setHs(advanceStage(hs))} />;
    case 'building':
      return <Building hs={hs} seat={s.seat} onSubmit={(a) => setHs(submitBuilding(hs, s.seat, a))} />;
    case 'convergence':
      return <Convergence hs={hs} onNext={() => setHs(advanceStage(hs))} />;
    case 'final':
      return <Final hs={hs} onRestart={() => setHs(null)} />;
    default:
      return null;
  }
}
