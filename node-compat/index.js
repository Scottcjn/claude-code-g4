/**
 * Node.js Compatibility Layer for QuickJS
 * Bootstrap file that sets up global Node.js-like environment
 *
 * Run with: qjs --std node-compat/index.js
 */

import * as std from 'std';
import * as qjsOs from 'os';

// Import our compatibility modules
import fs from './fs.js';
import path from './path.js';
import os from './os.js';
import childProcess from './child_process.js';
import https from './https.js';
import process from './process.js';

// Set up global scope
globalThis.process = process;
globalThis.console = {
    log: (...args) => print(args.join(' ')),
    error: (...args) => print('\x1b[31m' + args.join(' ') + '\x1b[0m'),
    warn: (...args) => print('\x1b[33m' + args.join(' ') + '\x1b[0m'),
    info: (...args) => print('\x1b[36m' + args.join(' ') + '\x1b[0m'),
    debug: (...args) => print('\x1b[90m' + args.join(' ') + '\x1b[0m'),
    trace: (...args) => print(args.join(' ')),
    dir: (obj) => print(JSON.stringify(obj, null, 2)),
    time: (label) => { globalThis._timers = globalThis._timers || {}; globalThis._timers[label] = Date.now(); },
    timeEnd: (label) => {
        if (globalThis._timers && globalThis._timers[label]) {
            print(`${label}: ${Date.now() - globalThis._timers[label]}ms`);
            delete globalThis._timers[label];
        }
    }
};

// Buffer polyfill (minimal)
globalThis.Buffer = {
    from: (data, encoding) => {
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            return encoder.encode(data);
        }
        return new Uint8Array(data);
    },
    alloc: (size) => new Uint8Array(size),
    isBuffer: (obj) => obj instanceof Uint8Array,
    concat: (list) => {
        const totalLength = list.reduce((acc, buf) => acc + buf.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const buf of list) {
            result.set(buf, offset);
            offset += buf.length;
        }
        return result;
    }
};

// TextEncoder/TextDecoder (should already exist in QuickJS)
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = class TextEncoder {
        encode(str) {
            const arr = [];
            for (let i = 0; i < str.length; i++) {
                let c = str.charCodeAt(i);
                if (c < 128) {
                    arr.push(c);
                } else if (c < 2048) {
                    arr.push(192 | (c >> 6), 128 | (c & 63));
                } else {
                    arr.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
                }
            }
            return new Uint8Array(arr);
        }
    };
}

if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = class TextDecoder {
        decode(arr) {
            let str = '';
            for (let i = 0; i < arr.length; i++) {
                str += String.fromCharCode(arr[i]);
            }
            return str;
        }
    };
}

// setTimeout/setInterval (immediate execution in QuickJS)
globalThis.setTimeout = (fn, delay, ...args) => {
    // QuickJS doesn't have async timers, run immediately
    fn(...args);
    return 1;
};
globalThis.clearTimeout = () => {};
globalThis.setInterval = (fn, delay, ...args) => {
    fn(...args);
    return 1;
};
globalThis.clearInterval = () => {};
globalThis.setImmediate = (fn, ...args) => {
    fn(...args);
    return 1;
};
globalThis.clearImmediate = () => {};

// URL class (minimal)
if (typeof globalThis.URL === 'undefined') {
    globalThis.URL = class URL {
        constructor(url, base) {
            if (base) {
                // Handle relative URLs
                const baseUrl = new URL(base);
                if (url.startsWith('/')) {
                    url = `${baseUrl.protocol}//${baseUrl.host}${url}`;
                } else {
                    url = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname.replace(/[^/]*$/, '')}${url}`;
                }
            }

            const match = url.match(/^(https?):\/\/([^/:]+)(?::(\d+))?(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
            if (!match) throw new Error(`Invalid URL: ${url}`);

            this.protocol = match[1] + ':';
            this.hostname = match[2];
            this.port = match[3] || '';
            this.pathname = match[4] || '/';
            this.search = match[5] || '';
            this.hash = match[6] || '';
            this.host = this.port ? `${this.hostname}:${this.port}` : this.hostname;
            this.origin = `${this.protocol}//${this.host}`;
            this.href = url;
        }

        toString() {
            return this.href;
        }
    };
}

// require() polyfill
const moduleCache = {
    'fs': fs,
    'path': path,
    'os': os,
    'child_process': childProcess,
    'https': https,
    'http': https, // Redirect http to https
    'process': process,
    'node:fs': fs,
    'node:path': path,
    'node:os': os,
    'node:child_process': childProcess,
    'node:https': https,
    'node:http': https,
    'node:process': process,
    'node:module': {
        createRequire: (url) => globalThis.require
    }
};

globalThis.require = function require(id) {
    if (moduleCache[id]) {
        return moduleCache[id];
    }

    // Try to load as file
    const possiblePaths = [
        id,
        id + '.js',
        id + '/index.js'
    ];

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            try {
                const code = fs.readFileSync(p, 'utf8');
                const module = { exports: {} };
                const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', code);
                fn(module, module.exports, require, path.dirname(p), p);
                moduleCache[id] = module.exports;
                return module.exports;
            } catch (e) {
                console.error(`Error loading module ${p}: ${e}`);
            }
        }
    }

    throw new Error(`Cannot find module '${id}'`);
};

// __dirname and __filename
globalThis.__dirname = os.cwd();
globalThis.__filename = scriptArgs[0] || 'index.js';

// module.exports
globalThis.module = { exports: {} };
globalThis.exports = globalThis.module.exports;

// Export modules
export { fs, path, os, childProcess, https, process };

// Print banner
console.info('╔═══════════════════════════════════════════════════════════╗');
console.info('║     Node.js Compatibility Layer for QuickJS               ║');
console.info('║     Running on PowerPC G4 Tiger                           ║');
console.info('╚═══════════════════════════════════════════════════════════╝');
console.log('');
console.log('Node.js version (emulated):', process.version);
console.log('Platform:', process.platform, process.arch);
console.log('');
