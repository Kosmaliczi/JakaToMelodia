export default function LoginView({ error }) {
  return (
    <section className="card relative overflow-hidden text-center">
      <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-spotify/20 blur-3xl" />
      <div className="relative">
        <span className="pill bg-spotify/15 text-spotify-light ring-1 ring-spotify/40">
          Muzyczna gra na imprezę
        </span>
        <h2 className="mt-3 font-display text-3xl font-bold">
          Zaloguj się przez <span className="text-gradient-spotify">Spotify</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
          Pełne utwory wymagają konta <span className="text-spotify-light">Premium</span>.
          Bez Premium gramy 30-sekundowe podglądy z iTunes — wystarczy do dobrej zabawy.
        </p>
        <a className="btn btn-primary btn-big mt-5" href="/oauth2/authorization/wolfship-auth">
          Zaloguj się
        </a>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}
