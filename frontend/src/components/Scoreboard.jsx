const AVATAR_COLORS = [
  'from-pink-500 to-rose-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-sky-400 to-indigo-500',
  'from-purple-400 to-fuchsia-500',
  'from-red-400 to-rose-600',
];

function avatarPalette(name) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase().slice(0, 2);
}

export default function Scoreboard({ players, activeId }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  return (
    <section className="card">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Tablica wyników
        </h3>
      </header>
      <ul className="space-y-1.5">
        {sorted.map((p, idx) => {
          const isActive = p.id === activeId;
          const isLeader = p.score > 0 && p.score === top;
          return (
            <li
              key={p.id}
              className={
                'group flex items-center gap-3 rounded-xl px-3 py-2 transition ' +
                (isActive
                  ? 'bg-spotify/15 ring-1 ring-spotify animate-pulse-ring'
                  : 'hover:bg-white/5') +
                (p.lockedOut ? ' opacity-40' : '')
              }
            >
              <span className="w-5 text-center font-mono text-xs text-slate-500">
                {idx + 1}
              </span>
              <span
                className={
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-md ' +
                  avatarPalette(p.name)
                }
              >
                {initials(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={'truncate font-medium ' + (p.lockedOut ? 'line-through' : '')}>
                    {p.name}
                  </span>
                  {isLeader && (
                    <span className="text-amber-400" title="Lider">★</span>
                  )}
                  {p.lockedOut && (
                    <span className="pill bg-red-500/15 text-red-300">out</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <kbd className="kbd">{p.hotkey}</kbd>
                  <span>hotkey</span>
                </div>
              </div>
              <span className="font-mono text-lg font-semibold tabular-nums text-slate-100">
                {p.score}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
