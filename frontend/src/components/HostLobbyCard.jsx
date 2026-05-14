import { useMemo, useState } from 'react';

export default function HostLobbyCard({ state, onStart }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const players = state.players || [];
  const allReady = players.length > 0 && players.every((p) => p.ready);
  const joinUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    return `${origin}/join?code=${state.roomCode}`;
  }, [state.roomCode]);

  const handleStart = async () => {
    setError('');
    setBusy(true);
    try {
      await onStart();
    } catch (e) {
      setError(e.message || 'Błąd startu gry');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (typeof navigator?.clipboard?.writeText !== 'function') return;
    navigator.clipboard.writeText(state.roomCode).catch(() => {});
  };

  return (
    <section className="card relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-spotify/20 blur-3xl" />
      <div className="relative grid gap-6 md:grid-cols-[auto,1fr]">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-ink-950/70 px-6 py-5 text-center">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">
            Kod pokoju
          </span>
          <button
            onClick={copyCode}
            className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-gradient-spotify transition hover:opacity-80"
            title="Kliknij, aby skopiować"
          >
            {state.roomCode}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Wejdź na <span className="font-mono text-slate-300">/join</span>
          </p>
          {joinUrl && (
            <p className="mt-1 break-all text-[10px] text-slate-600">{joinUrl}</p>
          )}
        </div>

        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-spotify opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-spotify" />
            </span>
            <span className="text-xs uppercase tracking-wider text-spotify-light">
              Lobby otwarte
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold">
            Czekamy na graczy…
          </h2>
          <p className="text-sm text-slate-400">
            {players.length === 0
              ? 'Podyktuj kod, a gracze dołączą z telefonów.'
              : `${players.filter((p) => p.ready).length} / ${players.length} gotowych`}
          </p>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {players.length === 0 && (
              <li className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-center text-xs text-slate-500">
                Brak graczy
              </li>
            )}
            {players.map((p) => (
              <li
                key={p.id}
                className={
                  'flex items-center justify-between rounded-xl px-3 py-2 ring-1 ' +
                  (p.ready
                    ? 'bg-spotify/10 ring-spotify/40'
                    : 'bg-white/[0.04] ring-white/5')
                }
              >
                <span className="flex items-center gap-2">
                  <kbd className="kbd">{p.hotkey}</kbd>
                  <span className="text-sm">{p.name}</span>
                </span>
                <span
                  className={
                    'text-xs font-semibold uppercase tracking-wider ' +
                    (p.ready ? 'text-spotify-light' : 'text-slate-500')
                  }
                >
                  {p.ready ? 'gotowy' : 'czeka'}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              className="btn btn-primary btn-big flex-1"
              onClick={handleStart}
              disabled={busy || !allReady}
              title={
                !allReady
                  ? players.length === 0
                    ? 'Dołącz co najmniej jednego gracza'
                    : 'Wszyscy gracze muszą kliknąć "Gotowy"'
                  : ''
              }
            >
              {busy
                ? 'Startuję…'
                : !allReady
                ? players.length === 0
                  ? 'Czekam na graczy'
                  : 'Czekam aż wszyscy będą gotowi'
                : 'Rozpocznij grę'}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </section>
  );
}
