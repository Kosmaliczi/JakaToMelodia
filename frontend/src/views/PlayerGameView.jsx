import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.js';
import { api } from '../api.js';
import { loadSession, clearSession } from '../playerSession.js';
import StatusPill from '../components/StatusPill.jsx';

export default function PlayerGameView() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [session] = useState(() => loadSession(gameId));
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [guessText, setGuessText] = useState('');
  const [feedback, setFeedback] = useState(null);
  const guessInputRef = useRef(null);

  useEffect(() => {
    if (!session) {
      navigate(`/join`);
      return;
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    api
      .gameStatus(gameId)
      .then((s) => !cancelled && setState(s))
      .catch((e) => {
        if (!cancelled) setError(e.status === 404 ? 'Pokój nie istnieje (gra zakończona?)' : e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, session]);

  useEffect(() => {
    if (!session) return;
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 2500,
      debug: () => {},
    });
    client.onConnect = () => {
      client.subscribe(`/topic/games/${gameId}`, (msg) => {
        try {
          setState(JSON.parse(msg.body));
        } catch (e) {
          console.warn('WS parse error', e);
        }
      });
    };
    client.activate();
    return () => {
      client.deactivate();
    };
  }, [gameId, session]);

  useEffect(() => {
    if (state?.status === 'GUESSING' && state.activeGuesserId === session?.playerId) {
      setFeedback(null);
      setGuessText('');
      guessInputRef.current?.focus();
    }
  }, [state?.status, state?.activeGuesserId, session?.playerId]);

  const me = state?.players?.find((p) => p.id === session?.playerId);
  const isMyTurn = state?.status === 'GUESSING' && state?.activeGuesserId === session?.playerId;
  const canBuzz =
    state?.status === 'PLAYING' && me && !me.lockedOut && !state.activeGuesserId;

  const handleBuzz = async () => {
    if (!canBuzz || busy) return;
    setBusy(true);
    try {
      if (typeof navigator?.vibrate === 'function') navigator.vibrate(50);
      const updated = await api.buzz(gameId, session.playerId);
      setState(updated);
    } catch (e) {
      console.error(e);
      if (e.status === 401 || e.status === 403) {
        clearSession(gameId);
        navigate('/join');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGuess = async (e) => {
    e.preventDefault();
    if (!guessText.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api.guess(gameId, session.playerId, guessText.trim());
      setState(res.status);
      if (res.result === 'WRONG') {
        setFeedback({ tone: 'fail', text: 'Pudło! Lock-out.' });
      } else {
        const labels = {
          BOTH: 'Tytuł i wykonawca',
          TITLE_ONLY: 'Sam tytuł',
          ARTIST_ONLY: 'Sam wykonawca',
        };
        setFeedback({
          tone: 'ok',
          text: `Brawo! ${labels[res.result] || res.result} (+${res.pointsAwarded} pkt)`,
        });
      }
      setGuessText('');
    } catch (e) {
      setFeedback({ tone: 'fail', text: 'Błąd: ' + e.message });
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = () => {
    clearSession(gameId);
    navigate('/');
  };

  const handleToggleReady = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = !me?.ready;
      const updated = await api.setReady(gameId, next);
      setState(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return <div className="card text-center text-slate-300">Przekierowanie do /join…</div>;
  }

  if (error) {
    return (
      <section className="card mx-auto max-w-md text-center">
        <p className="text-red-400">{error}</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/join')}>
          Wróć do /join
        </button>
      </section>
    );
  }

  if (!state) {
    return <div className="card text-center text-slate-300">Łączę z pokojem…</div>;
  }

  if (state.status === 'FINISHED') {
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    const myPlace = sorted.findIndex((p) => p.id === session.playerId) + 1;
    return (
      <section className="card mx-auto max-w-md text-center">
        <span className="pill bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/40">
          Koniec gry
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold">
          {myPlace === 1 ? 'Wygrałeś!' : `Miejsce ${myPlace}.`}
        </h2>
        <p className="mt-1 text-slate-400">
          Wynik: <span className="font-mono">{me?.score ?? 0}</span> pkt
        </p>
        <button className="btn btn-primary mt-5" onClick={handleLeave}>
          Wyjdź
        </button>
      </section>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <section className="card text-center">
        <p className="text-[10px] uppercase tracking-wider text-slate-400">Pokój</p>
        <p className="font-mono text-xl font-bold tracking-[0.25em] text-gradient-spotify">
          {state.roomCode}
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <StatusPill status={state.status} />
          <span className="text-xs text-slate-400">
            Runda {state.currentRound}/{state.totalRounds}
          </span>
        </div>
        <p className="mt-2 text-sm">
          Cześć <span className="font-semibold text-spotify-light">{me?.name || session.name}</span>
          <span className="ml-2 text-xs text-slate-500">
            ({me?.score ?? 0} pkt
            {me?.lockedOut && <span className="text-red-400"> · lock-out</span>})
          </span>
        </p>
      </section>

      {state.status === 'WAITING' && (
        <section className="card text-center">
          <p className="text-sm text-slate-400">
            {state.players.length === 1
              ? 'Jesteś sam w pokoju. Poproś host(a) o start gdy będziesz gotowy.'
              : `${state.players.filter((p) => p.ready).length} / ${state.players.length} graczy gotowych`}
          </p>
          <button
            className={
              'btn btn-big mt-3 w-full ' +
              (me?.ready ? 'btn-ghost border-spotify/40 text-spotify-light' : 'btn-primary')
            }
            onClick={handleToggleReady}
            disabled={busy}
          >
            {me?.ready ? 'Jesteś gotowy — kliknij, aby cofnąć' : 'Jestem gotowy'}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Host rozpocznie grę gdy wszyscy będą gotowi.
          </p>
        </section>
      )}

      {state.status === 'PLAYING' && (
        <BuzzButton onClick={handleBuzz} disabled={!canBuzz || busy} lockedOut={me?.lockedOut} />
      )}

      {state.status === 'GUESSING' && isMyTurn && (
        <section className="card border-amber-400/30 bg-amber-400/[0.04]">
          <h3 className="mb-3 text-base font-semibold text-amber-300">
            Twoja kolej — zgadnij!
          </h3>
          <form className="flex flex-col gap-2" onSubmit={handleGuess}>
            <input
              ref={guessInputRef}
              className="input"
              placeholder="Tytuł i / lub wykonawca…"
              value={guessText}
              onChange={(e) => setGuessText(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Zatwierdź
            </button>
          </form>
          {feedback && (
            <p className={'mt-2 text-sm font-medium ' + (feedback.tone === 'ok' ? 'text-spotify-light' : 'text-red-400')}>
              {feedback.text}
            </p>
          )}
        </section>
      )}

      {state.status === 'GUESSING' && !isMyTurn && (
        <section className="card text-center text-sm text-slate-400">
          <p>
            <span className="font-semibold text-amber-300">
              {state.players.find((p) => p.id === state.activeGuesserId)?.name}
            </span>{' '}
            zgaduje…
          </p>
        </section>
      )}

      {state.status === 'REVEAL' && state.revealedTrack && (
        <section className="card text-center">
          <span className="pill bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40">Odpowiedź</span>
          {state.revealedTrack.coverUrl && (
            <img src={state.revealedTrack.coverUrl} alt="" className="mx-auto mt-3 h-32 w-32 rounded-xl object-cover" />
          )}
          <p className="mt-3 text-lg font-bold">{state.revealedTrack.title}</p>
          <p className="text-sm text-slate-400">{state.revealedTrack.artist}</p>
          <p className="mt-3 text-xs text-slate-500">Czekaj na kolejną rundę…</p>
        </section>
      )}

      <section className="card">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Wyniki
        </h3>
        <ul className="space-y-1">
          {[...state.players].sort((a, b) => b.score - a.score).map((p, idx) => {
            const mine = p.id === session.playerId;
            return (
              <li
                key={p.id}
                className={
                  'flex items-center justify-between rounded-lg px-3 py-1.5 ' +
                  (mine ? 'bg-spotify/15 ring-1 ring-spotify/40' : 'bg-white/[0.04]') +
                  (p.lockedOut ? ' opacity-50' : '')
                }
              >
                <span className="text-sm">
                  <span className="mr-2 font-mono text-xs text-slate-500">#{idx + 1}</span>
                  {p.name}
                  {p.lockedOut && <span className="ml-2 text-xs text-red-400">out</span>}
                </span>
                <span className="font-mono text-sm font-semibold">{p.score}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <button className="btn btn-ghost w-full text-xs text-slate-400" onClick={handleLeave}>
        Opuść pokój
      </button>
    </div>
  );
}

function BuzzButton({ onClick, disabled, lockedOut }) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={
          'relative flex h-48 w-48 select-none items-center justify-center rounded-full font-display text-2xl font-extrabold uppercase tracking-wide transition active:scale-95 ' +
          (disabled
            ? 'cursor-not-allowed bg-ink-600 text-slate-500'
            : 'bg-gradient-to-br from-spotify-light to-spotify-dark text-ink-950 shadow-[0_0_36px_rgba(29,185,84,0.55)] hover:from-spotify hover:to-spotify-dark')
        }
        style={{ touchAction: 'manipulation' }}
      >
        {!disabled && (
          <span className="absolute inset-0 -z-10 animate-pulse-ring rounded-full" />
        )}
        {lockedOut ? 'OUT' : 'BUZZ'}
      </button>
    </div>
  );
}
