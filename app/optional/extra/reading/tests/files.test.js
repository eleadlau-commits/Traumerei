// Tests for Reading notes' linked files (files.js): paths kept relative to this computer's library
// folder, a quote's file page, verifying a file picked again, and what Copy path copies.

import { test, assert } from 'folio/testing';
import { relPath, fullPath, baseName, dirName, isAbsolute, attachment, filePage, verify, pathAndPage, sizeOf, linkOf, offsetOf } from '../files.js';
import { tidySource } from '../rules.js';

test('a path inside the library folder is kept relative to it; any other stays whole', () => {
  assert.equal(relPath('C:\\Users\\E\\Library', 'C:\\Users\\E\\Library\\Darwin\\origin.pdf'), 'Darwin/origin.pdf');
  assert.equal(relPath('c:\\users\\e\\library\\', 'C:\\Users\\E\\Library\\origin.pdf'), 'origin.pdf', 'Windows paths without case');
  assert.equal(relPath('/home/e/lib', '/home/e/lib/a/b.pdf'), 'a/b.pdf');
  assert.equal(relPath('/home/e/lib', '/home/e/library/b.pdf'), null, 'a folder with a longer name is not inside');
  assert.equal(relPath('/home/e/lib', '/home/e/lib'), null);
  assert.equal(fullPath('C:\\Users\\E\\Library', 'Darwin/origin.pdf'), 'C:\\Users\\E\\Library\\Darwin\\origin.pdf');
  assert.equal(fullPath('/home/e/lib/', 'a/b.pdf'), '/home/e/lib/a/b.pdf');
  assert.equal(fullPath('/x', 'D:\\other.pdf'), 'D:\\other.pdf');
  assert.equal(fullPath('', 'a.pdf'), 'a.pdf');
  assert.equal(baseName('C:\\a\\b.pdf'), 'b.pdf');
  assert.equal(dirName('C:\\a\\b.pdf'), 'C:\\a');
  assert.ok(isAbsolute('\\\\server\\share\\x') && isAbsolute('/x') && !isAbsolute('a/b'));
});

test('attaching keeps path, name, size, hash and offset; the first file sets the library folder', () => {
  const got = { name: 'origin.pdf', bytes: 812345, sha256: 'ab'.repeat(32) };
  const a = attachment(got, '"C:\\Users\\E\\Library\\origin.pdf"', '');
  assert.deepEqual(a.file, { rel: 'origin.pdf', name: 'origin.pdf', bytes: 812345, sha256: 'ab'.repeat(32), pageOffset: 0 });
  assert.equal(a.folder, 'C:\\Users\\E\\Library', 'the folder it is in, kept on this computer');
  const b = attachment(got, 'C:\\Users\\E\\Library\\Darwin\\origin.pdf', 'C:\\Users\\E\\Library', 18);
  assert.equal(b.file.rel, 'Darwin/origin.pdf');
  assert.equal(b.file.pageOffset, 18);
  assert.equal(b.folder, null, 'a folder already set is kept');
  const c = attachment(got, 'D:\\Elsewhere\\origin.pdf', 'C:\\Users\\E\\Library');
  assert.equal(c.file.rel, 'D:\\Elsewhere\\origin.pdf', 'outside the folder: whole');
  assert.equal(offsetOf('+18'), 18);
  assert.equal(offsetOf('x'), 0);
});

test('a quote\'s file page is its printed page plus the offset; front matter has none', () => {
  assert.equal(filePage('p. 112', 18), 130);
  assert.equal(filePage('pp. 112–113', '-2'), 110);
  assert.equal(filePage('p. xiv', 18), null);
  const f = { rel: 'Darwin/origin.pdf', name: 'origin.pdf', pageOffset: 18 };
  assert.equal(pathAndPage(f, '/lib', 'p. 112'), '/lib/Darwin/origin.pdf, p. 112 (file page 130)');
  assert.equal(pathAndPage({ ...f, pageOffset: 0 }, '/lib', 'p. 112'), '/lib/Darwin/origin.pdf, p. 112');
  assert.equal(pathAndPage(f, '/lib'), '/lib/Darwin/origin.pdf');
});

test('a file picked again is the same, changed or another', () => {
  const kept = { name: 'a.pdf', sha256: '11' };
  assert.equal(verify(kept, { name: 'renamed.pdf', sha256: '11' }), 'same');
  assert.equal(verify(kept, { name: 'a.pdf', sha256: '22' }), 'changed');
  assert.equal(verify(kept, { name: 'b.pdf', sha256: '22' }), 'other');
});

test('a source keeps only the file\'s path, name, size, hash and offset; a DOI opens at doi.org', () => {
  const g = tidySource({ file: { rel: 'a.pdf', name: 'a.pdf', bytes: '12', sha256: 'AB:cd', pageOffset: '3', text: 'never kept' } });
  assert.deepEqual(g.file, { rel: 'a.pdf', name: 'a.pdf', bytes: 12, sha256: 'abcd', pageOffset: 3 });
  assert.equal(tidySource({ file: { name: 'no path' } }).file, null);
  assert.equal(linkOf({ doi: 'https://doi.org/10.1000/xyz' }), 'https://doi.org/10.1000/xyz');
  assert.equal(linkOf({ doi: 'doi: 10.1000/abc' }), 'https://doi.org/10.1000/abc');
  assert.equal(linkOf({ url: 'http://example.org/x' }), 'https://example.org/x');
  assert.equal(linkOf({ url: 'ftp://x' }), null);
  assert.equal(sizeOf(812345), '793 KB');
  assert.equal(sizeOf(3.4 * 1024 * 1024), '3.4 MB');
});
