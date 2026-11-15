// Tests for putting a fresh drawing in place by changing only what changed (patch.js).

import { test, assert } from 'folio/testing';
import { patchChildren } from '../patch.js';

const div = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
const fresh = (html) => [...div(html).childNodes];

test('a node drawn the same stays; only the new one goes in', () => {
  const box = div('<p data-thought="a">one</p><p data-thought="b">two</p>');
  const [a, b] = box.children;
  const put = patchChildren(box, fresh('<p data-thought="a">one</p><p class="draft">x</p><p data-thought="b">two</p>'));
  assert.equal(put, 1);
  assert.equal(box.children[0], a);
  assert.equal(box.children[2], b);
  assert.equal(box.innerHTML, '<p data-thought="a">one</p><p class="draft">x</p><p data-thought="b">two</p>');
});

test('a node drawn differently is replaced; one no longer drawn goes', () => {
  const box = div('<p data-thought="a">one</p><p data-thought="b">two</p><p data-thought="c">three</p>');
  const c = box.children[2];
  patchChildren(box, fresh('<p data-thought="a" class="selected">one</p><p data-thought="c">three</p>'));
  assert.equal(box.innerHTML, '<p data-thought="a" class="selected">one</p><p data-thought="c">three</p>');
  assert.equal(box.children[1], c);
});

test('a layer of lines is kept and patched line by line', () => {
  const NS = 'http://www.w3.org/2000/svg';
  const box = div(`<svg class="lines"><g data-group="t1"><path d="M0 0"></path></g><g data-group="t2"><path d="M1 1"></path></g></svg>`);
  const svg = box.firstChild, t2 = svg.children[1];
  const next = document.createElementNS(NS, 'svg');
  next.setAttribute('class', 'lines');
  next.innerHTML = '<g data-group="t1"><path d="M0 0"></path><path d="M0 9"></path></g><g data-group="t2"><path d="M1 1"></path></g>';
  patchChildren(box, [next]);
  assert.equal(box.firstChild, svg, 'the same layer');
  assert.equal(svg.children[1], t2, 'the untouched train kept');
  assert.equal(svg.children[0].children.length, 2, 'the train begun again has its new line');
});

test('nodes that moved are put back in the drawn order', () => {
  const box = div('<i>1</i><i>2</i><i>3</i>');
  patchChildren(box, fresh('<i>3</i><i>1</i><i>2</i>'));
  assert.equal(box.innerHTML, '<i>3</i><i>1</i><i>2</i>');
});
