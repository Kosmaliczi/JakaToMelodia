export default function HotkeyHelp({ players }) {
  return (
    <div className="card">
      <p className="mb-2 text-sm text-slate-400">
        Wciśnij swój hotkey, aby przejąć kolejkę:
      </p>
      <ul className="flex flex-wrap gap-2">
        {players.map((p) => (
          <li
            key={p.id}
            className={
              'flex items-center gap-2 rounded-md bg-ink-500 px-3 py-1.5 text-sm ' +
              (p.lockedOut ? 'opacity-40 line-through' : '')
            }
          >
            <kbd className="rounded bg-ink-400 px-2 py-0.5 font-mono text-xs">
              {p.hotkey}
            </kbd>
            <span>{p.name}</span>
            {p.lockedOut && <span className="text-xs text-red-400">(out)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
