import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { saveSession } from '../playerSession.js';

export default function JoinView() {
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get('code') || '').toUpperCase());
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length !== 6) {
      setError('Kod pokoju ma 6 znaków.');
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 20) {
      setError('Nick musi mieć 2-20 znaków.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.joinRoom(trimmedCode, trimmedName);
      saveSession(res.gameId, {
        token: res.token,
        playerId: res.playerId,
        gameId: res.gameId,
        roomCode: res.roomCode,
        hotkey: res.hotkey,
        name: trimmedName,
        expiresAtMs: Date.now() + res.expiresInSeconds * 1000,
      });
      navigate(`/player/${res.gameId}`);
    } catch (e) {
      if (e.status === 404) setError('Nie ma pokoju o tym kodzie. Sprawdź u hosta.');
      else if (e.status === 409) setError(e.message);
      else if (e.status === 400) setError(e.message);
      else setError('Błąd: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card relative mx-auto max-w-md overflow-hidden">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-spotify/20 blur-3xl" />
      <div className="relative">
        <span className="pill bg-spotify/15 text-spotify-light ring-1 ring-spotify/40">
          Dołącz do gry
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold">
          Wpisz kod od hosta
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Host pokazuje 6-znakowy kod na swoim ekranie.
        </p>
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">
              Kod pokoju
            </label>
            <input
              className="input text-center font-mono text-xl tracking-[0.3em] uppercase"
              placeholder="XXXXXX"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="off"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-slate-400">
              Twój nick
            </label>
            <input
              className="input"
              placeholder="np. Kasia"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            className="btn btn-primary btn-big w-full"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Dołączam…' : 'Dołącz'}
          </button>
        </form>
      </div>
    </section>
  );
}
