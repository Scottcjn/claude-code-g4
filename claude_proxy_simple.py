#!/usr/bin/env python3
"""
Simple Claude Proxy - Uses 'claude -p' to leverage Max subscription
Run this on your main machine, G4 connects to it.
"""

import http.server
import json
import subprocess
import socketserver
import sys

PORT = 8765

class ClaudeProxyHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')

        try:
            data = json.loads(body)
            messages = data.get("messages", [])

            # Get the last user message
            user_msg = ""
            for msg in messages:
                if msg.get("role") == "user":
                    user_msg = msg.get("content", "")

            if not user_msg:
                self.send_error(400, "No user message")
                return

            print(f"[Proxy] Request: {user_msg[:50]}...")

            # Call claude -p
            result = subprocess.run(
                ["claude", "-p", user_msg],
                capture_output=True,
                text=True,
                timeout=300,
                env={"NO_COLOR": "1", "PATH": "/usr/local/bin:/usr/bin:/bin"}
            )

            response_text = result.stdout if result.stdout else result.stderr

            # Format as API response
            response = {
                "content": [{"type": "text", "text": response_text}],
                "stop_reason": "end_turn",
                "model": "claude-via-proxy"
            }

            response_json = json.dumps(response)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(response_json))
            self.end_headers()
            self.wfile.write(response_json.encode())

            print(f"[Proxy] Response: {len(response_text)} chars")

        except subprocess.TimeoutExpired:
            self.send_error(504, "Timeout")
        except Exception as e:
            print(f"[Proxy] Error: {e}")
            self.send_error(500, str(e))

    def log_message(self, format, *args):
        pass

print(f"""
╔═══════════════════════════════════════════════════════════╗
║         Claude Proxy for G4 (Max Subscription)            ║
╚═══════════════════════════════════════════════════════════╝

Listening on: http://0.0.0.0:{PORT}

On G4, set: API_URL = "http://192.168.0.XXX:{PORT}/v1/messages"

Press Ctrl+C to stop.
""")

with socketserver.TCPServer(("0.0.0.0", PORT), ClaudeProxyHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
