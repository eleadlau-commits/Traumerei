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
