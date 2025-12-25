/**
 * Node.js https module compatibility for QuickJS
 * Uses Python 3.10 for TLS 1.2/1.3 support on Tiger
 */

import * as std from 'std';
import * as os from 'os';

// Path to Python TLS helper
const PYTHON_PATH = '/opt/local/bin/python3.10';
const HTTP_HELPER = '/Users/sophia/claude-code-g4/quickjs-http/http_helper.py';

/**
 * Make an HTTPS request using Python subprocess
 */
function makeRequest(options, callback) {
    const method = options.method || 'GET';
    const hostname = options.hostname || options.host || 'localhost';
    const port = options.port || 443;
    const path = options.path || '/';
    const headers = options.headers || {};

    const url = `https://${hostname}:${port}${path}`;

    // Create request object
    const reqObj = {
        method,
        url,
        headers,
        body: null
    };

    // Create response object
    const response = {
        statusCode: 0,
        headers: {},
        _data: '',
        _dataHandlers: [],
        _endHandlers: [],

        on(event, handler) {
            if (event === 'data') {
                this._dataHandlers.push(handler);
            } else if (event === 'end') {
                this._endHandlers.push(handler);
            }
            return this;
        },

        _emit(event, data) {
            if (event === 'data') {
                for (const h of this._dataHandlers) h(data);
            } else if (event === 'end') {
                for (const h of this._endHandlers) h();
            }
        }
    };

    // Create request object with write/end methods
    const request = {
        _body: '',
        _callback: callback,
        _options: options,
        _reqObj: reqObj,

        write(data) {
            this._body += data;
        },

        end(data) {
            if (data) this._body += data;
            this._reqObj.body = this._body || null;

            // Execute request
            this._execute();
        },

        on(event, handler) {
            // Handle request events
            return this;
        },

        _execute() {
            const reqJson = JSON.stringify(this._reqObj);

            // Write to temp file
            const tmpFile = '/tmp/qjs_https_' + Date.now() + '.json';
            const f = std.open(tmpFile, 'w');
            f.puts(reqJson);
            f.close();

            // Call Python
            const cmd = `${PYTHON_PATH} ${HTTP_HELPER} "$(cat ${tmpFile})" 2>&1`;
            const pipe = std.popen(cmd, 'r');
            let output = '';
            let line;
            while ((line = pipe.getline()) !== null) {
                output += line + '\n';
            }
            pipe.close();

            // Clean up
            os.remove(tmpFile);

            // Parse response
            try {
                const result = JSON.parse(output.trim());

                if (result.ok) {
                    response.statusCode = result.status;
                    response.headers = result.headers || {};

                    // Call callback with response
                    if (this._callback) {
                        this._callback(response);
                    }

                    // Emit data and end
                    response._emit('data', result.body);
                    response._emit('end');
                } else {
                    const error = new Error(result.error || 'Request failed');
                    error.code = 'ECONNREFUSED';
                    throw error;
                }
            } catch (e) {
                const error = new Error('Failed to parse response: ' + output);
                throw error;
            }
        }
    };

    return request;
}

/**
 * HTTPS request
 */
export function request(options, callback) {
    if (typeof options === 'string') {
        const url = new URL(options);
        options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: 'GET'
        };
    }
    return makeRequest(options, callback);
}

/**
 * HTTPS GET
 */
export function get(options, callback) {
    if (typeof options === 'string') {
        const url = new URL(options);
        options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: 'GET'
        };
    } else {
        options.method = 'GET';
    }
    const req = makeRequest(options, callback);
    req.end();
    return req;
}

/**
 * Create HTTPS agent (stub)
 */
export class Agent {
    constructor(options = {}) {
        this.options = options;
    }
}

export const globalAgent = new Agent();

export default {
    request,
    get,
    Agent,
    globalAgent
};
