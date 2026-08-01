// Regression test for the Edit tool silently mangling "$" sequences on the
// way to disk. Run with the repo's own qjs: `./quickjs-2024-01-13/qjs
// tests/test_edit_dollar_sequences.js` from the repo root.
//
// String.prototype.replace(str, str) treats the *replacement* argument as a
// pattern string even when the *search* argument is a plain string: "$$",
// "$&", "$`", "$'" and "$<n>" all get expanded per the ECMA-262 spec. Every
// file this tool writes on disk on Tiger/Leopard is a real user's source
// file, shell script, or Makefile, all of which routinely contain literal
// "$" sequences, so this silently corrupted content instead of raising an
// error the way a mismatched old_string does.
//
// This test extracts the real `const tools = { ... };` block straight out
// of the shipped source with no reimplementation, so a regression (the fix
// being reverted, or a similar bug reappearing) fails here even if nobody
// remembers why the fix was needed.

import * as std from 'std';
import * as os from 'os';

let passed = 0;
let failed = 0;

function check(cond, msg) {
    if (cond) {
        passed++;
    } else {
        failed++;
        print('FAIL: ' + msg);
    }
}

function loadTools(sourcePath) {
    const src = std.loadFile(sourcePath);
    if (!src) throw new Error('cannot read ' + sourcePath);
    const start = src.indexOf('const tools = {');
    if (start === -1) throw new Error('tools block not found in ' + sourcePath);
    const end = src.indexOf('\n};', start);
    if (end === -1) throw new Error('end of tools block not found in ' + sourcePath);
    const block = src.slice(start, end + 3);
    const factory = new Function('std', 'os', block + '\nreturn tools;');
    return factory(std, os);
}

function writeTemp(contents) {
    const path = '/tmp/edit_dollar_test_' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.txt';
    const f = std.open(path, 'w');
    f.puts(contents);
    f.close();
    return path;
}

function readAll(path) {
    const f = std.open(path, 'r');
    const s = f.readAsString();
    f.close();
    return s;
}

function runSuite(label, sourcePath) {
    const tools = loadTools(sourcePath);

    // 1. Every ECMA-262 special replacement pattern must survive byte-for-byte.
    {
        const path = writeTemp('price is OLDVAL end of line OLDVAL2');
        const newString = "X$50 (was $$100, match=$&, before=$`, after=$', group=$1)";
        const res = tools.Edit({ file_path: path, old_string: 'OLDVAL', new_string: newString });
        check(res && res.success, label + ': Edit reported success for $-sequence replacement');
        const written = readAll(path);
        check(written === 'price is ' + newString + ' end of line OLDVAL2',
              label + ': $-sequences written byte-for-byte, got ' + JSON.stringify(written));
        os.remove(path);
    }

    // 2. Non-replace_all still touches only the first occurrence.
    {
        const path = writeTemp('AA needle AA needle AA');
        const res = tools.Edit({ file_path: path, old_string: 'needle', new_string: 'X' });
        check(res && res.success, label + ': single Edit reported success');
        const written = readAll(path);
        check(written === 'AA X AA needle AA',
              label + ': single Edit replaces only the first match, got ' + JSON.stringify(written));
        os.remove(path);
    }

    // 3. replace_all still replaces every occurrence (was already correct via split/join).
    {
        const path = writeTemp('AA needle AA needle AA');
        const res = tools.Edit({ file_path: path, old_string: 'needle', new_string: 'X', replace_all: true });
        check(res && res.success, label + ': replace_all Edit reported success');
        const written = readAll(path);
        check(written === 'AA X AA X AA',
              label + ': replace_all still replaces every match, got ' + JSON.stringify(written));
        os.remove(path);
    }

    // 4. replace_all with a $-sequence replacement also must not be pattern-expanded.
    {
        const path = writeTemp('a MARK b MARK c');
        const res = tools.Edit({ file_path: path, old_string: 'MARK', new_string: 'cost=$$5', replace_all: true });
        check(res && res.success, label + ': replace_all $-sequence Edit reported success');
        const written = readAll(path);
        check(written === 'a cost=$$5 b cost=$$5 c',
              label + ': replace_all $-sequences written byte-for-byte, got ' + JSON.stringify(written));
        os.remove(path);
    }

    // 5. Missing old_string is still a clean error, and the file is left untouched.
    {
        const path = writeTemp('unchanged content');
        const res = tools.Edit({ file_path: path, old_string: 'NOPE', new_string: 'X' });
        check(res && res.error, label + ': missing old_string reports an error');
        const written = readAll(path);
        check(written === 'unchanged content', label + ': file left untouched on error');
        os.remove(path);
    }
}

runSuite('claude.js', 'claude.js');
runSuite('claude_code.js', 'claude_code.js');

print(passed + ' passed, ' + failed + ' failed');
std.exit(failed > 0 ? 1 : 0);
