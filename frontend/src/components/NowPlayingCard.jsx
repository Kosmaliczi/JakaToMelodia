import { useEffect, useState } from 'react';
import StatusPill from './StatusPill.jsx';

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingCard({ state, sdkBadge }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setElapsedMs(0);
  }, [state.currentRound]);

  useEffect(() => {
    if (state.status !== 'PLAYING') return;
    const id = setInterval(() => setElapsedMs((e) => e + 200), 200);
    return () => clearInterval(id);
  }, [state.status]);

  const isPlaying = state.status === 'PLAYING';
  const revealed = state.status === 'REVEAL' || state.status === 'FINISHED';
  const cover = state.revealedTrack?.coverUrl;
  const progressPct = Math.min(100, (elapsedMs / 30000) * 100);

  return (
    <section className="card relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={
          cover
            ? {
                background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%), url(${cover}) center/cover`,
                filter: 'blur(24px)',
              }
            : undefined
        }
      />
      <div className="relative flex items-center gap-5">
        <Artwork isPlaying={isPlaying} cover={revealed ? cover : null} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <StatusPill status={state.status} />
            <span className="text-xs uppercase tracking-wider text-slate-400">
              Runda {state.currentRound} / {state.totalRounds}
            </span>
          </div>
          <h2 className="truncate text-2xl font-bold leading-tight">
            {revealed && state.revealedTrack
              ? state.revealedTrack.title
              : isPlaying
              ? 'Słuchaj uważnie…'
              : 'Tura zgadywania'}
          </h2>
          <p className="truncate text-sm text-slate-400">
            {revealed && state.revealedTrack
              ? state.revealedTrack.artist
              : isPlaying
              ? 'Wciśnij swój hotkey, gdy już wiesz'
              : 'Wpisz tytuł lub wykonawcę'}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="font-mono text-lg tabular-nums text-spotify-light">
              {formatTime(elapsedMs)}
            </span>
            <ProgressBar pct={progressPct} active={isPlaying} />
          </div>
          {sdkBadge && <div className="mt-2 text-xs text-amber-300">{sdkBadge}</div>}
        </div>
      </div>
    </section>
  );
}

function Artwork({ isPlaying, cover }) {
  return (
    <div className="relative h-24 w-24 shrink-0 sm:h-32 sm:w-32">
      <div
        className={
          'absolute inset-0 overflow-hidden rounded-full ring-2 ring-white/10 ' +
          (isPlaying ? 'animate-spin-slow' : '')
        }
      >
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="vinyl h-full w-full" />
        )}
        <div className="absolute inset-0 m-auto h-4 w-4 rounded-full bg-ink-900 ring-2 ring-white/20" />
      </div>
      {isPlaying && (
        <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-spotify text-ink-950 shadow-[0_0_18px_rgba(29,185,84,0.55)]">
          <Equalizer />
        </div>
      )}
    </div>
  );
}

function Equalizer() {
  return (
    <div className="flex h-4 items-end gap-[2px]">
      <span className="eq-bar h-full bg-ink-950 animate-eq1" />
      <span className="eq-bar h-full bg-ink-950 animate-eq2" />
      <span className="eq-bar h-full bg-ink-950 animate-eq3" />
      <span className="eq-bar h-full bg-ink-950 animate-eq4" />
    </div>
  );
}

function ProgressBar({ pct, active }) {
  return (
    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
      <div
        className={
          'absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-linear ' +
          (active ? 'bg-spotify' : 'bg-slate-500')
        }
        style={{ width: pct + '%' }}
      />
    </div>
  );
}
