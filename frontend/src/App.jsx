import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import LoginView from './views/LoginView.jsx';
import LobbyView from './views/LobbyView.jsx';
import HostGameView from './views/HostGameView.jsx';
import JoinView from './views/JoinView.jsx';
import PlayerGameView from './views/PlayerGameView.jsx';

const REQUIRED_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
];

export default function App() {
  const [authState, setAuthState] = useState({ loading: true, authenticated: false, scopes: [] });
  const [authError, setAuthError] = useState('');
  const [game, setGame] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (cancelled) return;
        setAuthState({
          loading: false,
          authenticated: !!res.authenticated,
          scopes: res.scopes || [],
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setAuthError('Nie można połączyć się z serwerem: ' + e.message);
        setAuthState({ loading: false, authenticated: false, scopes: [] });
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

  const missingScopes = authState.authenticated
    ? REQUIRED_SCOPES.filter((s) => !authState.scopes.includes(s))
    : [];

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="flex items-center justify-between border-b border-white/5 bg-ink-950/40 px-6 py-4 backdrop-blur-md">
        <button
          className="flex items-center gap-3 transition hover:opacity-80"
          onClick={() => navigate('/')}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-spotify-light to-spotify-dark shadow-[0_0_18px_rgba(29,185,84,0.4)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-950" fill="currentColor">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z" />
            </svg>
          </span>
          <h1 className="font-display text-xl font-bold tracking-tight">
            Jaka to <span className="text-gradient-spotify">Melodia</span>
          </h1>
        </button>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          {!authState.authenticated && (
            <button className="btn btn-ghost" onClick={() => navigate('/join')}>
              Dołącz do gry
            </button>
          )}
          {authState.authenticated && (
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
            Kliknij <b>Wyloguj</b> i zaloguj się ponownie.
          </p>
        </div>
      )}

      <main className="flex-1 px-4 py-6">
        {authState.loading ? (
          <div className="card text-center text-slate-300">Ładowanie…</div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                authState.authenticated ? (
                  <LobbyView
                    onGameStarted={(g) => {
                      setGame(g);
                      navigate('/game');
                    }}
                  />
                ) : (
                  <LoginView error={authError} />
                )
              }
            />
            <Route
              path="/game"
              element={
                game ? (
                  <HostGameView
                    initialState={game}
                    onLeave={() => {
                      setGame(null);
                      navigate('/');
                    }}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="/join" element={<JoinView />} />
            <Route path="/player/:gameId" element={<PlayerGameView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
