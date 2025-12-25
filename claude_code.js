#!/usr/bin/env qjs
/**
 * Claude Code for PowerPC G4 Tiger
 * A minimal Claude Code implementation using QuickJS
 *
 * Features:
 * - Claude API integration via Python TLS bridge
 * - Tool execution (Read, Write, Edit, Bash, Glob, Grep)
 * - Streaming conversation support
 * - File and shell operations
 */

import * as std from 'std';
import * as os from 'os';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    // Python path for HTTP requests (TLS 1.2/1.3)
    pythonPath: '/opt/local/bin/python3.10',
    httpHelper: scriptArgs[0] ?
        scriptArgs[0].replace(/[^\/]+$/, '') + 'quickjs-http/http_helper.py' :
        '/Users/sophia/claude-code-g4/quickjs-http/http_helper.py',

    // Claude API - supports both direct API and proxy mode
    // For Max subscription: set CLAUDE_PROXY to your proxy URL
    // For API key: set ANTHROPIC_API_KEY
    proxyUrl: std.getenv('CLAUDE_PROXY') || '',
    apiUrl: std.getenv('CLAUDE_PROXY') || 'https://api.anthropic.com/v1/messages',
    apiKey: std.getenv('ANTHROPIC_API_KEY') || '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8192,
    useProxy: std.getenv('CLAUDE_PROXY') ? true : false,

    // System prompt
    systemPrompt: `You are Claude Code running on a PowerPC G4 Mac with Mac OS X 10.4 Tiger.
You have access to tools to help with software engineering tasks.
Be concise and efficient - this is vintage hardware!

Available tools:
- Read: Read file contents
- Write: Write content to a file
- Edit: Make string replacements in files
- Bash: Execute shell commands
- Glob: Find files matching patterns
- Grep: Search file contents with regex`
};

// ============================================================================
// HTTP Client (via Python)
// ============================================================================

function httpRequest(method, url, headers, body) {
    const req = {
        method: method,
        url: url,
        headers: headers || {},
        body: body || null
    };

    // Write request to temp file
    const tmpFile = '/tmp/qjs_http_' + Date.now() + '.json';
    const f = std.open(tmpFile, 'w');
    f.puts(JSON.stringify(req));
    f.close();

    // Execute Python HTTP helper
    const cmd = CONFIG.pythonPath + ' ' + CONFIG.httpHelper + ' "$(cat ' + tmpFile + ')" 2>&1';
    const pipe = std.popen(cmd, 'r');
    let output = '';
    let line;
    while ((line = pipe.getline()) !== null) {
        output += line + '\n';
    }
    pipe.close();

    // Clean up
    os.remove(tmpFile);

    try {
        return JSON.parse(output.trim());
    } catch (e) {
        return { ok: false, error: 'Parse error: ' + output };
    }
}

// ============================================================================
// Tool Implementations
// ============================================================================

