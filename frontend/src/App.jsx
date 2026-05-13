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
      const res = await api.logout();
      window.location.href = res.spotifyLogoutUrl || '/';
    } catch (e) {
      console.error(e);
      window.location.href = '/';
    }
  };

  const missingScopes = me?.scopes
    ? REQUIRED_SCOPES.filter((s) => !me.scopes.includes(s))
    : [];

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b border-ink-500 bg-black/30 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-wide">Jaka to Melodia</h1>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          {view === VIEW_LOGIN && <span>Niezalogowany</span>}
          {(view === VIEW_LOBBY || view === VIEW_GAME) && (
            <>
              <span>Zalogowany</span>
              <button className="btn" onClick={handleLogout}>
                Wyloguj
              </button>
            </>
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
