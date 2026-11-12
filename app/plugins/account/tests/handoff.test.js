// Tests for signing in from the desktop app through the browser: the addresses there and back.

import { test, assert } from 'folio/testing';
import { handoffUrl, readHandoff, returnUrl, readReturn, newState, WEB_APP } from '../handoff.js';

const STATE = '0123456789abcdef0123456789abcdef';

test('the hand-off address opens the live web app with the port and state', () => {
  const url = handoffUrl(51234, STATE);
  assert.equal(url.startsWith(WEB_APP), true);
  assert.deepEqual(readHandoff(new URL(url).search), { port: 51234, state: STATE });
});

test('a web app opened any other way is not a hand-off', () => {
  assert.equal(readHandoff(''), null);
  assert.equal(readHandoff('?room=1'), null);
  assert.equal(readHandoff(`?desktop-sign-in=80&state=${STATE}`), null); // a low port
  assert.equal(readHandoff(`?desktop-sign-in=51234&state=nope`), null);
  assert.equal(readHandoff(`?desktop-sign-in=abc&state=${STATE}`), null);
});

test('the way back goes to this computer only, and the app takes it when the state is its own', () => {
  const url = returnUrl({ port: 51234, state: STATE }, 'id.tok/en+=', 'acc');
  assert.equal(url.startsWith('http://127.0.0.1:51234/done?'), true);
  const path = url.slice('http://127.0.0.1:51234'.length);
  assert.deepEqual(readReturn(path, STATE), { idToken: 'id.tok/en+=', accessToken: 'acc' });
  assert.equal(readReturn(path, 'f'.repeat(32)), null);
  assert.equal(readReturn('/favicon.ico', STATE), null);
  assert.equal(readReturn(`/done?state=${STATE}`, STATE), null); // no tokens
});

test('each state is new and well formed', () => {
  const a = newState();
  assert.equal(/^[0-9a-f]{32}$/.test(a), true);
  assert.equal(a === newState(), false);
});
