export default function Scoreboard({ players, activeId }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="card">
      <h3 className="mb-2 text-lg font-semibold">Tablica wyników</h3>
      <ul className="space-y-1">
        {sorted.map((p) => {
          const classes = ['flex items-center justify-between rounded-md px-3 py-2'];
          if (p.id === activeId) classes.push('bg-spotify/20 ring-1 ring-spotify');
          if (p.lockedOut) classes.push('opacity-40 line-through');
          return (
            <li key={p.id} className={classes.join(' ')}>
              <span className="flex items-center gap-3">
                <kbd className="rounded bg-ink-400 px-2 py-0.5 font-mono text-xs">
                  {p.hotkey}
                </kbd>
                <span>{p.name}</span>
              </span>
              <span className="font-semibold">{p.score} pkt</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
