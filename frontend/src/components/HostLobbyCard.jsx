import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';

export default function HostLobbyCard({ state, onStart }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lanAddresses, setLanAddresses] = useState([]);
  const [selectedAddrIdx, setSelectedAddrIdx] = useState(0);

  const players = state.players || [];
  const allReady = players.length > 0 && players.every((p) => p.ready);
  const port = typeof window !== 'undefined' ? window.location.port || '80' : '8080';

  useEffect(() => {
    let cancelled = false;
    api.lanAddresses()
      .then((res) => {
        if (cancelled) return;
        setLanAddresses(res.addresses || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const joinUrls = useMemo(() => {
    return lanAddresses.map((ip) =>
      `http://${ip}:${port}/join?code=${state.roomCode}`
    );
  }, [lanAddresses, port, state.roomCode]);

  const selectedUrl = joinUrls[selectedAddrIdx] || '';

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

  const copyUrl = () => {
    if (typeof navigator?.clipboard?.writeText !== 'function' || !selectedUrl) return;
    navigator.clipboard.writeText(selectedUrl).catch(() => {});
  };

  return (
    <section className="card relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-spotify/20 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[auto,1fr]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-ink-950/70 px-6 py-5 text-center">
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
              <span className="font-mono text-slate-300">/join</span>
            </p>
          </div>

          {selectedUrl && (
            <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white p-3">
              <QRCodeSVG
                value={selectedUrl}
                size={144}
                bgColor="#ffffff"
                fgColor="#0a0c10"
                level="M"
                includeMargin={false}
              />
            </div>
          )}

          {joinUrls.length > 0 ? (
            <div className="w-full max-w-[180px] text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                Skanuj telefonem
              </p>
              <button
                onClick={copyUrl}
                className="mt-1 block w-full break-all rounded-md px-2 py-1 text-center font-mono text-[10px] text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                title="Kliknij, aby skopiować URL"
              >
                {selectedUrl}
              </button>
              {joinUrls.length > 1 && (
                <select
                  className="mt-1 w-full rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-[10px] text-slate-300"
                  value={selectedAddrIdx}
                  onChange={(e) => setSelectedAddrIdx(Number(e.target.value))}
                >
                  {lanAddresses.map((ip, idx) => (
                    <option key={ip} value={idx}>{ip}</option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <p className="text-center text-[10px] text-slate-500 max-w-[180px]">
              Nie wykryłem LAN IP — wejdź na adres serwera z /join ręcznie.
            </p>
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
              ? 'Podyktuj kod lub każ skanować QR — gracze dołączą.'
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
