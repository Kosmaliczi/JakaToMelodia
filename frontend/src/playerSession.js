/**
 * Pomocnik do przechowywania sesji gracza (token JWT + metadane).
 * Wprowadzony w 0.2 (Faza 2).
 *
 * UWAGA: używamy `sessionStorage` (per karta), NIE `localStorage` (per origin),
 * żeby kilku graczy w jednej przeglądarce (różne karty) nie nadpisywali
 * sobie sesji. Sesja przeżywa refresh, ale nie przeżywa zamknięcia karty.
 */

const KEY_PREFIX = 'mel:session:';

function storage() {
  // SSR safety; w przeglądarce zawsze dostępne
  return typeof window !== 'undefined' ? window.sessionStorage : null;
}

function key(gameId) {
  return KEY_PREFIX + gameId;
}

export function saveSession(gameId, session) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(key(gameId), JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch (e) {
    console.warn('sessionStorage save failed:', e);
  }
}

export function loadSession(gameId) {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    if (parsed.expiresAtMs && parsed.expiresAtMs < Date.now()) {
      clearSession(gameId);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('sessionStorage load failed:', e);
    return null;
  }
}

export function clearSession(gameId) {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(key(gameId));
  } catch (e) {
    console.warn('sessionStorage clear failed:', e);
  }
}

/**
 * Wyrzuca WSZYSTKIE klucze mel:session:* z sessionStorage karty.
 * Używane przez HostGameView przy mount, żeby host nigdy nie miał
 * przyklejonego playera (i nie powodował 403 na /start).
 */
export function clearAllSessions() {
  const s = storage();
  if (!s) return;
  try {
    const keysToRemove = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(KEY_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => s.removeItem(k));
    if (keysToRemove.length > 0) {
      console.info('[melodia] clearAllSessions wyrzucił', keysToRemove.length, 'sesji playerów z karty hosta');
    }
  } catch (e) {
    console.warn('sessionStorage clearAll failed:', e);
  }
}

export function getTokenForGame(gameId) {
  return loadSession(gameId)?.token || null;
}
