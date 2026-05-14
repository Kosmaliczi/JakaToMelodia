import { useEffect, useRef, useState } from 'react';

export default function GuessCard({ activePlayer, onSubmit }) {
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    inputRef.current?.focus();
    setText('');
    setFeedback(null);
  }, [activePlayer.id]);

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim(), (res) => {
      if (res.error) {
        setFeedback({ tone: 'fail', text: 'Błąd: ' + res.error });
        return;
      }
      if (res.result === 'WRONG') {
        setFeedback({ tone: 'fail', text: 'Pudło! Lock-out — kolejni gracze mogą buzzować.' });
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
    });
    setText('');
  };

  return (
    <section className="card border-amber-400/30 bg-amber-400/[0.04]">
      <div className="mb-3 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
        </span>
        <h3 className="text-base font-semibold">
          Twoja kolej, <span className="text-amber-300">{activePlayer.name}</span>
        </h3>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          className="input flex-1"
          placeholder="Wpisz tytuł i / lub wykonawcę…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          autoComplete="off"
        />
        <button className="btn btn-primary" onClick={submit}>
          Zatwierdź
        </button>
      </div>
      {feedback && (
        <p
          className={
            'mt-3 text-sm font-medium ' +
            (feedback.tone === 'ok' ? 'text-spotify-light' : 'text-red-400')
          }
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
