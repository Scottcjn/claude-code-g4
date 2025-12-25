#!/usr/bin/env python3
"""
Claude Proxy Server
====================
Runs on your main machine, forwards requests from G4 to Claude API
using your Max subscription OAuth token.

Usage:
    python3 claude_proxy.py

The G4 connects to this proxy instead of directly to Anthropic.
"""

import http.server
import json
import os
import subprocess
import socketserver
from pathlib import Path
from urllib.parse import urlparse

PORT = 8765  # Proxy port

# Load OAuth token from Claude Code's credentials
def get_oauth_token():
    creds_file = Path.home() / ".claude" / ".credentials.json"
    if creds_file.exists():
        creds = json.loads(creds_file.read_text())
        return creds.get("claudeAiOauth", {}).get("accessToken", "")
    return ""

class ClaudeProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        # Read the request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        print(f"[Proxy] Received request from {self.client_address[0]}")

        # Get OAuth token
        token = get_oauth_token()
        if not token:
            self.send_error(500, "No OAuth token available")
            return

        # Forward to Claude using curl (simpler than urllib with OAuth complexities)
        try:
            # Use the actual Claude Code CLI to make the request
            # This ensures we use the same auth mechanism
            request_data = json.loads(body)

            # Extract the user message
            messages = request_data.get("messages", [])
            if not messages:
                self.send_error(400, "No messages in request")
                return

            user_message = messages[-1].get("content", "")

            # Call Claude Code in print mode
            result = subprocess.run(
                ["claude", "-p", user_message],
                capture_output=True,
                text=True,
                timeout=120,
                env={**os.environ, "NO_COLOR": "1"}
            )

            # Format response like the API would
            response = {
                "content": [{"type": "text", "text": result.stdout}],
                "stop_reason": "end_turn"
            }

            response_json = json.dumps(response)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(response_json))
            self.end_headers()
            self.wfile.write(response_json.encode())

            print(f"[Proxy] Response sent ({len(result.stdout)} chars)")

        except subprocess.TimeoutExpired:
            self.send_error(504, "Claude request timed out")
        except Exception as e:
            print(f"[Proxy] Error: {e}")
            self.send_error(500, str(e))

    def log_message(self, format, *args):
        print(f"[Proxy] {args[0]}")

def main():
    print(f"""
╔═══════════════════════════════════════════════════════════╗
║            Claude Proxy Server for G4                      ║
╚═══════════════════════════════════════════════════════════╝

Listening on port {PORT}
G4 should connect to: http://192.168.0.XXX:{PORT}/v1/messages

Press Ctrl+C to stop.
""")

    with socketserver.TCPServer(("0.0.0.0", PORT), ClaudeProxyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[Proxy] Shutting down...")

if __name__ == "__main__":
    main()
