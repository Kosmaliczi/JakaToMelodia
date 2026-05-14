const TONES = {
  WAITING: 'bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/40',
  PLAYING: 'bg-spotify/15 text-spotify-light ring-1 ring-spotify/40',
  GUESSING: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40',
  REVEAL: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40',
  FINISHED: 'bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/40',
};

const LABELS = {
  WAITING: 'Lobby',
  PLAYING: 'Teraz gra',
  GUESSING: 'Zgadywanie',
  REVEAL: 'Odpowiedź',
  FINISHED: 'Koniec',
};

const DOTS = {
  WAITING: 'bg-slate-300',
  PLAYING: 'bg-spotify-light',
  GUESSING: 'bg-amber-300',
  REVEAL: 'bg-blue-300',
  FINISHED: 'bg-purple-300',
};

export default function StatusPill({ status }) {
  const tone = TONES[status] || 'bg-ink-500 text-slate-300';
  const dot = DOTS[status] || 'bg-slate-400';
  const label = LABELS[status] || status;
  return (
    <span className={'pill ' + tone}>
      <span className={'h-1.5 w-1.5 rounded-full ' + dot} />
      {label}
    </span>
  );
}
