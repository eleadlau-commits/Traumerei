// Tests for Returns's rules. `python build.py test` runs every *.test.js file of every feature.

import { test, assert } from 'folio/testing';
import { dayWords, why, stateLine, morning, fromField, firstLine, label } from '../rules.js';

const NOW = new Date(2026, 10, 8, 12).getTime();
const DAY = 864e5;

test('a day in words: today, tomorrow, yesterday, a weekday within a week, else the date', () => {
  assert.equal(dayWords(NOW, NOW), 'today');
  assert.equal(dayWords(NOW + DAY, NOW), 'tomorrow');
  assert.equal(dayWords(NOW - DAY, NOW), 'yesterday');
  assert.equal(dayWords(NOW + 3 * DAY, NOW), 'Wed 11 Nov');
  assert.equal(dayWords(NOW - 30 * DAY, NOW), '9 Oct');
  assert.equal(dayWords(new Date(2025, 0, 3).getTime(), NOW), '3 Jan 2025');
});

test('why a mark is back, and the Editor line for each state', () => {
  assert.equal(why({ kind: 'due', at: NOW - DAY, state: 'back' }, NOW), 'Due yesterday');
  assert.equal(why({ kind: 'revisit', at: NOW, set: NOW - 30 * DAY, state: 'back' }, NOW), 'Revisit, asked 9 Oct');
  assert.equal(why({ kind: 'revisit', at: NOW + DAY, state: 'waiting' }, NOW), 'Revisit tomorrow');
  assert.equal(why({ kind: 'return', note: 'x', state: 'back' }, NOW), 'Left for this visit');
  assert.equal(stateLine(null), '');
  assert.equal(stateLine({ kind: 'return', note: 'x', state: 'waiting' }, NOW), 'Waits for the next visit');
  assert.equal(stateLine({ kind: 'due', at: NOW, state: 'back', back: NOW }, NOW), 'Back since today: in Returns');
  assert.equal(stateLine({ kind: 'due', at: NOW - DAY, state: 'refused', back: NOW, answered: NOW }, NOW), 'Refused today (due yesterday)');
});

test('quick times, date fields, a line of words, the strip label', () => {
  assert.equal(new Date(morning(NOW, 1)).getHours(), 9);
  assert.equal(new Date(morning(NOW, 7)).getDate(), 15);
  assert.equal(fromField('2026-11-12'), new Date(2026, 10, 12, 9).getTime());
  assert.equal(fromField(''), null);
  assert.equal(firstLine('\n  Send chapter two\nmore'), 'Send chapter two');
  assert.equal(firstLine(''), 'Untitled');
  assert.equal(firstLine('a'.repeat(100), 10).length, 10);
  assert.equal(label(0), 'Returns');
  assert.equal(label(2), 'Returns · 2');
});
