// Tests for the file seam (files.js): a browser saves by download, the desktop app by its
// save_file command (bytes, so a zip survives), and a cancelled Save says false.

import { test, assert } from 'folio/testing';
import { files, desktop } from '../files.js';

const seam = (got) => files({ download: (...a) => { got.push(a); return true; }, picker: () => ({ pick: async () => null }) });

test('in a browser, save is a download and open is the picker', async () => {
  const got = [];
  const f = seam(got);
  assert.equal(desktop(), false);
  assert.equal(await f.save('a.traum', 'words', 'text/plain'), true);
  assert.deepEqual(got, [['a.traum', 'words', 'text/plain']]);
  assert.equal(await f.open('.traum'), null); // the picker chose nothing
});

test('in the desktop app, save asks the shell and passes bytes', async () => {
  const calls = [];
  window.__TAURI_INTERNALS__ = { invoke: async (cmd, args) => { calls.push([cmd, args]); return args.name !== 'no.md'; } };
  try {
    const got = [];
    const f = seam(got);
    assert.equal(desktop(), true);
    assert.equal(await f.save('ä.md', 'hé'), true);
    assert.deepEqual(calls[0], ['save_file', { name: 'ä.md', bytes: [...new TextEncoder().encode('hé')] }]);
    assert.equal(await f.save('z.zip', new Blob([new Uint8Array([0, 255, 7])])), true);
    assert.deepEqual(calls[1][1].bytes, [0, 255, 7]);
    assert.equal(await f.save('no.md', 'x'), false); // cancelled
    window.__TAURI_INTERNALS__.invoke = async () => { throw new Error('denied'); };
    assert.equal(await f.save('a.md', 'x'), false);
    assert.equal(got.length, 0); // never a browser download inside the app
  } finally { delete window.__TAURI_INTERNALS__; }
});

test('a file opened from Windows reaches everyone hearing, as a File; never in a browser', async () => {
  const f = seam([]);
  assert.equal(typeof f.arrived(() => {}), 'function'); // a browser: nothing to hear
  let queue = [['Book.traum', [...new TextEncoder().encode('---\nformat: traum/3\n')]]];
  window.__TAURI_INTERNALS__ = { invoke: async (cmd) => { assert.equal(cmd, 'take_opened'); const q = queue; queue = []; return q; } };
  try {
    const heard = [];
    const off = f.arrived((file) => heard.push(file));
    await new Promise((r) => setTimeout(r, 20)); // the page has loaded: the queued file is taken
    assert.equal(heard.length, 1);
    assert.equal(heard[0].name, 'Book.traum');
    assert.equal(await heard[0].text(), '---\nformat: traum/3\n');
    queue = [['Two.traum', [104, 105]]];
    await window.__traumereiOpened(); // the shell pokes the page for a second double-click
    assert.equal(heard.length, 2);
    off();
    queue = [['Three.traum', [104]]];
    await window.__traumereiOpened();
    assert.equal(heard.length, 2); // no one hearing: the shell keeps it
    assert.equal(queue.length, 1);
  } finally { delete window.__TAURI_INTERNALS__; delete window.__traumereiOpened; }
});

test('a link opens only an https address; in the desktop app through the shell', async () => {
  const { link } = await import('../files.js');
  assert.equal(link('javascript:alert(1)'), false);
  assert.equal(link('file:///C:/x'), false);
  const calls = [];
  window.__TAURI_INTERNALS__ = { invoke: async (cmd, args) => { calls.push([cmd, args]); } };
  try {
    assert.equal(link('https://github.com/eleadlau-commits/Traumerei/releases/latest'), true);
    assert.deepEqual(calls, [['open_link', { url: 'https://github.com/eleadlau-commits/Traumerei/releases/latest' }]]);
  } finally { delete window.__TAURI_INTERNALS__; }
});

test('a round trip through the browser: a port from the shell, the address opened, the way back handed over', async () => {
  const { roundTrip } = await import('../files.js');
  assert.equal(await roundTrip((port) => `https://example.org/?p=${port}`), null); // in a browser: never
  const calls = [];
  window.__TAURI_INTERNALS__ = { invoke: async (cmd, args) => { calls.push([cmd, args]); return cmd === 'sign_in_port' ? 51234 : cmd === 'sign_in_wait' ? '/done?state=x' : undefined; } };
  try {
    assert.equal(await roundTrip((port) => `https://example.org/?p=${port}`), '/done?state=x');
    assert.deepEqual(calls.map((c) => c[0]), ['sign_in_port', 'open_link', 'sign_in_wait']);
    assert.deepEqual(calls[1][1], { url: 'https://example.org/?p=51234' });
    calls.length = 0;
    assert.equal(await roundTrip((port) => `http://example.org/?p=${port}`), null); // only https goes out
    assert.deepEqual(calls.map((c) => c[0]), ['sign_in_port']);
    window.__TAURI_INTERNALS__.invoke = async () => { throw new Error('timed out'); };
    assert.equal(await roundTrip((port) => `https://example.org/?p=${port}`), null);
  } finally { delete window.__TAURI_INTERNALS__; }
});
