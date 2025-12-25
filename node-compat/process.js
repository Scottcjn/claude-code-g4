/**
 * Node.js process module compatibility for QuickJS
 */

import * as std from 'std';
import * as qjsOs from 'os';

// Environment variables
export const env = new Proxy({}, {
    get(target, prop) {
        return std.getenv(String(prop)) || undefined;
    },
    set(target, prop, value) {
        std.setenv(String(prop), String(value));
        return true;
    },
    has(target, prop) {
        return std.getenv(String(prop)) !== undefined;
    },
    deleteProperty(target, prop) {
        std.unsetenv(String(prop));
        return true;
    },
    ownKeys(target) {
        // Can't easily enumerate env vars in QuickJS
        return [];
    }
});

// Current working directory
export function cwd() {
    const [dir, err] = qjsOs.getcwd();
    return dir || '/';
}

export function chdir(directory) {
    qjsOs.chdir(directory);
}

// Command line arguments
export const argv = scriptArgs ? ['qjs', ...scriptArgs] : ['qjs'];
export const argv0 = 'qjs';
export const execPath = '/Users/sophia/qjs';
export const execArgv = [];

// Process info
export const pid = 1;
export const ppid = 0;
export const title = 'qjs';
export const version = 'v20.0.0'; // Pretend to be Node 20
export const versions = {
    node: '20.0.0',
    v8: '0.0.0',
    quickjs: '2024-01-13'
};

// Platform info
export const platform = 'darwin';
export const arch = 'ppc';

// Exit
export function exit(code = 0) {
    std.exit(code);
}

// stdout/stderr
export const stdout = {
    write(data) {
        std.out.puts(data);
        std.out.flush();
    },
    end() {},
    on() {},
    once() {},
    emit() {},
    isTTY: true,
    columns: 80,
    rows: 24
};

export const stderr = {
    write(data) {
        std.err.puts(data);
        std.err.flush();
    },
    end() {},
    on() {},
    once() {},
    emit() {},
    isTTY: true
};

export const stdin = {
    read() {
        return std.in.getline();
    },
    on() {},
    once() {},
    emit() {},
    isTTY: true,
    setRawMode() {}
};

// Timing
export function hrtime(time) {
    const now = Date.now();
    const seconds = Math.floor(now / 1000);
    const nanoseconds = (now % 1000) * 1e6;

    if (time) {
        let diffSec = seconds - time[0];
        let diffNano = nanoseconds - time[1];
        if (diffNano < 0) {
            diffSec--;
            diffNano += 1e9;
        }
        return [diffSec, diffNano];
    }
    return [seconds, nanoseconds];
}

hrtime.bigint = function() {
    return BigInt(Date.now()) * BigInt(1e6);
};

// Memory usage (mock)
export function memoryUsage() {
    return {
        rss: 50 * 1024 * 1024,
        heapTotal: 30 * 1024 * 1024,
        heapUsed: 20 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0
    };
}

// CPU usage (mock)
export function cpuUsage(previousValue) {
    const now = { user: 1000000, system: 500000 };
    if (previousValue) {
        return {
            user: now.user - previousValue.user,
            system: now.system - previousValue.system
        };
    }
    return now;
}

// Event handlers
const eventHandlers = {};

export function on(event, handler) {
    if (!eventHandlers[event]) {
        eventHandlers[event] = [];
    }
    eventHandlers[event].push(handler);
}

export function once(event, handler) {
    const wrapper = (...args) => {
        off(event, wrapper);
        handler(...args);
    };
    on(event, wrapper);
}

export function off(event, handler) {
    if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter(h => h !== handler);
    }
}

export function emit(event, ...args) {
    if (eventHandlers[event]) {
        for (const handler of eventHandlers[event]) {
            handler(...args);
        }
    }
}

// Next tick (immediate in QuickJS)
export function nextTick(callback, ...args) {
    // QuickJS doesn't have true async, so run immediately
    callback(...args);
}

// Uptime
const startTime = Date.now();
export function uptime() {
    return (Date.now() - startTime) / 1000;
}

// Features
export const features = {
    debug: false,
    uv: false,
    ipv6: true,
    tls_alpn: true,
    tls_sni: true,
    tls_ocsp: false,
    tls: true
};

// Release info
export const release = {
    name: 'qjs',
    sourceUrl: 'https://bellard.org/quickjs/',
    headersUrl: ''
};

export default {
    env,
    cwd,
    chdir,
    argv,
    argv0,
    execPath,
    execArgv,
    pid,
    ppid,
    title,
    version,
    versions,
    platform,
    arch,
    exit,
    stdout,
    stderr,
    stdin,
    hrtime,
    memoryUsage,
    cpuUsage,
    on,
    once,
    off,
    emit,
    nextTick,
    uptime,
    features,
    release
};
