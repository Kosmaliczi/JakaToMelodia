import { getTokenForGame } from './playerSession.js';

async function parse(res) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = body && (body.message || body.error) ? (body.message || body.error) : `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function authHeaders(gameId) {
  const token = gameId ? getTokenForGame(gameId) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function get(url, opts = {}) {
  return fetch(url, {
    credentials: 'include',
    headers: { ...authHeaders(opts.gameId) },
  }).then(parse);
}

function post(url, body, opts = {}) {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(opts.gameId),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(parse);
}

export const api = {
  me: () => get('/api/auth/me'),
  token: () => get('/api/auth/token'),
  logout: () => post('/api/auth/logout'),
  diagnostics: (playlistId) =>
    get('/api/auth/diagnostics' + (playlistId ? `?playlistId=${encodeURIComponent(playlistId)}` : '')),
  playlists: () => get('/api/playlists'),

  startGame: (req) => post('/api/game/start', req),
  createLobby: (req) => post('/api/game/lobby', req),
  startLobby: (gameId) => post(`/api/game/${gameId}/start`, undefined, { gameId }),
  setReady: (gameId, ready) => post(`/api/game/${gameId}/ready`, { ready }, { gameId }),
  buzz: (gameId, playerId) =>
    post(`/api/game/${gameId}/buzz`, { playerId }, { gameId }),
  guess: (gameId, playerId, userText) =>
    post(`/api/game/${gameId}/guess`, { playerId, userText }, { gameId }),
  next: (gameId) => post(`/api/game/${gameId}/next`, undefined, { gameId }),
  skip: (gameId) => post(`/api/game/${gameId}/skip`, undefined, { gameId }),
  gameStatus: (gameId) => get(`/api/game/${gameId}`, { gameId }),

  // 0.2
  resolveRoomCode: (code) => get(`/api/rooms/code/${encodeURIComponent(code)}`),
  joinRoom: (code, name) => post(`/api/rooms/${encodeURIComponent(code)}/join`, { name }),
};
