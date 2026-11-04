// Tests for mathematics in a thought's words (maths.js).

import { test, assert } from 'folio/testing';
import { split, maths } from '../maths.js';

const T = (value) => ({ type: 'text', value });
const I = (value) => ({ type: 'inline', value });
const D = (value) => ({ type: 'display', value });

test('words without dollars are one piece of text', () => {
  assert.deepEqual(split('Just words.'), [T('Just words.')]);
  assert.deepEqual(split(''), []);
  assert.equal(maths('Just words.'), 'Just words.');
});

test('$…$ is inline maths, $$…$$ is display maths', () => {
  assert.deepEqual(split('A matrix $A$ is invertible iff $\\det A \\neq 0$'),
    [T('A matrix '), I('A'), T(' is invertible iff '), I('\\det A \\neq 0')]);
  assert.deepEqual(split('So $$A = PDP^{-1}$$ always.'), [T('So '), D('A = PDP^{-1}'), T(' always.')]);
});

test('\\$ is a dollar sign, outside maths and inside it', () => {
  assert.deepEqual(split('It costs \\$5.'), [T('It costs $5.')]);
  assert.deepEqual(split('\\$x\\$'), [T('$x$')]);
  assert.deepEqual(split('$\\$5$'), [I('\\$5')]);
});

test('a $ that never closes stays as words', () => {
  assert.deepEqual(split('Pay $5 now'), [T('Pay $5 now')]);
  assert.deepEqual(split('$x'), [T('$x')]);
  assert.deepEqual(split('$$x'), [T('$$x')]);
  assert.deepEqual(split('trailing $'), [T('trailing $')]);
});

test('prices are not maths (Pandoc\'s rule)', () => {
  assert.deepEqual(split('$20,000 and $30,000'), [T('$20,000 and $30,000')]);
  assert.deepEqual(split('$ x$'), [T('$ x$')]); // a space after the opening $
  assert.deepEqual(split('$x $'), [T('$x $')]); // a space before the closing $
  assert.deepEqual(split('$x$5'), [T('$x$5')]); // a digit after the closing $
});

test('inline maths stays on one line; display maths may span lines', () => {
  assert.deepEqual(split('$a\nb$'), [T('$a\nb$')]);
  assert.deepEqual(split('Then\n$$\nA = PDP^{-1}\n$$\nso.'), [T('Then\n'), D('\nA = PDP^{-1}\n'), T('\nso.')]);
});

test('$$ inside a passage body, among other lines', () => {
  const body = 'Let $A$ be square.\n$$\\det(AB) = \\det A \\det B$$\nHence $\\det A^{-1} = 1/\\det A$.';
  assert.deepEqual(split(body), [T('Let '), I('A'), T(' be square.\n'), D('\\det(AB) = \\det A \\det B'),
    T('\nHence '), I('\\det A^{-1} = 1/\\det A'), T('.')]);
});

test('an empty $$ $$ stays as words', () => {
  assert.deepEqual(split('$$$$'), [T('$$$$')]);
  assert.deepEqual(split('a $$ $$ b'), [T('a $$ $$ b')]);
});

test('drawn: maths becomes KaTeX, a bad formula shows its source quietly', () => {
  const parts = maths('x $\\frac{1}{2}$ and $\\frac{1$');
  assert.equal(parts[0], 'x ');
  assert.ok(parts[1].querySelector('.katex'));
  assert.equal(parts[2], ' and ');
  assert.ok(parts[3].classList.contains('unparsed'));
  assert.equal(parts[3].textContent, '$\\frac{1$');
});

test('drawn: the line breaks around display maths are left out', () => {
  const parts = maths('Then\n$$A$$\nso.');
  assert.equal(parts[0], 'Then');
  assert.ok(parts[1].classList.contains('display'));
  assert.equal(parts[2], 'so.');
});
