/**
 * Node.js os module compatibility for QuickJS
 */

import * as std from 'std';
import * as qjsOs from 'os';

// Get hostname
export function hostname() {
    const pipe = std.popen('hostname', 'r');
    const name = pipe.getline() || 'localhost';
    pipe.close();
    return name.trim();
}

// Get platform
export function platform() {
    // Tiger is darwin
    return 'darwin';
}

// Get architecture
export function arch() {
    // G4 is ppc
    return 'ppc';
}

// Get OS type
export function type() {
    return 'Darwin';
}

// Get OS release
export function release() {
    const pipe = std.popen('uname -r', 'r');
    const rel = pipe.getline() || '8.11.0';
    pipe.close();
    return rel.trim();
}

// Get home directory
export function homedir() {
    return std.getenv('HOME') || '/Users/sophia';
}

// Get temp directory
export function tmpdir() {
    return std.getenv('TMPDIR') || '/tmp';
}

// Get EOL
export const EOL = '\n';

// Get CPU info
export function cpus() {
    // Return mock G4 CPU info
    return [{
        model: 'PowerPC G4 (7450)',
        speed: 1420, // MHz
        times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }
    }];
}

// Get total memory
export function totalmem() {
    // Parse from system_profiler or sysctl
    try {
        const pipe = std.popen('sysctl -n hw.memsize 2>/dev/null || echo 536870912', 'r');
        const mem = parseInt(pipe.getline() || '536870912');
        pipe.close();
        return mem;
    } catch (e) {
        return 512 * 1024 * 1024; // Default 512MB
    }
}

// Get free memory
export function freemem() {
    // Approximate
    return Math.floor(totalmem() * 0.3);
}

// Get uptime
export function uptime() {
    try {
        const pipe = std.popen('sysctl -n kern.boottime 2>/dev/null', 'r');
        const line = pipe.getline() || '';
        pipe.close();
        const match = line.match(/sec = (\d+)/);
        if (match) {
            const bootTime = parseInt(match[1]);
            return Math.floor(Date.now() / 1000) - bootTime;
        }
    } catch (e) {}
    return 0;
}

// Get load average
export function loadavg() {
    try {
        const pipe = std.popen('sysctl -n vm.loadavg 2>/dev/null', 'r');
        const line = pipe.getline() || '{ 0.00 0.00 0.00 }';
        pipe.close();
        const match = line.match(/\{\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
        if (match) {
            return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
        }
    } catch (e) {}
    return [0, 0, 0];
}

// Get network interfaces
export function networkInterfaces() {
    // Return empty object (complex to parse on old Mac)
    return {};
}

// Get user info
export function userInfo(options = {}) {
    const username = std.getenv('USER') || 'sophia';
    const home = homedir();
    const shell = std.getenv('SHELL') || '/bin/bash';

    return {
        username,
        uid: 501,
        gid: 20,
        shell,
        homedir: home
    };
}

// Get endianness
export function endianness() {
    // G4 is big-endian
    return 'BE';
}

// Constants
export const constants = {
    signals: {
        SIGHUP: 1,
        SIGINT: 2,
        SIGQUIT: 3,
        SIGKILL: 9,
        SIGTERM: 15
    },
    errno: {},
    priority: {}
};

export default {
    hostname,
    platform,
    arch,
    type,
    release,
    homedir,
    tmpdir,
    EOL,
    cpus,
    totalmem,
    freemem,
    uptime,
    loadavg,
    networkInterfaces,
    userInfo,
    endianness,
    constants
};
