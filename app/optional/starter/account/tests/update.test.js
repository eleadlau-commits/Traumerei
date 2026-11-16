// Tests for the desktop app's update check: which version counts as newer.

import { test, assert } from 'folio/testing';
import { newerThan } from '../Account.js';

test('a newer version is newer by its first differing number', () => {
  assert.equal(newerThan('1.0.1', '1.0.0'), true);
  assert.equal(newerThan('1.10.0', '1.9.9'), true);
  assert.equal(newerThan('2', '1.9'), true);
  assert.equal(newerThan('1.0.0', '1.0.0'), false);
  assert.equal(newerThan('1.0', '1.0.0'), false);
  assert.equal(newerThan('0.9.9', '1.0.0'), false);
  assert.equal(newerThan('', '1.0.0'), false);
});
