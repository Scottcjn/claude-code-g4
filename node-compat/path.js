/**
 * Node.js path module compatibility for QuickJS
 */

const sep = '/';
const delimiter = ':';

function basename(path, ext) {
    let base = path.split(sep).pop() || '';
    if (ext && base.endsWith(ext)) {
        base = base.slice(0, -ext.length);
    }
    return base;
}

function dirname(path) {
    const parts = path.split(sep);
    parts.pop();
    return parts.join(sep) || '.';
}

function extname(path) {
    const base = basename(path);
    const idx = base.lastIndexOf('.');
    return idx > 0 ? base.slice(idx) : '';
}

function join(...paths) {
    return normalize(paths.filter(p => p).join(sep));
}

function normalize(path) {
    const parts = path.split(sep);
    const result = [];
    for (const part of parts) {
        if (part === '..') {
            result.pop();
        } else if (part !== '.' && part !== '') {
            result.push(part);
        }
    }
    return (path.startsWith(sep) ? sep : '') + result.join(sep);
}

function isAbsolute(path) {
    return path.startsWith(sep);
}

function resolve(...paths) {
    let resolved = '';
    for (let i = paths.length - 1; i >= 0 && !isAbsolute(resolved); i--) {
        const path = paths[i];
        if (path) {
            resolved = path + (resolved ? sep + resolved : '');
        }
    }
    if (!isAbsolute(resolved)) {
        // Use current directory from os module
        resolved = '.' + sep + resolved;
    }
    return normalize(resolved);
}

function relative(from, to) {
    const fromParts = normalize(from).split(sep).filter(p => p);
    const toParts = normalize(to).split(sep).filter(p => p);

    let commonLength = 0;
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
        if (fromParts[i] === toParts[i]) {
            commonLength++;
        } else {
            break;
        }
    }

    const upCount = fromParts.length - commonLength;
    const result = [];
    for (let i = 0; i < upCount; i++) {
        result.push('..');
    }
    result.push(...toParts.slice(commonLength));
    return result.join(sep);
}

function parse(path) {
    const ext = extname(path);
    const base = basename(path);
    const dir = dirname(path);
    const name = base.slice(0, base.length - ext.length);
    const root = isAbsolute(path) ? sep : '';

    return { root, dir, base, ext, name };
}

function format(pathObject) {
    const dir = pathObject.dir || pathObject.root || '';
    const base = pathObject.base || (pathObject.name || '') + (pathObject.ext || '');
    return dir ? (dir.endsWith(sep) ? dir + base : dir + sep + base) : base;
}

export {
    sep,
    delimiter,
    basename,
    dirname,
    extname,
    join,
    normalize,
    isAbsolute,
    resolve,
    relative,
    parse,
    format
};

export default {
    sep,
    delimiter,
    basename,
    dirname,
    extname,
    join,
    normalize,
    isAbsolute,
    resolve,
    relative,
    parse,
    format
};
