import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../node-compat/path.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const {
  default: pathCompat,
  basename,
  dirname,
  extname,
  format,
  isAbsolute,
  join,
  normalize,
  parse,
  relative,
  resolve,
} = await import(moduleUrl);

assert.equal(basename('/Users/sophia/claude.js'), 'claude.js');
assert.equal(basename('/Users/sophia/claude.js', '.js'), 'claude');
assert.equal(dirname('/Users/sophia/claude.js'), '/Users/sophia');
assert.equal(extname('/Users/sophia/archive.tar.gz'), '.gz');
assert.equal(extname('/Users/sophia/Makefile'), '');

assert.equal(join('/Users', 'sophia', '.', 'workspace', '..', 'claude'), '/Users/sophia/claude');
assert.equal(normalize('/Users//sophia/./workspace/../claude'), '/Users/sophia/claude');
assert.equal(normalize('workspace/./scripts/../node-compat'), 'workspace/node-compat');
assert.equal(isAbsolute('/Users/sophia'), true);
assert.equal(isAbsolute('Users/sophia'), false);

assert.equal(resolve('/Users/sophia', 'workspace', '../claude'), '/Users/sophia/claude');
assert.equal(relative('/Users/sophia/workspace', '/Users/sophia/node-compat/path.js'), '../node-compat/path.js');
assert.equal(relative('/Users/sophia/workspace', '/Users/sophia/workspace'), '');

assert.deepEqual(parse('/Users/sophia/claude.js'), {
  root: '/',
  dir: '/Users/sophia',
  base: 'claude.js',
  ext: '.js',
  name: 'claude',
});
assert.equal(format({ dir: '/Users/sophia', name: 'claude', ext: '.js' }), '/Users/sophia/claude.js');
assert.equal(format({ root: '/', base: 'claude.js' }), '/claude.js');

assert.equal(pathCompat.sep, '/');
assert.equal(pathCompat.delimiter, ':');
assert.equal(pathCompat.basename('/tmp/archive.zip', '.zip'), 'archive');
