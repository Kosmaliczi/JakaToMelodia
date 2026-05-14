/**
 * Pomocnik do przechowywania sesji gracza (token JWT + metadane) w localStorage.
 * Wprowadzony w 0.2 (Faza 2).
 */

const KEY_PREFIX = 'mel:session:';

function key(gameId) {
  return KEY_PREFIX + gameId;
}

export function saveSession(gameId, session) {
  try {
    localStorage.setItem(key(gameId), JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

export function loadSession(gameId) {
  try {
    const raw = localStorage.getItem(key(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    if (parsed.expiresAtMs && parsed.expiresAtMs < Date.now()) {
      clearSession(gameId);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('localStorage load failed:', e);
    return null;
  }
}

export function clearSession(gameId) {
  try {
    localStorage.removeItem(key(gameId));
  } catch (e) {
    console.warn('localStorage clear failed:', e);
  }
}

export function getTokenForGame(gameId) {
  return loadSession(gameId)?.token || null;
}
