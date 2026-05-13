export default function LoginView({ error }) {
  return (
    <div className="card text-center">
      <h2 className="mb-3 text-2xl font-semibold">Zaloguj się przez Spotify</h2>
      <p className="mb-4 text-slate-400">
        Aplikacja używa Web Playback SDK, który wymaga{' '}
        <span className="text-spotify-light">Spotify Premium</span>.
      </p>
      <a className="btn btn-primary btn-big" href="/oauth2/authorization/wolfship-auth">
        Zaloguj się
      </a>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
