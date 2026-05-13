import { api } from './api.js';

let player = null;
let deviceId = null;
let token = null;
let tokenExpiresAt = 0;
let initPromise = null;

const sdkReady = new Promise((resolve) => {
  if (window.Spotify) {
    resolve();
    return;
  }
  window.onSpotifyWebPlaybackSDKReady = () => resolve();
});

async function refreshToken() {
  const res = await api.token();
  token = res.accessToken;
  tokenExpiresAt = Date.now() + Math.max(60, res.expiresIn - 60) * 1000;
  return token;
}

async function getValidToken() {
  if (!token || Date.now() >= tokenExpiresAt) {
    await refreshToken();
  }
  return token;
}

export async function initSdk() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await sdkReady;
    await refreshToken();

    player = new window.Spotify.Player({
      name: 'Jaka to Melodia',
      getOAuthToken: async (cb) => cb(await getValidToken()),
      volume: 0.7,
    });

    player.addListener('initialization_error', ({ message }) =>
      console.error('SDK initialization_error:', message)
    );
    player.addListener('authentication_error', ({ message }) =>
      console.error('SDK authentication_error:', message)
    );
    player.addListener('account_error', ({ message }) =>
      console.error('SDK account_error:', message)
    );
    player.addListener('playback_error', ({ message }) =>
      console.error('SDK playback_error:', message)
    );

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('SDK nie zgłosił "ready" w 15s')),
        15000
      );
      player.addListener('ready', ({ device_id }) => {
        clearTimeout(timer);
        deviceId = device_id;
        resolve({ deviceId });
      });
      player.connect().then((ok) => {
        if (!ok) reject(new Error('player.connect() zwróciło false'));
      });
    });
  })();
  return initPromise;
}

export async function play(uri) {
  if (!deviceId) throw new Error('SDK device niegotowy');
  const accessToken = await getValidToken();
  const res = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [uri] }),
    }
  );
  if (!res.ok && res.status !== 204) {
    const txt = await res.text();
    throw new Error(`Spotify play error ${res.status}: ${txt}`);
  }
}

export async function pause() {
  if (!player) return;
  try {
    await player.pause();
  } catch (e) {
    console.warn('pause:', e);
  }
}

export async function resume() {
  if (!player) return;
  try {
    await player.resume();
  } catch (e) {
    console.warn('resume:', e);
  }
}
