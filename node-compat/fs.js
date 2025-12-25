/**
 * Node.js fs module compatibility for QuickJS
 * Provides Node-like filesystem API using QuickJS std module
 */

import * as std from 'std';
import * as os from 'os';

// Sync methods
export function existsSync(path) {
    try {
        const f = std.open(path, 'r');
        if (f) {
            f.close();
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

export function readFileSync(path, options = {}) {
    const encoding = typeof options === 'string' ? options : options.encoding;
    const f = std.open(path, 'r');
    if (!f) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    const content = f.readAsString();
    f.close();
    return content;
}

export function writeFileSync(path, data, options = {}) {
    const encoding = typeof options === 'string' ? options : options.encoding;
    const f = std.open(path, 'w');
    if (!f) {
        throw new Error(`ENOENT: cannot open file for writing '${path}'`);
    }
    f.puts(data);
    f.close();
}

export function appendFileSync(path, data, options = {}) {
    const f = std.open(path, 'a');
    if (!f) {
        throw new Error(`ENOENT: cannot open file for appending '${path}'`);
    }
    f.puts(data);
    f.close();
}

export function unlinkSync(path) {
    const result = os.remove(path);
    if (result !== 0) {
        throw new Error(`ENOENT: cannot remove '${path}'`);
    }
}

export function mkdirSync(path, options = {}) {
    const mode = options.mode || 0o755;
    const recursive = options.recursive || false;

    if (recursive) {
        // Create parent directories
        const parts = path.split('/');
        let current = '';
        for (const part of parts) {
            current += '/' + part;
            if (current && !existsSync(current)) {
                os.mkdir(current, mode);
            }
        }
    } else {
        os.mkdir(path, mode);
    }
}

export function readdirSync(path, options = {}) {
    const entries = [];
    const [files, err] = os.readdir(path);
    if (err !== 0) {
        throw new Error(`ENOENT: cannot read directory '${path}'`);
    }
    for (const file of files) {
        if (file !== '.' && file !== '..') {
            entries.push(file);
        }
    }
    return entries;
}

export function statSync(path) {
    const [stat, err] = os.stat(path);
    if (err !== 0) {
        throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    return {
        isFile: () => (stat.mode & os.S_IFMT) === os.S_IFREG,
        isDirectory: () => (stat.mode & os.S_IFMT) === os.S_IFDIR,
        isSymbolicLink: () => (stat.mode & os.S_IFMT) === os.S_IFLNK,
        size: stat.size,
        mode: stat.mode,
        mtime: new Date(stat.mtime * 1000),
        ctime: new Date(stat.ctime * 1000),
        atime: new Date(stat.atime * 1000)
    };
}

export function lstatSync(path) {
    const [stat, err] = os.lstat(path);
    if (err !== 0) {
        throw new Error(`ENOENT: no such file or directory, lstat '${path}'`);
    }
    return {
        isFile: () => (stat.mode & os.S_IFMT) === os.S_IFREG,
        isDirectory: () => (stat.mode & os.S_IFMT) === os.S_IFDIR,
        isSymbolicLink: () => (stat.mode & os.S_IFMT) === os.S_IFLNK,
        size: stat.size,
        mode: stat.mode,
        mtime: new Date(stat.mtime * 1000),
        ctime: new Date(stat.ctime * 1000),
        atime: new Date(stat.atime * 1000)
    };
}

export function realpathSync(path) {
    const [resolved, err] = os.realpath(path);
    if (err !== 0) {
        throw new Error(`ENOENT: cannot resolve '${path}'`);
    }
    return resolved;
}

export function renameSync(oldPath, newPath) {
    const result = os.rename(oldPath, newPath);
    if (result !== 0) {
        throw new Error(`ENOENT: cannot rename '${oldPath}' to '${newPath}'`);
    }
}

export function copyFileSync(src, dest) {
    const content = readFileSync(src);
    writeFileSync(dest, content);
}

export function chmodSync(path, mode) {
    // QuickJS os module may not support chmod directly
    // Use shell command as fallback
    const result = os.exec(['chmod', String(mode), path], { usePath: true });
    if (result !== 0) {
        throw new Error(`Cannot chmod '${path}'`);
    }
}

// Async methods (wrappers around sync for QuickJS)
export function readFile(path, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    try {
        const data = readFileSync(path, options);
        callback(null, data);
    } catch (err) {
        callback(err);
    }
}

export function writeFile(path, data, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    try {
        writeFileSync(path, data, options);
        callback(null);
    } catch (err) {
        callback(err);
    }
}

// Promises API
export const promises = {
    async readFile(path, options) {
        return readFileSync(path, options);
    },
    async writeFile(path, data, options) {
        return writeFileSync(path, data, options);
    },
    async unlink(path) {
        return unlinkSync(path);
    },
    async mkdir(path, options) {
        return mkdirSync(path, options);
    },
    async readdir(path, options) {
        return readdirSync(path, options);
    },
    async stat(path) {
        return statSync(path);
    },
    async lstat(path) {
        return lstatSync(path);
    },
    async realpath(path) {
        return realpathSync(path);
    },
    async rename(oldPath, newPath) {
        return renameSync(oldPath, newPath);
    },
    async copyFile(src, dest) {
        return copyFileSync(src, dest);
    },
    async chmod(path, mode) {
        return chmodSync(path, mode);
    }
};

export default {
    existsSync,
    readFileSync,
    writeFileSync,
    appendFileSync,
    unlinkSync,
    mkdirSync,
    readdirSync,
    statSync,
    lstatSync,
    realpathSync,
    renameSync,
    copyFileSync,
    chmodSync,
    readFile,
    writeFile,
    promises
};
