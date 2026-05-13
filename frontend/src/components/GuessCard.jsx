import { useEffect, useRef, useState } from 'react';

export default function GuessCard({ activePlayer, onSubmit }) {
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activePlayer.id]);

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim(), (res) => {
      if (res.error) {
        setFeedback({ tone: 'fail', text: 'Błąd: ' + res.error });
        return;
      }
      if (res.result === 'WRONG') {
        setFeedback({ tone: 'fail', text: 'Źle! Lock-out.' });
      } else {
        const labels = {
          BOTH: 'Tytuł i wykonawca',
          TITLE_ONLY: 'Tylko tytuł',
          ARTIST_ONLY: 'Tylko wykonawca',
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
    <div className="card">
      <h3 className="mb-2 text-lg font-semibold">
        Twoja kolej, <span className="text-spotify-light">{activePlayer.name}</span>
      </h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          className="input flex-1"
          placeholder="Wpisz tytuł i/lub wykonawcę..."
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
            'mt-2 text-sm font-semibold ' +
            (feedback.tone === 'ok' ? 'text-spotify-light' : 'text-red-400')
          }
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
