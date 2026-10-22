// A tiny test library. Test files sit in a feature's tests/ folder and end in .test.js:
//
//   import { test, assert } from 'folio/testing';
//   import { lookupPlace } from '../places.js';
//
//   test('CLC013 is in the Calman Learning Centre', () => {
//     assert.equal(lookupPlace('CLC013').building, 'Calman Learning Centre');
//   });
//
// `python build.py test` runs them in a browser and reports the results.

const tests = [];
let currentFile = '';

export function test(name, fn) {
  tests.push({ name, fn, file: currentFile });
}

class AssertionError extends Error {}

function show(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const assert = {
  ok(value, message = `Expected a true value, got ${show(value)}`) {
    if (!value) throw new AssertionError(message);
  },
  equal(actual, expected, message) {
    if (actual !== expected) throw new AssertionError(message || `Expected ${show(expected)}, got ${show(actual)}`);
  },
  deepEqual(actual, expected, message) {
    if (show(actual) !== show(expected)) throw new AssertionError(message || `Expected ${show(expected)}, got ${show(actual)}`);
  },
  match(text, pattern, message) {
    if (!pattern.test(String(text))) throw new AssertionError(message || `Expected ${show(text)} to match ${pattern}`);
  },
  throws(fn, pattern, message) {
    try {
      fn();
    } catch (err) {
      if (pattern && !pattern.test(err.message)) throw new AssertionError(message || `Wrong error: ${err.message}`);
      return;
    }
    throw new AssertionError(message || 'Expected an error, but none was thrown');
  },
};

// Loads each test file, runs its tests, and returns { passed, failed, results }.
export async function run(files) {
  const results = [];
  for (const file of files) {
    currentFile = file;
    try {
      await import(new URL(file, document.baseURI).href);
    } catch (err) {
      results.push({ file, name: '(loading the file)', ok: false, error: err.message });
    }
  }
  for (const t of tests) {
    try {
      await t.fn();
      results.push({ file: t.file, name: t.name, ok: true });
    } catch (err) {
      results.push({ file: t.file, name: t.name, ok: false, error: err.message });
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  return { passed: results.length - failed, failed, results };
}
