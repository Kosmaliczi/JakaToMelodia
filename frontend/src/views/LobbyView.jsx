import { useEffect, useState } from 'react';
import { api } from '../api.js';

const HOTKEYS = ['Q', 'P', 'Z', 'M'];

export default function LobbyView({ onGameStarted }) {
  const [playlists, setPlaylists] = useState(null);
  const [selected, setSelected] = useState(null);
  const [playerNames, setPlayerNames] = useState(['', '', '', '']);
  const [rounds, setRounds] = useState(10);
  const [hostName, setHostName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const loadPlaylists = async () => {
    setError('');
    setPlaylists(null);
    try {
      const data = await api.playlists();
      setPlaylists(data);
    } catch (e) {
      setError('Błąd pobierania playlist: ' + e.message);
      setPlaylists([]);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const updatePlayerName = (index, value) => {
    setPlayerNames((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const validateCommon = () => {
    if (!selected) {
      setError('Wybierz playlistę.');
      return false;
    }
    if (!rounds || rounds < 1 || rounds > 50) {
      setError('Liczba rund musi być w zakresie 1-50.');
      return false;
    }
    return true;
  };

  const handleStart = async () => {
    setError('');
    if (!validateCommon()) return;
    const trimmed = playerNames.map((n) => n.trim()).filter(Boolean);
    if (trimmed.length < 1 || trimmed.length > 4) {
      setError('Wpisz imiona 1-4 graczy (lub użyj "Stwórz lobby" żeby gracze sami dołączyli).');
      return;
    }
    setSubmitting(true);
    try {
      const game = await api.startGame({
        playlistId: selected.id,
        playerNames: trimmed,
        totalRounds: Number(rounds),
      });
      onGameStarted(game);
    } catch (e) {
      setError('Błąd startu gry: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLobby = async () => {
    setError('');
    if (!validateCommon()) return;
    const trimmedHost = hostName.trim();
    if (trimmedHost && (trimmedHost.length < 2 || trimmedHost.length > 20)) {
      setError('Twój nick musi mieć 2-20 znaków (lub zostaw puste, by być tylko MC).');
      return;
    }
    setSubmitting(true);
    try {
      const game = await api.createLobby({
        playlistId: selected.id,
        totalRounds: Number(rounds),
        hostName: trimmedHost || undefined,
      });
      onGameStarted(game);
    } catch (e) {
      setError('Błąd tworzenia lobby: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            1. Wybierz playlistę
          </h2>
          <button className="btn" onClick={loadPlaylists} disabled={playlists === null}>
            Odśwież
          </button>
        </div>
        <PlaylistList
          playlists={playlists}
          selectedId={selected?.id}
          onSelect={setSelected}
        />
        {selected && (
          <p className="mt-3 text-sm text-slate-400">
            Wybrana: <span className="font-medium text-slate-100">{selected.name}</span>
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          2. Gracze (1-4) — tylko dla single-device
        </h2>
        <div className="space-y-2">
          {HOTKEYS.map((key, idx) => (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 text-sm text-slate-400">Hotkey:</span>
              <kbd className="rounded bg-ink-400 px-2 py-1 font-mono text-xs">{key}</kbd>
              <input
                className="input flex-1"
                placeholder={`Imię gracza ${idx + 1}${idx >= 2 ? ' (opcjonalnie)' : ''}`}
                value={playerNames[idx]}
                onChange={(e) => updatePlayerName(idx, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          3. Liczba rund
        </h2>
        <input
          type="number"
          className="input max-w-[120px]"
          min={1}
          max={50}
          value={rounds}
          onChange={(e) => setRounds(e.target.value)}
        />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          4. Lobby (dla trybu multi-device)
        </h2>
        <label className="mb-1 block text-xs text-slate-500">
          Twój nick (gdy chcesz grać razem z innymi z lobby)
        </label>
        <input
          className="input"
          placeholder="np. Mateusz — pusty = host jest tylko MC"
          maxLength={20}
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
        <p className="mt-2 text-[11px] text-slate-500">
          Twój hotkey w grze: <kbd className="kbd">Q</kbd>. Pozostali gracze dołączą po 6-znakowym kodzie z telefonu.
        </p>
      </div>

      <div className="card space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className="btn btn-primary btn-big w-full"
            onClick={handleStart}
            disabled={submitting}
          >
            {submitting ? 'Uruchamiam…' : 'Rozpocznij grę'}
          </button>
          <button
            className="btn btn-big w-full"
            onClick={handleCreateLobby}
            disabled={submitting}
            title="Stwórz pokój, do którego dołączą gracze z innych urządzeń"
          >
            {submitting ? '…' : 'Stwórz lobby'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          „Rozpocznij grę" — single-device z hotkeyami Q/P/Z/M (z sekcji 2). „Stwórz lobby" — gracze dołączają z telefonów po 6-znakowym kodzie, host gra jeśli wpisał nick w sekcji 4.
        </p>
        {error && (
          <div className="mt-3">
            <p className="text-sm text-red-400">{error}</p>
            <button
              className="btn mt-2 text-xs"
              onClick={async () => {
                setDiagLoading(true);
                try {
                  setDiag(await api.diagnostics(selected?.id));
                } catch (e) {
                  setDiag({ error: e.message });
                } finally {
                  setDiagLoading(false);
                }
              }}
            >
              {diagLoading ? 'Diagnozuję…' : 'Uruchom diagnostykę tokenu'}
            </button>
            {diag && (
              <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-ink-800 p-3 text-[11px] leading-relaxed text-slate-300">
                {JSON.stringify(diag, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaylistList({ playlists, selectedId, onSelect }) {
  if (playlists === null) {
    return <p className="text-sm text-slate-400">Ładuję playlisty…</p>;
  }
  if (playlists.length === 0) {
    return <p className="text-sm text-slate-400">Brak playlist na koncie.</p>;
  }
  return (
    <>
      <ul className="max-h-72 divide-y divide-ink-500 overflow-y-auto rounded-lg border border-ink-500">
        {playlists.map((p) => {
          const isSelected = p.id === selectedId;
          return (
            <li
              key={p.id}
              className={
                'flex cursor-pointer items-center gap-3 px-3 py-2 transition ' +
                (isSelected
                  ? 'bg-spotify/20 ring-1 ring-spotify'
                  : 'hover:bg-ink-500')
              }
              onClick={() => onSelect(p)}
            >
              {p.coverUrl ? (
                <img src={p.coverUrl} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="h-10 w-10 rounded bg-ink-400" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  {p.name}
                  {p.spotifyOwned && (
                    <span
                      className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300"
                      title="Playlista Spotify – w trybie Development zwraca 403"
                    >
                      Spotify
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  {p.trackCount} {p.trackCount === 1 ? 'utwór' : 'utworów'}
                  {p.ownerName && p.ownerName !== p.ownerId && (
                    <span className="ml-2 text-slate-500">• {p.ownerName}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-slate-500">
        Tip: aplikacja w trybie <span className="font-mono">Development</span> nie ma dostępu do
        playlist tworzonych przez Spotify (Discover Weekly, Daily Mix itp.). Wybierz własną.
      </p>
    </>
  );
}