const tools = {
    Read: function(params) {
        const path = params.file_path;
        const offset = params.offset || 0;
        const limit = params.limit || 2000;

        try {
            const f = std.open(path, 'r');
            if (!f) {
                return { error: 'File not found: ' + path };
            }

            const content = f.readAsString();
            f.close();

            // Split into lines and apply offset/limit
            const lines = content.split('\n');
            const selected = lines.slice(offset, offset + limit);

            // Format with line numbers
            let result = '';
            for (let i = 0; i < selected.length; i++) {
                const lineNum = offset + i + 1;
                result += String(lineNum).padStart(6, ' ') + '\t' + selected[i] + '\n';
            }

            return { content: result, total_lines: lines.length };
        } catch (e) {
            return { error: String(e) };
        }
    },

    Write: function(params) {
        const path = params.file_path;
        const content = params.content;

        try {
            const f = std.open(path, 'w');
            if (!f) {
                return { error: 'Cannot open file for writing: ' + path };
            }
            f.puts(content);
            f.close();
            return { success: true, path: path };
        } catch (e) {
            return { error: String(e) };
        }
    },

    Edit: function(params) {
        const path = params.file_path;
        const oldString = params.old_string;
        const newString = params.new_string;
        const replaceAll = params.replace_all || false;

        try {
            const f = std.open(path, 'r');
            if (!f) {
                return { error: 'File not found: ' + path };
            }
            let content = f.readAsString();
            f.close();

            // Check if old_string exists
            if (content.indexOf(oldString) === -1) {
                return { error: 'String not found in file: ' + oldString.substring(0, 50) };
            }

            // Replace
            if (replaceAll) {
                content = content.split(oldString).join(newString);
            } else {
                content = content.replace(oldString, newString);
            }

            // Write back
            const fw = std.open(path, 'w');
            fw.puts(content);
            fw.close();

            return { success: true, path: path };
        } catch (e) {
            return { error: String(e) };
        }
    },

    Bash: function(params) {
        const command = params.command;
        const timeout = params.timeout || 120000;

        try {
            const pipe = std.popen(command + ' 2>&1', 'r');
            let output = '';
            let line;
            while ((line = pipe.getline()) !== null) {
                output += line + '\n';
            }
            const exitCode = pipe.close();

            return {
                stdout: output,
                exit_code: exitCode
            };
        } catch (e) {
            return { error: String(e) };
        }
    },

    Glob: function(params) {
        const pattern = params.pattern;
        const path = params.path || '.';

        // Use find command for globbing on Tiger
        const cmd = 'find ' + path + ' -name "' + pattern.replace(/\*\*/g, '*') + '" 2>/dev/null | head -100';
        const pipe = std.popen(cmd, 'r');
        const files = [];
        let line;
        while ((line = pipe.getline()) !== null) {
            if (line.trim()) files.push(line.trim());
        }
        pipe.close();

        return { files: files };
    },

    Grep: function(params) {
        const pattern = params.pattern;
        const path = params.path || '.';
        const outputMode = params.output_mode || 'files_with_matches';

        let cmd;
        if (outputMode === 'files_with_matches') {
            cmd = 'grep -rl "' + pattern + '" ' + path + ' 2>/dev/null | head -50';
        } else if (outputMode === 'count') {
            cmd = 'grep -rc "' + pattern + '" ' + path + ' 2>/dev/null | grep -v ":0$" | head -50';
        } else {
            cmd = 'grep -rn "' + pattern + '" ' + path + ' 2>/dev/null | head -100';
        }

        const pipe = std.popen(cmd, 'r');
        let output = '';
        let line;
        while ((line = pipe.getline()) !== null) {
            output += line + '\n';
        }
        pipe.close();

        return { matches: output };
    }
};

// Tool definitions for Claude API
const toolDefinitions = [
    {
        name: 'Read',
        description: 'Read a file from the filesystem',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path to the file' },
                offset: { type: 'number', description: 'Line offset to start reading' },
                limit: { type: 'number', description: 'Number of lines to read' }
            },
            required: ['file_path']
        }
    },
    {
        name: 'Write',
        description: 'Write content to a file',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path to the file' },
                content: { type: 'string', description: 'Content to write' }
            },
            required: ['file_path', 'content']
        }
    },
    {
        name: 'Edit',
        description: 'Replace text in a file',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path to the file' },
                old_string: { type: 'string', description: 'Text to replace' },
                new_string: { type: 'string', description: 'Replacement text' },
                replace_all: { type: 'boolean', description: 'Replace all occurrences' }
            },
            required: ['file_path', 'old_string', 'new_string']
        }
    },
    {
        name: 'Bash',
        description: 'Execute a shell command',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The command to execute' },
                timeout: { type: 'number', description: 'Timeout in milliseconds' }
            },
            required: ['command']
        }
    },
    {
        name: 'Glob',
        description: 'Find files matching a pattern',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Glob pattern (e.g., "*.js")' },
                path: { type: 'string', description: 'Directory to search in' }
            },
            required: ['pattern']
        }
    },
    {
        name: 'Grep',
        description: 'Search file contents with regex',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Search pattern' },
                path: { type: 'string', description: 'Path to search' },
                output_mode: { type: 'string', description: 'files_with_matches, count, or content' }
            },
            required: ['pattern']
        }
    }
];

