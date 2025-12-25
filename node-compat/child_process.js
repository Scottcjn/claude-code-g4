/**
 * Node.js child_process module compatibility for QuickJS
 */

import * as std from 'std';
import * as os from 'os';

/**
 * Execute a command synchronously
 */
export function execSync(command, options = {}) {
    const cwd = options.cwd || '.';
    const encoding = options.encoding || 'utf8';
    const timeout = options.timeout || 0;
    const maxBuffer = options.maxBuffer || 1024 * 1024;

    // Save current directory
    const origCwd = os.getcwd()[0];

    // Change to specified directory
    if (cwd !== '.') {
        os.chdir(cwd);
    }

    try {
        const pipe = std.popen(command + ' 2>&1', 'r');
        let output = '';
        let line;
        while ((line = pipe.getline()) !== null) {
            output += line + '\n';
            if (output.length > maxBuffer) {
                pipe.close();
                throw new Error('maxBuffer exceeded');
            }
        }
        const exitCode = pipe.close();

        if (exitCode !== 0 && !options.ignoreExitCode) {
            const err = new Error(`Command failed: ${command}`);
            err.status = exitCode;
            err.stdout = output;
            throw err;
        }

        if (encoding === 'buffer') {
            // Return as Uint8Array (closest to Buffer in QuickJS)
            const enc = new TextEncoder();
            return enc.encode(output);
        }
        return output;
    } finally {
        // Restore original directory
        os.chdir(origCwd);
    }
}

/**
 * Spawn a command synchronously
 */
export function spawnSync(command, args = [], options = {}) {
    const cwd = options.cwd || '.';
    const env = options.env || {};
    const encoding = options.encoding || 'utf8';
    const shell = options.shell || false;

    let cmd;
    if (shell) {
        cmd = [command, ...args].join(' ');
    } else {
        cmd = [command, ...args].map(a => `"${a}"`).join(' ');
    }

    // Build environment variables prefix
    let envPrefix = '';
    for (const [key, value] of Object.entries(env)) {
        envPrefix += `${key}="${value}" `;
    }

    const fullCmd = envPrefix + cmd;

    try {
        const output = execSync(fullCmd, { cwd, encoding, ignoreExitCode: true });
        return {
            stdout: output,
            stderr: '',
            status: 0,
            signal: null,
            error: null
        };
    } catch (err) {
        return {
            stdout: err.stdout || '',
            stderr: err.message,
            status: err.status || 1,
            signal: null,
            error: err
        };
    }
}

/**
 * Execute a file synchronously
 */
export function execFileSync(file, args = [], options = {}) {
    const cmd = [file, ...args].map(a => `"${a}"`).join(' ');
    return execSync(cmd, options);
}

/**
 * Async exec (wraps sync for QuickJS)
 */
export function exec(command, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    try {
        const stdout = execSync(command, { ...options, ignoreExitCode: true });
        callback(null, stdout, '');
    } catch (err) {
        callback(err, err.stdout || '', err.message);
    }
}

/**
 * Async spawn (wraps sync for QuickJS)
 */
export function spawn(command, args = [], options = {}) {
    // In QuickJS, we don't have true async processes
    // Return an object that mimics the ChildProcess interface
    const result = spawnSync(command, args, options);

    return {
        stdout: {
            on: (event, callback) => {
                if (event === 'data') {
                    callback(result.stdout);
                }
            }
        },
        stderr: {
            on: (event, callback) => {
                if (event === 'data' && result.stderr) {
                    callback(result.stderr);
                }
            }
        },
        on: (event, callback) => {
            if (event === 'close') {
                callback(result.status);
            } else if (event === 'exit') {
                callback(result.status);
            } else if (event === 'error' && result.error) {
                callback(result.error);
            }
        },
        pid: 0,
        kill: () => {}
    };
}

/**
 * Fork (not supported in QuickJS)
 */
export function fork(modulePath, args = [], options = {}) {
    throw new Error('fork() is not supported in QuickJS');
}

export default {
    execSync,
    spawnSync,
    execFileSync,
    exec,
    spawn,
    fork
};
