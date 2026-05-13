export default function RevealCard({ track, onNext }) {
  return (
    <div className="card text-center">
      <h3 className="mb-3 text-lg font-semibold">Odpowiedź</h3>
      {track.coverUrl && (
        <img
          src={track.coverUrl}
          alt=""
          className="mx-auto mb-3 h-40 w-40 rounded-md object-cover"
        />
      )}
      <p className="text-xl font-bold">{track.title}</p>
      <p className="mb-4 text-slate-400">{track.artist}</p>
      <button className="btn btn-primary" onClick={onNext}>
        Kolejna runda
      </button>
    </div>
  );
}
