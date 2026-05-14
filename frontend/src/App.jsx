import { useEffect, useState } from 'react';
import { api } from './api.js';
import LoginView from './views/LoginView.jsx';
import LobbyView from './views/LobbyView.jsx';
import GameView from './views/GameView.jsx';

const VIEW_LOGIN = 'login';
const VIEW_LOBBY = 'lobby';
const VIEW_GAME = 'game';

const REQUIRED_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
];

export default function App() {
  const [view, setView] = useState(null);
  const [authError, setAuthError] = useState('');
  const [me, setMe] = useState(null);
  const [game, setGame] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (cancelled) return;
        setMe(res);
        setView(res.authenticated ? VIEW_LOBBY : VIEW_LOGIN);
      })
      .catch((e) => {
        if (cancelled) return;
        setAuthError('Nie można połączyć się z serwerem: ' + e.message);
        setView(VIEW_LOGIN);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error(e);
    }
    window.location.href = '/';
  };

  const missingScopes = me?.scopes
    ? REQUIRED_SCOPES.filter((s) => !me.scopes.includes(s))
    : [];

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="flex items-center justify-between border-b border-white/5 bg-ink-950/40 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-spotify-light to-spotify-dark shadow-[0_0_18px_rgba(29,185,84,0.4)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-950" fill="currentColor">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z" />
            </svg>
          </span>
          <h1 className="font-display text-xl font-bold tracking-tight">
            Jaka to <span className="text-gradient-spotify">Melodia</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          {view === VIEW_LOGIN && <span>Niezalogowany</span>}
          {(view === VIEW_LOBBY || view === VIEW_GAME) && (
            <button className="btn btn-ghost" onClick={handleLogout}>
              Wyloguj
            </button>
          )}
        </div>
      </header>

      {missingScopes.length > 0 && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p className="font-semibold">Twój token nie ma wszystkich potrzebnych uprawnień:</p>
          <code className="block py-1 text-xs">{missingScopes.join(', ')}</code>
          <p className="mt-1">
            Kliknij <b>Wyloguj</b>, potwierdź wylogowanie ze Spotify i zaloguj się ponownie.
          </p>
        </div>
      )}

      <main className="flex-1 px-4 py-6">
        {view === null && (
          <div className="card text-center text-slate-300">Ładowanie…</div>
        )}
        {view === VIEW_LOGIN && <LoginView error={authError} />}
        {view === VIEW_LOBBY && (
          <LobbyView
            onGameStarted={(g) => {
              setGame(g);
              setView(VIEW_GAME);
            }}
          />
        )}
        {view === VIEW_GAME && game && (
          <GameView
            initialState={game}
            onLeave={() => {
              setGame(null);
              setView(VIEW_LOBBY);
            }}
          />
        )}
      </main>
    </div>
  );
}
