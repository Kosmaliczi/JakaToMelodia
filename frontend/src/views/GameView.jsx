import { useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs.js';
import { api } from '../api.js';
import { initSdk, play, pause } from '../spotify.js';
import Scoreboard from '../components/Scoreboard.jsx';
import RevealCard from '../components/RevealCard.jsx';
import GuessCard from '../components/GuessCard.jsx';
import HotkeyHelp from '../components/HotkeyHelp.jsx';
import StatusPill from '../components/StatusPill.jsx';

export default function GameView({ initialState, onLeave }) {
  const [state, setState] = useState(initialState);
  const [sdkError, setSdkError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const lastPlayedUriRef = useRef(null);
  const stompRef = useRef(null);

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
      }
    } else {
      pause();
    }
  }, [sdkReady, state.status, state.currentTrackUri]);

  useEffect(() => {
    const handler = async (ev) => {
      if (state.status !== 'PLAYING') return;
      const target = ev.target;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
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

  const activePlayer =
    state.activeGuesserId && state.players.find((p) => p.id === state.activeGuesserId);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Runda {state.currentRound} / {state.totalRounds}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              <StatusPill status={state.status} />
            </p>
          </div>
          {!sdkReady && !sdkError && (
            <span className="text-xs text-slate-400">Inicjalizacja SDK…</span>
          )}
        </div>
        {sdkError && (
          <p className="mt-3 text-sm text-amber-400">{sdkError}</p>
        )}
      </div>

      <Scoreboard players={state.players} activeId={state.activeGuesserId} />

      {state.status === 'PLAYING' && (
        <HotkeyHelp players={state.players} />
      )}

      {state.status === 'GUESSING' && activePlayer && (
        <GuessCard activePlayer={activePlayer} onSubmit={submitGuess} />
      )}

      {state.status === 'REVEAL' && state.revealedTrack && (
        <RevealCard track={state.revealedTrack} onNext={advance} />
      )}

      {state.status === 'FINISHED' && (
        <FinishedCard players={state.players} onLeave={onLeave} />
      )}
    </div>
  );
}

function FinishedCard({ players, onLeave }) {
  const ranking = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="card text-center">
      <h2 className="mb-3 text-2xl font-semibold">Koniec gry</h2>
      <ol className="mb-4 space-y-1 text-left">
        {ranking.map((p, idx) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-md bg-ink-500 px-3 py-2"
          >
            <span>
              <span className="mr-2 font-mono text-slate-400">#{idx + 1}</span>
              {p.name}
            </span>
            <span className="font-semibold">{p.score} pkt</span>
          </li>
        ))}
      </ol>
      <button className="btn btn-primary" onClick={onLeave}>
        Nowa gra
      </button>
    </div>
  );
}
