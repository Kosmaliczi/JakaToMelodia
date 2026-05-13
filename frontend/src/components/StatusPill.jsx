const TONES = {
  PLAYING: 'bg-spotify/20 text-spotify-light',
  GUESSING: 'bg-amber-500/20 text-amber-300',
  REVEAL: 'bg-blue-500/20 text-blue-300',
  FINISHED: 'bg-purple-500/20 text-purple-300',
};

const LABELS = {
  PLAYING: 'Gra: zgadnij utwór',
  GUESSING: 'Zgadywanie',
  REVEAL: 'Odsłonięcie odpowiedzi',
  FINISHED: 'Koniec gry',
};

export default function StatusPill({ status }) {
  const tone = TONES[status] || 'bg-ink-500 text-slate-300';
  const label = LABELS[status] || status;
  return <span className={'pill ' + tone}>{label}</span>;
}
