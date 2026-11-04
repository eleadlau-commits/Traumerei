// Tests for the source editor's text handling.

import { test, assert } from 'folio/testing';
import { unfence } from '../unfence.js';

test('a code fence around pasted text is stripped', () => {
  assert.equal(unfence('```markdown\n## A\n- x\n```'), '## A\n- x\n');
  assert.equal(unfence('\n~~~\n## A\n~~~\n'), '## A\n');
  assert.equal(unfence('````md\n```\ninner\n```\n````'), '```\ninner\n```\n');
  assert.equal(unfence('## A\n- `code`'), '## A\n- `code`');
  assert.equal(unfence('Here it is:\n```\n## A\n```'), 'Here it is:\n```\n## A\n```');
});
