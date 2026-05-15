import { getTokenForGame } from './playerSession.js';

// Marker wersji — sprawdź w konsoli przeglądarki, czy widzisz ten napis.
// Jeśli nie — bundle jest stary, zrób `docker compose build --no-cache`.
const FRONTEND_BUILD_TAG = '0.2.3-lan-qr-2026-05-15';
if (typeof window !== 'undefined') {
  console.info('[melodia] frontend build:', FRONTEND_BUILD_TAG);
}

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

/**
 * Host-only POST — gwarantowanie BRAK nagłówka Authorization.
 * Niezależnie od stanu sessionStorage. Cookie OAuth2 wystarcza.
 */
function hostPost(url, body) {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
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

  // === HOST-only — gwarantowany brak Bearer, tylko cookie OAuth2.
  startGame: (req) => hostPost('/api/game/start', req),
  createLobby: (req) => hostPost('/api/game/lobby', req),
  startLobby: (gameId) => hostPost(`/api/game/${gameId}/start`),
  next: (gameId) => hostPost(`/api/game/${gameId}/next`),
  skip: (gameId) => hostPost(`/api/game/${gameId}/skip`),

  // === Mieszane / player — Bearer z sessionStorage tej karty (jeśli jest)
  setReady: (gameId, ready) => post(`/api/game/${gameId}/ready`, { ready }, { gameId }),
  buzz: (gameId, playerId) =>
    post(`/api/game/${gameId}/buzz`, { playerId }, { gameId }),
  guess: (gameId, playerId, userText) =>
    post(`/api/game/${gameId}/guess`, { playerId, userText }, { gameId }),
  gameStatus: (gameId) => get(`/api/game/${gameId}`, { gameId }),

  resolveRoomCode: (code) => get(`/api/rooms/code/${encodeURIComponent(code)}`),
  joinRoom: (code, name) => post(`/api/rooms/${encodeURIComponent(code)}/join`, { name }),

  // LAN-only — adresy site-local pod którymi serwer jest dostępny
  lanAddresses: () => get('/api/network/lan-addresses'),
};
