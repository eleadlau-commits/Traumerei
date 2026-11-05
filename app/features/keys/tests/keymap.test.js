// Tests for the key map's rules: reading keys, matching presses, writing them, and clashes,
// including the keys the room, the rooms page and the docks really add.

import { test, assert } from 'folio/testing';
import { parse, normal, matches, label, clashes } from '../keymap.js';
import { ROOM_KEYS } from '../../room/keys.js';
import { ROOMS_KEYS } from '../../rooms/keys.js';
import { DOCK_KEYS } from '../../docks/keys.js';

const press = (o) => ({ key: '', code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o });

test('keys are read from words', () => {
  assert.deepEqual(parse('Ctrl+Alt+E'), { ctrl: true, alt: true, shift: false, key: 'e' });
  assert.deepEqual(parse('Cmd+K'), { ctrl: true, alt: false, shift: false, key: 'k' });
  assert.deepEqual(parse('Delete'), { ctrl: false, alt: false, shift: false, key: 'Delete' });
  assert.equal(parse('Ctrl++').key, '+');
  assert.equal(parse('Hyper+K'), null);
  assert.equal(parse(''), null);
  assert.equal(normal('alt+ctrl+e'), normal('Ctrl+Alt+E'));
  assert.equal(normal('Shift+?'), normal('?'));
});

test('a press matches its key and nothing else', () => {
  assert.ok(matches('Ctrl+K', press({ key: 'k', code: 'KeyK', ctrlKey: true })));
  assert.ok(matches('Ctrl+K', press({ key: 'k', code: 'KeyK', metaKey: true })), 'Cmd counts as Ctrl');
  assert.ok(!matches('Ctrl+K', press({ key: 'k', code: 'KeyK' })));
  assert.ok(!matches('Ctrl+K', press({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true })));
  assert.ok(matches('Ctrl+Alt+E', press({ key: '´', code: 'KeyE', ctrlKey: true, altKey: true })), 'by where the letter is');
  assert.ok(!matches('Ctrl+Alt+E', press({ key: '€', code: 'KeyE', ctrlKey: true, altKey: true, getModifierState: (m) => m === 'AltGraph' })), 'AltGr is not Ctrl+Alt');
  assert.ok(matches('?', press({ key: '?', code: 'Slash', shiftKey: true })), 'a sign ignores Shift');
  assert.ok(matches('Delete', press({ key: 'Delete', code: 'Delete' })));
  assert.ok(!matches('Delete', press({ key: 'Backspace', code: 'Backspace' })));
  assert.ok(matches('Shift+ArrowLeft', press({ key: 'ArrowLeft', shiftKey: true })));
});

test('keys are written for the screen', () => {
  assert.equal(label('Ctrl+Alt+E'), 'Ctrl+Alt+E');
  assert.equal(label('ctrl+shift+z'), 'Ctrl+Shift+Z');
  assert.equal(label('Ctrl+K', true), '⌘K');
  assert.equal(label('?'), '?');
});

test('two actions on one key in one place clash; in different places they do not', () => {
  const found = clashes([
    { id: 'a', keys: ['Ctrl+G'], zone: 'room' },
    { id: 'b', keys: ['ctrl+g'], zone: 'room' },
    { id: 'c', keys: ['Ctrl+G'], zone: 'rooms' },
    { id: 'd', keys: ['Delete'], zone: 'room' },
    { id: 'e', keys: ['Delete'], zone: 'rooms' },
    { id: 'f', keys: ['Ctrl+Alt+F'], zone: 'everywhere' },
    { id: 'g', keys: ['Ctrl+Alt+F'], zone: 'rooms' },
  ]);
  assert.deepEqual(found.map((c) => `${c.a}/${c.b}`), ['a/b', 'f/g']);
});

test('the keys the app adds are all readable and never clash', () => {
  const all = [{ id: 'keys.list', keys: ['?'], zone: 'everywhere' }, ...ROOM_KEYS.map((k) => ({ ...k, zone: 'room' })), ...ROOMS_KEYS.map((k) => ({ ...k, zone: 'rooms' })), ...DOCK_KEYS.map((k) => ({ ...k, zone: 'everywhere' }))];
  for (const k of all) for (const c of k.keys || []) assert.ok(parse(c), `${k.id}: ${c}`);
  for (const k of all) assert.ok((k.keys || []).length || k.shows, `${k.id} has keys or words to show`);
  assert.deepEqual(clashes(all), []);
});
