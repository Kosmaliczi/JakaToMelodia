export default function RevealCard({ track, onNext, listeningSeconds }) {
  return (
    <section className="card relative overflow-hidden">
      {track.coverUrl && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,0.4), rgba(10,12,16,0.95)), url(${track.coverUrl}) center/cover`,
            filter: 'blur(20px)',
          }}
        />
      )}
      <div className="relative flex flex-col items-center text-center">
        <span className="pill bg-blue-500/20 text-blue-300">Odpowiedź</span>
        {track.coverUrl && (
          <img
            src={track.coverUrl}
            alt=""
            className="mt-4 h-48 w-48 rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
          />
        )}
        <h3 className="mt-4 text-2xl font-bold">{track.title}</h3>
        <p className="text-slate-400">{track.artist}</p>
        {typeof listeningSeconds === 'number' && (
          <p className="mt-2 text-xs text-slate-500">
            Czas słuchania: <span className="font-mono text-slate-300">{formatSeconds(listeningSeconds)}</span>
          </p>
        )}
        <button className="btn btn-primary btn-big mt-5" onClick={onNext}>
          Kolejna runda
        </button>
        <p className="mt-2 text-xs text-slate-500">
          lub naciśnij <kbd className="kbd">Spacja</kbd>
        </p>
      </div>
    </section>
  );
}

function formatSeconds(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}
