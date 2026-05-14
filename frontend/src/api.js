async function parse(res) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body && body.message ? body.message : `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

const get = (url) =>
  fetch(url, { credentials: 'include' }).then(parse);

const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(parse);

export const api = {
  me: () => get('/api/auth/me'),
  token: () => get('/api/auth/token'),
  logout: () => post('/api/auth/logout'),
  diagnostics: (playlistId) =>
    get('/api/auth/diagnostics' + (playlistId ? `?playlistId=${encodeURIComponent(playlistId)}` : '')),
  playlists: () => get('/api/playlists'),
  startGame: (req) => post('/api/game/start', req),
  buzz: (gameId, playerId) => post(`/api/game/${gameId}/buzz`, { playerId }),
  guess: (gameId, playerId, userText) =>
    post(`/api/game/${gameId}/guess`, { playerId, userText }),
  next: (gameId) => post(`/api/game/${gameId}/next`),
  skip: (gameId) => post(`/api/game/${gameId}/skip`),
  status: (gameId) => get(`/api/game/${gameId}`),
};
