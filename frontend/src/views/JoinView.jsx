import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { saveSession } from '../playerSession.js';

const CODE_LENGTH = 6;

export default function JoinView() {
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get('code') || '').toUpperCase().slice(0, CODE_LENGTH));
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(code.length === CODE_LENGTH ? 1 : 0);
  const navigate = useNavigate();
  const nameRef = useRef(null);

  useEffect(() => {
    if (step === 1) nameRef.current?.focus();
  }, [step]);

  const onCodeChange = (raw) => {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(cleaned);
    setError('');
    if (cleaned.length === CODE_LENGTH && step === 0) setStep(1);
  };

  const submit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (code.length !== CODE_LENGTH) {
      setError('Kod pokoju ma 6 znaków.');
      return;
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20) {
      setError('Nick musi mieć 2–20 znaków.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.joinRoom(code, trimmedName);
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
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <span className="absolute inset-0 -z-10 animate-pulse-ring rounded-full" />
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-spotify-light to-spotify-dark shadow-[0_0_36px_rgba(29,185,84,0.55)]">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-ink-950" fill="currentColor">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z" />
            </svg>
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight">
          Dołącz do <span className="text-gradient-spotify">imprezy</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Wpisz kod od hosta i wybierz nick — gotowe.
        </p>
      </div>

      <section className="card relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 right-0 h-48 w-48 rounded-full bg-spotify/10 blur-3xl" />
        <form className="relative space-y-5" onSubmit={submit}>
          <div>
            <label className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Kod pokoju</span>
              <span className="text-slate-600">{code.length}/{CODE_LENGTH}</span>
            </label>
            <CodeBoxes value={code} onChange={onCodeChange} disabled={submitting} />
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Twój nick
            </label>
            <input
              ref={nameRef}
              className="input h-12 text-base"
              placeholder="np. Kasia"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              inputMode="text"
              enterKeyHint="go"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-400/30 bg-red-400/[0.07] px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || code.length !== CODE_LENGTH || name.trim().length < 2}
            className="btn btn-primary btn-big h-14 w-full text-base font-bold tracking-wide"
            style={{ touchAction: 'manipulation' }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Dołączam…
              </span>
            ) : (
              'Wskakuję do gry'
            )}
          </button>
        </form>
      </section>

      <p className="text-center text-[11px] text-slate-600">
        Twoja sesja zostaje tylko w tej karcie. Zamknięcie karty = wylogowanie.
      </p>
    </div>
  );
}

function CodeBoxes({ value, onChange, disabled }) {
  const inputRef = useRef(null);
  const focus = () => inputRef.current?.focus();
  const chars = value.padEnd(CODE_LENGTH, ' ').split('').slice(0, CODE_LENGTH);

  return (
    <div className="relative" onClick={focus}>
      <input
        ref={inputRef}
        className="absolute inset-0 h-full w-full opacity-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={CODE_LENGTH}
        autoComplete="one-time-code"
        inputMode="text"
        autoCapitalize="characters"
        autoFocus
        disabled={disabled}
      />
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {chars.map((ch, i) => {
          const filled = ch !== ' ';
          const isCursor = i === value.length && !disabled;
          return (
            <div
              key={i}
              className={
                'flex h-12 items-center justify-center rounded-xl border-2 font-mono text-2xl font-bold uppercase transition sm:h-14 sm:text-3xl ' +
                (filled
                  ? 'border-spotify/60 bg-spotify/10 text-spotify-light shadow-[0_0_18px_rgba(29,185,84,0.25)]'
                  : isCursor
                  ? 'border-spotify/50 bg-ink-900/70 text-slate-100'
                  : 'border-white/10 bg-ink-900/40 text-slate-500')
              }
            >
              {filled ? ch : isCursor ? <Caret /> : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Caret() {
  return (
    <span className="inline-block h-6 w-[2px] animate-pulse bg-spotify-light sm:h-7" />
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
  );
}
