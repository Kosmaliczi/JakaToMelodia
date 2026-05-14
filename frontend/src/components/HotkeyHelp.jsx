export default function HotkeyHelp({ players }) {
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Sterowanie
        </h3>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {players.map((p) => (
          <li
            key={p.id}
            className={
              'flex flex-col items-center gap-1 rounded-xl border border-white/5 bg-ink-700/60 px-3 py-3 text-center ' +
              (p.lockedOut ? 'opacity-40' : '')
            }
          >
            <kbd className="kbd h-8 min-w-[2rem] text-sm">{p.hotkey}</kbd>
            <span className={'text-xs ' + (p.lockedOut ? 'line-through' : '')}>{p.name}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <kbd className="kbd">Spacja</kbd>
          <span>pomiń utwór / kolejna runda</span>
        </span>
        <span className="flex items-center gap-2">
          <kbd className="kbd">Enter</kbd>
          <span>zatwierdź</span>
        </span>
      </div>
    </section>
  );
}
