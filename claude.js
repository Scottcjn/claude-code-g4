#!/usr/bin/env qjs
/*
 * Claude Code for PowerPC G4 Tiger
 * Complete bundled version - no external dependencies
 */

import * as std from 'std';
import * as os from 'os';

// ============ CONFIG ============
const PYTHON_PATH = '/opt/local/bin/python3.10';
const API_KEY = std.getenv('ANTHROPIC_API_KEY') || '';
const PROXY_URL = std.getenv('CLAUDE_PROXY') || '';
const MODEL = 'claude-sonnet-4-20250514';

// ============ HTTP ============
function httpRequest(method, url, headers, body) {
    const req = { method, url, headers: headers || {}, body: body || null };
    const tmpFile = '/tmp/qjs_http_' + Date.now() + '.json';

    const f = std.open(tmpFile, 'w');
    f.puts(JSON.stringify(req));
    f.close();

    const helperCode = `
import sys, json, urllib.request, ssl
ctx = ssl.create_default_context()
try:
    req_data = json.load(open('${tmpFile}'))
    data = req_data['body'].encode() if req_data.get('body') else None
    req = urllib.request.Request(req_data['url'], data=data, method=req_data['method'])
    for k,v in req_data.get('headers',{}).items(): req.add_header(k,v)
    with urllib.request.urlopen(req, context=ctx, timeout=120) as resp:
        print(json.dumps({'ok':True,'status':resp.status,'body':resp.read().decode()}))
except Exception as e:
    print(json.dumps({'ok':False,'error':str(e)}))
`;

    const pyFile = '/tmp/qjs_py_' + Date.now() + '.py';
    const pf = std.open(pyFile, 'w');
    pf.puts(helperCode);
    pf.close();

    const pipe = std.popen(PYTHON_PATH + ' ' + pyFile + ' 2>&1', 'r');
    let output = '';
    let line;
    while ((line = pipe.getline()) !== null) output += line + '\n';
    pipe.close();

    os.remove(tmpFile);
    os.remove(pyFile);

    try { return JSON.parse(output.trim()); }
    catch(e) { return { ok: false, error: 'Parse error: ' + output }; }
}

// ============ TOOLS ============
const tools = {
    Read: function(params) {
        try {
            const f = std.open(params.file_path, 'r');
            if (!f) return { error: 'File not found: ' + params.file_path };
            const content = f.readAsString();
            f.close();

            const lines = content.split('\n');
            const offset = params.offset || 0;
            const limit = params.limit || 2000;
            const selected = lines.slice(offset, offset + limit);

            let result = '';
            for (let i = 0; i < selected.length; i++) {
                result += String(offset + i + 1).padStart(6, ' ') + '\t' + selected[i] + '\n';
            }
            return { content: result, total_lines: lines.length };
        } catch (e) { return { error: String(e) }; }
    },

    Write: function(params) {
        try {
            const f = std.open(params.file_path, 'w');
            if (!f) return { error: 'Cannot open: ' + params.file_path };
            f.puts(params.content);
            f.close();
            return { success: true };
        } catch (e) { return { error: String(e) }; }
    },

    Edit: function(params) {
        try {
            const f = std.open(params.file_path, 'r');
            if (!f) return { error: 'File not found' };
            let content = f.readAsString();
            f.close();

            if (content.indexOf(params.old_string) === -1)
                return { error: 'String not found' };

            if (params.replace_all)
                content = content.split(params.old_string).join(params.new_string);
            else
                content = content.replace(params.old_string, params.new_string);

            const fw = std.open(params.file_path, 'w');
            fw.puts(content);
            fw.close();
            return { success: true };
        } catch (e) { return { error: String(e) }; }
    },

    Bash: function(params) {
        try {
            const pipe = std.popen(params.command + ' 2>&1', 'r');
            let output = '';
            let line;
            while ((line = pipe.getline()) !== null) output += line + '\n';
            const exitCode = pipe.close();
            return { stdout: output, exit_code: exitCode };
        } catch (e) { return { error: String(e) }; }
    },

    Glob: function(params) {
        const cmd = 'find ' + (params.path || '.') + ' -name "' +
                    params.pattern.replace(/\*\*/g, '*') + '" 2>/dev/null | head -100';
        const pipe = std.popen(cmd, 'r');
        const files = [];
        let line;
        while ((line = pipe.getline()) !== null) if (line.trim()) files.push(line.trim());
        pipe.close();
        return { files };
    },

    Grep: function(params) {
        const mode = params.output_mode || 'files_with_matches';
        let cmd;
        if (mode === 'files_with_matches')
            cmd = 'grep -rl "' + params.pattern + '" ' + (params.path || '.') + ' 2>/dev/null | head -50';
        else
            cmd = 'grep -rn "' + params.pattern + '" ' + (params.path || '.') + ' 2>/dev/null | head -100';

        const pipe = std.popen(cmd, 'r');
        let output = '';
        let line;
        while ((line = pipe.getline()) !== null) output += line + '\n';
        pipe.close();
        return { matches: output };
    }
};

