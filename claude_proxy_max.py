#!/usr/bin/env python3
"""
Claude Max Subscription Proxy for G4

This proxy runs on your main machine (where you're logged into Claude Code)
and forwards requests from the G4 using your Max subscription.

The key difference: This uses full conversation context and tool definitions,
not just simple prompts. It's a complete API-compatible proxy.

Run this on your modern machine:
    python3 claude_proxy_max.py

On the G4, set:
    export CLAUDE_PROXY="http://192.168.0.xxx:8765/v1/messages"
"""

import http.server
import json
import subprocess
import socketserver
import os
import sys
import tempfile

PORT = 8765

class ClaudeMaxProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body)

            # Extract the full request
            messages = data.get("messages", [])
            system = data.get("system", "")
            tools = data.get("tools", [])

            # Build a prompt that includes context
            prompt_parts = []

            if system:
                prompt_parts.append(f"<system>\n{system}\n</system>\n")

            if tools:
                tool_list = ", ".join(t.get("name", "unknown") for t in tools)
                prompt_parts.append(f"<available_tools>{tool_list}</available_tools>\n")

            # Add message history
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")

                if isinstance(content, list):
                    # Handle content blocks (tool results, etc.)
                    text_parts = []
                    for block in content:
                        if isinstance(block, dict):
                            if block.get("type") == "text":
                                text_parts.append(block.get("text", ""))
                            elif block.get("type") == "tool_result":
                                text_parts.append(f"[Tool Result: {block.get('content', '')}]")
                            elif block.get("type") == "tool_use":
                                text_parts.append(f"[Tool Call: {block.get('name', '')}({json.dumps(block.get('input', {}))})]")
                        else:
                            text_parts.append(str(block))
                    content = "\n".join(text_parts)

                prompt_parts.append(f"<{role}>\n{content}\n</{role}>\n")

            full_prompt = "\n".join(prompt_parts)

            # Write prompt to temp file (avoid shell escaping issues)
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
                f.write(full_prompt)
                prompt_file = f.name

            print(f"[Proxy] Processing request ({len(full_prompt)} chars)...")

            # Call claude CLI with the prompt file
            # Using --output-format json for structured response
            result = subprocess.run(
                ["claude", "-p", f"$(cat {prompt_file})", "--output-format", "json"],
                capture_output=True,
                text=True,
                timeout=300,
                shell=True,
                env={**os.environ, "NO_COLOR": "1"}
            )

            # Clean up temp file
            os.unlink(prompt_file)

            response_text = result.stdout.strip() if result.stdout else result.stderr

            # Try to parse as JSON first
            try:
                parsed = json.loads(response_text)
                # If it's already structured, use it
                if "content" in parsed:
                    response = parsed
                else:
                    # Wrap text response
                    response = {
                        "content": [{"type": "text", "text": response_text}],
                        "stop_reason": "end_turn",
                        "model": "claude-via-max-proxy"
                    }
            except:
                # Plain text response
                response = {
                    "content": [{"type": "text", "text": response_text}],
                    "stop_reason": "end_turn",
                    "model": "claude-via-max-proxy"
                }

            response_json = json.dumps(response)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(response_json))
            self.end_headers()
            self.wfile.write(response_json.encode())

            print(f"[Proxy] Response: {len(response_text)} chars")

        except subprocess.TimeoutExpired:
            self.send_error(504, "Request timeout")
        except Exception as e:
            print(f"[Proxy] Error: {e}")
            import traceback
            traceback.print_exc()
            self.send_error(500, str(e))

    def log_message(self, format, *args):
        pass  # Suppress default logging


def main():
    # Check if claude CLI is available
    try:
        result = subprocess.run(["claude", "--version"], capture_output=True, text=True)
        version = result.stdout.strip() if result.stdout else "unknown"
        print(f"Claude CLI: {version}")
    except FileNotFoundError:
        print("ERROR: 'claude' command not found!")
        print("Install Claude Code CLI first: npm install -g @anthropic/claude-code")
        sys.exit(1)

    print(f"""
╔═══════════════════════════════════════════════════════════╗
║       Claude Max Subscription Proxy for G4                ║
╚═══════════════════════════════════════════════════════════╝

Listening on: http://0.0.0.0:{PORT}

On the G4, run:
  export CLAUDE_PROXY="http://YOUR_IP:{PORT}/v1/messages"
  ./qjs --std claude_code.js

Press Ctrl+C to stop.
""")

    with socketserver.TCPServer(("0.0.0.0", PORT), ClaudeMaxProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down...")


if __name__ == "__main__":
    main()
