import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.js';
import { api } from '../api.js';
import { initSdk, play, pause, resume } from '../spotify.js';
import Scoreboard from '../components/Scoreboard.jsx';
import RevealCard from '../components/RevealCard.jsx';
import GuessCard from '../components/GuessCard.jsx';
import HotkeyHelp from '../components/HotkeyHelp.jsx';
import NowPlayingCard from '../components/NowPlayingCard.jsx';
import HostLobbyCard from '../components/HostLobbyCard.jsx';
import { clearAllSessions } from '../playerSession.js';

export default function HostGameView({ initialState, onLeave }) {
  // Defense in depth: host nigdy nie powinien mieć player JWT w sessionStorage
  // swojej karty. Gdyby jednak miał (np. testował /join w tej samej karcie),
  // czyścimy wszystko zaraz po wejściu na widok hosta, żeby kolejne wywołania
  // /start, /skip, /next nie poszły z błędnym Bearerem.
  useEffect(() => {
    clearAllSessions();
  }, []);

  const [state, setState] = useState(initialState);
  const [sdkError, setSdkError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const [lastListeningSec, setLastListeningSec] = useState(null);
  const lastPlayedUriRef = useRef(null);
  const stompRef = useRef(null);
  const fallbackAudioRef = useRef(null);
  const listeningStartRef = useRef(null);
  const useFallback = !sdkReady && Boolean(sdkError);

  useEffect(() => {
    let cancelled = false;
    initSdk()
      .then(() => {
        if (!cancelled) setSdkReady(true);
      })
      .catch((e) => {
        if (!cancelled) {
          setSdkError(
            'Web Playback SDK się nie zainicjalizował (wymaga Spotify Premium): ' +
              e.message
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 2500,
      debug: () => {},
    });
    client.onConnect = () => {
      client.subscribe(`/topic/games/${initialState.gameId}`, (msg) => {
        try {
          setState(JSON.parse(msg.body));
        } catch (e) {
          console.warn('WS parse error', e);
        }
      });
    };
    client.activate();
    stompRef.current = client;
    return () => {
      client.deactivate();
    };
  }, [initialState.gameId]);

  useEffect(() => {
    if (!sdkReady) return;
    if (state.status === 'PLAYING' && state.currentTrackUri) {
      if (state.currentTrackUri !== lastPlayedUriRef.current) {
        lastPlayedUriRef.current = state.currentTrackUri;
        play(state.currentTrackUri).catch((e) => {
          console.error(e);
          setSdkError('Nie udało się odtworzyć utworu: ' + e.message);
        });
      } else {
        resume().catch(() => {});
      }
    } else {
      pause();
    }
  }, [sdkReady, state.status, state.currentTrackUri]);

  useEffect(() => {
    const audio = fallbackAudioRef.current;
    if (!audio) return;
    if (!useFallback) {
      audio.pause();
      return;
    }
    if (state.status === 'PLAYING' && state.currentTrackPreviewUrl) {
      if (audio.src !== state.currentTrackPreviewUrl) {
        audio.src = state.currentTrackPreviewUrl;
      }
      audio.play().catch((e) => {
        console.warn('fallback audio play:', e.message);
      });
    } else {
      audio.pause();
    }
  }, [useFallback, state.status, state.currentTrackPreviewUrl]);

  useEffect(() => {
    if (state.status === 'PLAYING') {
      if (listeningStartRef.current == null) {
        listeningStartRef.current = Date.now();
      }
    }
    if (state.status === 'REVEAL' && listeningStartRef.current != null) {
      setLastListeningSec(Math.round((Date.now() - listeningStartRef.current) / 1000));
    }
  }, [state.status]);

  useEffect(() => {
    listeningStartRef.current = null;
    setLastListeningSec(null);
  }, [state.currentRound]);

  useEffect(() => {
    const handler = async (ev) => {
      const target = ev.target;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if (ev.code === 'Space' || ev.key === ' ' || ev.key === 'Spacebar') {
        if (state.status === 'PLAYING') {
          ev.preventDefault();
          try {
            const updated = await api.skip(state.gameId);
            setState(updated);
          } catch (e) {
            console.error(e);
          }
        } else if (state.status === 'REVEAL') {
          ev.preventDefault();
          try {
            const updated = await api.next(state.gameId);
            setState(updated);
          } catch (e) {
            console.error(e);
          }
        }
        return;
      }
      if (state.status !== 'PLAYING') return;
      const key = (ev.key || '').toUpperCase();
      const player = state.players.find((p) => p.hotkey === key);
      if (!player || player.lockedOut) return;
      ev.preventDefault();
      try {
        const updated = await api.buzz(state.gameId, player.id);
        setState(updated);
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.gameId, state.status, state.players]);

  const submitGuess = async (text, onResult) => {
    if (state.status !== 'GUESSING') return;
    const playerId = state.activeGuesserId;
    try {
      const res = await api.guess(state.gameId, playerId, text);
      setState(res.status);
      onResult && onResult(res);
    } catch (e) {
      onResult && onResult({ result: 'WRONG', error: e.message });
    }
  };

  const advance = async () => {
    try {
      const updated = await api.next(state.gameId);
      setState(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const startFromLobby = async () => {
    const updated = await api.startLobby(state.gameId);
    setState(updated);
  };

  const activePlayer =
    state.activeGuesserId && state.players.find((p) => p.id === state.activeGuesserId);

  const sdkBadge = !sdkReady && !sdkError
    ? 'Inicjalizacja Spotify SDK…'
    : sdkError
    ? useFallback && state.currentTrackPreviewUrl
      ? 'Bez Premium — gram 30s podgląd z iTunes'
      : useFallback && state.status === 'PLAYING' && !state.currentTrackPreviewUrl
      ? 'Brak podglądu dla tego utworu — pomiń spacją'
      : sdkError
    : null;

  if (state.status === 'WAITING') {
    return (
      <div className="space-y-4">
        <HostLobbyCard state={state} onStart={startFromLobby} />
        <audio ref={fallbackAudioRef} preload="auto" className="hidden" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NowPlayingCard state={state} sdkBadge={sdkBadge} />

      <audio ref={fallbackAudioRef} preload="auto" className="hidden" />

      <div
        className={
          'grid gap-4 ' +
          (state.status === 'PLAYING' || state.status === 'GUESSING'
            ? 'lg:grid-cols-2'
            : 'grid-cols-1')
        }
      >
        <Scoreboard players={state.players} activeId={state.activeGuesserId} />
        {state.status === 'PLAYING' && <HotkeyHelp players={state.players} />}
        {state.status === 'GUESSING' && activePlayer && (
          <GuessCard activePlayer={activePlayer} onSubmit={submitGuess} />
        )}
      </div>

      {state.status === 'REVEAL' && state.revealedTrack && (
        <RevealCard
          track={state.revealedTrack}
          onNext={advance}
          listeningSeconds={lastListeningSec}
        />
      )}

      {state.status === 'FINISHED' && (
        <FinishedCard players={state.players} onLeave={onLeave} />
      )}
    </div>
  );
}

function FinishedCard({ players, onLeave }) {
  const ranking = [...players].sort((a, b) => b.score - a.score);
  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  return (
    <section className="card text-center">
      <span className="pill bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/40">
        Koniec gry
      </span>
      <h2 className="mt-3 text-3xl font-bold text-gradient-spotify">Gratulacje!</h2>
      {podium.length > 0 && (
        <div className="mt-6 flex items-end justify-center gap-4">
          {podium[1] && <PodiumStep player={podium[1]} place={2} height="h-20" />}
          {podium[0] && <PodiumStep player={podium[0]} place={1} height="h-28" highlight />}
          {podium[2] && <PodiumStep player={podium[2]} place={3} height="h-16" />}
        </div>
      )}
      {rest.length > 0 && (
        <ol className="mx-auto mt-6 max-w-sm space-y-1.5 text-left">
          {rest.map((p, idx) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500">#{idx + 4}</span>
                <span>{p.name}</span>
              </span>
              <span className="font-mono font-semibold">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
      <button className="btn btn-primary btn-big mt-6" onClick={onLeave}>
        Nowa gra
      </button>
    </section>
  );
}

function PodiumStep({ player, place, height, highlight }) {
  const colors = {
    1: 'from-amber-300 to-amber-500',
    2: 'from-slate-300 to-slate-500',
    3: 'from-orange-400 to-orange-600',
  };
  const labelColor = {
    1: 'text-amber-300',
    2: 'text-slate-300',
    3: 'text-orange-400',
  };
  return (
    <div className="flex w-24 flex-col items-center">
      <span className={'mb-1 font-display text-3xl font-extrabold ' + labelColor[place]}>
        #{place}
      </span>
      <span className={'truncate text-sm ' + (highlight ? 'font-semibold' : 'font-medium')}>
        {player.name}
      </span>
      <span className="font-mono text-xs text-slate-400">{player.score} pkt</span>
      <div
        className={
          'mt-2 w-full rounded-t-lg bg-gradient-to-b ' + height + ' ' + colors[place]
        }
      />
    </div>
  );
}
