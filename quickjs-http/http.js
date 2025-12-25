/**
 * HTTP Module for QuickJS on Tiger/Leopard
 * Uses Python 3.10 subprocess for TLS 1.2/1.3 support
 */

import * as std from 'std';
import * as os from 'os';

// Path to Python 3.10 on Tiger (via MacPorts)
const PYTHON_PATH = '/opt/local/bin/python3.10';
const HTTP_HELPER = '/Users/sophia/claude-code-g4/http_helper.py';

/**
 * Execute Python HTTP helper and parse result
 */
function callPython(requestJson) {
    // Write request to temp file (avoid shell escaping issues)
    const tmpFile = '/tmp/qjs_http_req_' + Date.now() + '.json';
    const f = std.open(tmpFile, 'w');
    f.puts(requestJson);
    f.close();

    // Call Python with request file
    const cmd = `${PYTHON_PATH} ${HTTP_HELPER} "$(cat ${tmpFile})" 2>&1`;
    const pipe = std.popen(cmd, 'r');
    let output = '';
    let line;
    while ((line = pipe.getline()) !== null) {
        output += line + '\n';
    }
    pipe.close();

    // Clean up temp file
    os.remove(tmpFile);

    // Parse response
    try {
        return JSON.parse(output.trim());
    } catch (e) {
        return { ok: false, error: 'Failed to parse response: ' + output };
    }
}

/**
 * Make HTTP request
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} url - Request URL
 * @param {object} options - { headers, body }
 * @returns {object} - { ok, status, headers, body, error }
 */
export function request(method, url, options = {}) {
    const req = {
        method: method,
        url: url,
        headers: options.headers || {},
        body: options.body || null
    };
    return callPython(JSON.stringify(req));
}

/**
 * HTTP GET
 */
export function get(url, options = {}) {
    return request('GET', url, options);
}

/**
 * HTTP POST
 */
export function post(url, body, options = {}) {
    return request('POST', url, { ...options, body: body });
}

/**
 * HTTP POST JSON
 */
export function postJson(url, data, options = {}) {
    const headers = options.headers || {};
    headers['Content-Type'] = 'application/json';
    return request('POST', url, {
        ...options,
        headers: headers,
        body: JSON.stringify(data)
    });
}

// Default export
export default {
    request,
    get,
    post,
    postJson
};