// ============================================================================
// Claude API Client
// ============================================================================

function callClaude(messages) {
    // Check authentication
    if (!CONFIG.useProxy && !CONFIG.apiKey) {
        return { error: 'Set ANTHROPIC_API_KEY or CLAUDE_PROXY environment variable' };
    }

    const requestBody = {
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        system: CONFIG.systemPrompt,
        tools: toolDefinitions,
        messages: messages
    };

    // Build headers based on mode
    const headers = {
        'Content-Type': 'application/json'
    };

    if (CONFIG.useProxy) {
        // Proxy mode - Max subscription
        // Proxy handles authentication
    } else {
        // Direct API mode
        headers['x-api-key'] = CONFIG.apiKey;
        headers['anthropic-version'] = '2023-06-01';
    }

    const response = httpRequest('POST', CONFIG.apiUrl, headers, JSON.stringify(requestBody));

    if (!response.ok) {
        return { error: response.error || 'HTTP error: ' + response.status };
    }

    try {
        return JSON.parse(response.body);
    } catch (e) {
        return { error: 'Failed to parse API response' };
    }
}

// ============================================================================
// Tool Execution
// ============================================================================

function executeTool(toolName, toolInput) {
    print('\n\x1b[36m▶ ' + toolName + '\x1b[0m');

    if (tools[toolName]) {
        const result = tools[toolName](toolInput);

        // Show brief result
        const resultStr = JSON.stringify(result);
        if (resultStr.length > 200) {
            print('\x1b[90m  ' + resultStr.substring(0, 200) + '...\x1b[0m');
        } else {
            print('\x1b[90m  ' + resultStr + '\x1b[0m');
        }

        return result;
    } else {
        return { error: 'Unknown tool: ' + toolName };
    }
}

// ============================================================================
// Conversation Loop
// ============================================================================

function runConversation(userMessage) {
    const messages = [
        { role: 'user', content: userMessage }
    ];

    while (true) {
        print('\n\x1b[33m⏳ Thinking...\x1b[0m');

        const response = callClaude(messages);

        if (response.error) {
            print('\x1b[31mError: ' + response.error + '\x1b[0m');
            return;
        }

        // Process response content
        let hasToolUse = false;
        const toolResults = [];

        for (const block of response.content || []) {
            if (block.type === 'text') {
                print('\n\x1b[32m' + block.text + '\x1b[0m');
            } else if (block.type === 'tool_use') {
                hasToolUse = true;
                const result = executeTool(block.name, block.input);
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify(result)
                });
            }
        }

        // If there were tool calls, continue the loop
        if (hasToolUse) {
            messages.push({ role: 'assistant', content: response.content });
            messages.push({ role: 'user', content: toolResults });
        } else {
            // Done
            break;
        }

        // Check stop reason
        if (response.stop_reason === 'end_turn') {
            break;
        }
    }
}

// ============================================================================
// Main REPL
// ============================================================================

function main() {
    print('\n\x1b[1;35m╔═══════════════════════════════════════════════════════════╗');
    print('║     Claude Code for PowerPC G4 Tiger                      ║');
    print('║     QuickJS + Python TLS Bridge                           ║');
    print('╚═══════════════════════════════════════════════════════════╝\x1b[0m\n');

    // Check API key
    if (!CONFIG.apiKey) {
        print('\x1b[31mWarning: ANTHROPIC_API_KEY not set\x1b[0m');
        print('Set it with: export ANTHROPIC_API_KEY=your-key-here\n');
    }

    print('Type your request, or "quit" to exit.\n');

    // Simple REPL
    while (true) {
        std.out.puts('\x1b[1m> \x1b[0m');
        std.out.flush();

        const line = std.in.getline();
        if (line === null || line.toLowerCase() === 'quit' || line.toLowerCase() === 'exit') {
            print('\nGoodbye!');
            break;
        }

        if (line.trim()) {
            runConversation(line.trim());
        }
    }
}

// Run
main();
