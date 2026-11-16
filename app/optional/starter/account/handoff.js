// Signing in from the desktop app: Google's sign-in can't open inside the app window, so the app
// hands it to the person's browser and back (the loopback way native apps sign in).
//
// 1. The app asks the shell for a port on this computer (sign_in_port, desktop/src-tauri/src/main.rs)
//    and opens the live web app in the browser at handoffUrl(port, state).
// 2. The web app sees readHandoff(location.search) and shows one button; the person signs in with
//    Google there, in a Firebase app of its own that remembers nothing, so the browser's own copy of
//    Träumerei is never signed in or synced by it.
// 3. The browser goes to returnUrl(...) on this computer; the shell (sign_in_wait) hands that
//    address to the app, which checks the state with readReturn and signs in with Google's tokens.

export const WEB_APP = 'https://eleadlau-commits.github.io/Traumerei/';

// A random word the app keeps, so only its own browser hand-off can sign it in.
export function newState() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const goodPort = (p) => Number.isInteger(p) && p >= 1024 && p <= 65535;
const goodState = (s) => typeof s === 'string' && /^[0-9a-f]{16,64}$/.test(s);

export function handoffUrl(port, state) {
  return `${WEB_APP}?desktop-sign-in=${port}&state=${state}`;
}

// { port, state } when the web app was opened by the desktop app to sign in, else null.
export function readHandoff(search) {
  const q = new URLSearchParams(search || '');
  if (!q.has('desktop-sign-in')) return null;
  const port = Number(q.get('desktop-sign-in'));
  const state = q.get('state');
  return goodPort(port) && goodState(state) ? { port, state } : null;
}

// Where the browser goes once signed in: the desktop app's port on this computer, with the tokens.
export function returnUrl({ port, state }, idToken, accessToken) {
  const q = new URLSearchParams({ state, id_token: idToken || '', access_token: accessToken || '' });
  return `http://127.0.0.1:${port}/done?${q}`;
}

// The tokens from the address the shell heard (its path, /done?…), when the state is ours; else null.
export function readReturn(path, state) {
  const m = /^\/done\?(.*)$/.exec(String(path || ''));
  if (!m || !goodState(state)) return null;
  const q = new URLSearchParams(m[1]);
  if (q.get('state') !== state) return null;
  const idToken = q.get('id_token') || null;
  const accessToken = q.get('access_token') || null;
  return idToken || accessToken ? { idToken, accessToken } : null;
}