const toolDefs = [
    { name: 'Read', description: 'Read a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, offset: { type: 'number' }, limit: { type: 'number' } }, required: ['file_path'] } },
    { name: 'Write', description: 'Write a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
    { name: 'Edit', description: 'Edit a file', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['file_path', 'old_string', 'new_string'] } },
    { name: 'Bash', description: 'Run shell command', input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
    { name: 'Glob', description: 'Find files', input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern'] } },
    { name: 'Grep', description: 'Search in files', input_schema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, output_mode: { type: 'string' } }, required: ['pattern'] } }
];

// ============ API ============
function callClaude(messages) {
    if (!PROXY_URL && !API_KEY) return { error: 'Set ANTHROPIC_API_KEY or CLAUDE_PROXY' };

    const url = PROXY_URL || 'https://api.anthropic.com/v1/messages';
    const headers = { 'Content-Type': 'application/json' };
    if (!PROXY_URL) {
        headers['x-api-key'] = API_KEY;
        headers['anthropic-version'] = '2023-06-01';
    }

    const body = JSON.stringify({
        model: MODEL,
        max_tokens: 8192,
        system: 'You are Claude Code on PowerPC G4 Tiger. Use tools for file/shell operations. Be concise.',
        tools: toolDefs,
        messages: messages
    });

    const resp = httpRequest('POST', url, headers, body);
    if (!resp.ok) return { error: resp.error || 'HTTP error' };

    try { return JSON.parse(resp.body); }
    catch (e) { return { error: 'Parse error' }; }
}

function executeTool(name, input) {
    print('\n\x1b[36m▶ ' + name + '\x1b[0m');
    if (tools[name]) {
        const result = tools[name](input);
        const str = JSON.stringify(result);
        print('\x1b[90m  ' + (str.length > 200 ? str.substring(0,200) + '...' : str) + '\x1b[0m');
        return result;
    }
    return { error: 'Unknown tool' };
}

function runConversation(userMessage) {
    const messages = [{ role: 'user', content: userMessage }];

    while (true) {
        print('\n\x1b[33m⏳ Thinking...\x1b[0m');
        const response = callClaude(messages);

        if (response.error) {
            print('\x1b[31mError: ' + response.error + '\x1b[0m');
            return;
        }

        let hasToolUse = false;
        const toolResults = [];

        for (const block of response.content || []) {
            if (block.type === 'text') {
                print('\n\x1b[32m' + block.text + '\x1b[0m');
            } else if (block.type === 'tool_use') {
                hasToolUse = true;
                const result = executeTool(block.name, block.input);
                toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
            }
        }

        if (hasToolUse) {
            messages.push({ role: 'assistant', content: response.content });
            messages.push({ role: 'user', content: toolResults });
        } else break;

        if (response.stop_reason === 'end_turn') break;
    }
}

// ============ MAIN ============
print('\n\x1b[1;35m╔═══════════════════════════════════════════════════════════╗');
print('║     Claude Code for PowerPC G4 Tiger                      ║');
print('║     QuickJS + Python TLS                                  ║');
print('╚═══════════════════════════════════════════════════════════╝\x1b[0m\n');

if (!API_KEY && !PROXY_URL) {
    print('\x1b[31mWarning: Set ANTHROPIC_API_KEY or CLAUDE_PROXY\x1b[0m\n');
}

print('Type your request, or "quit" to exit.\n');

while (true) {
    std.out.puts('\x1b[1m> \x1b[0m');
    std.out.flush();

    const line = std.in.getline();
    if (line === null || line.toLowerCase() === 'quit' || line.toLowerCase() === 'exit') {
        print('\nGoodbye!');
        break;
    }

    if (line.trim()) runConversation(line.trim());
}
