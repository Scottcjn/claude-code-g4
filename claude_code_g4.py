#!/usr/bin/env python3
"""
Claude Code G4 - Claude Code CLI for PowerPC Mac OS X Tiger/Leopard
=====================================================================

The world's first AI coding assistant running on a 2003 PowerPC G4!

Requirements:
- Python 3.10+ (MacPorts: /opt/local/bin/python3.10)
- OpenSSL 3.x (bundled with MacPorts Python)

Target: Mac OS X Tiger 10.4 / Leopard 10.5 on PowerPC G4/G5

Author: Scott (scottcjn) - December 2024
"""

import os
import sys
import json
import subprocess
import re
import fnmatch
import readline
import hashlib
from typing import Optional, Dict, List, Any, Generator
from pathlib import Path

# Check Python version
if sys.version_info < (3, 7):
    print("Error: Python 3.7+ required. You have:", sys.version)
    print("On Tiger, use: /opt/local/bin/python3.10")
    sys.exit(1)

# HTTP handling - use urllib (no external deps)
import urllib.request
import urllib.error
import ssl

# Version info
VERSION = "0.1.0"
CODENAME = "Tiger"

# ANSI colors (Terminal.app on Tiger supports these)
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"

# API Configuration
# Use proxy if CLAUDE_PROXY is set, otherwise direct API
PROXY_URL = os.environ.get("CLAUDE_PROXY", "")
API_URL = PROXY_URL if PROXY_URL else "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-4-20250514"  # Can change to opus, haiku, etc.

def get_api_key() -> str:
    """Get API key from environment or config file."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key

    # Check ~/.config/claude-code-g4/api_key
    config_file = Path.home() / ".config" / "claude-code-g4" / "api_key"
    if config_file.exists():
        return config_file.read_text().strip()

    # Check ~/.anthropic/api_key
    anthropic_file = Path.home() / ".anthropic" / "api_key"
    if anthropic_file.exists():
        return anthropic_file.read_text().strip()

    return ""


def oauth_login() -> str:
    """Perform OAuth login flow - returns access token."""
    import secrets
    import time
    import http.server
    import socketserver
    import threading
    from urllib.parse import urlencode, parse_qs, urlparse

    # OAuth endpoints
    AUTH_URL = "https://console.anthropic.com/oauth/authorize"
    TOKEN_URL = "https://console.anthropic.com/oauth/token"

    # Client ID for Claude Code (public client)
    CLIENT_ID = "9d1c250a-e61b-44cd-8913-9f323a2c5c1b"

    # Generate PKCE codes
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = hashlib.sha256(code_verifier.encode()).digest()
    import base64
    code_challenge = base64.urlsafe_b64encode(code_challenge).decode().rstrip('=')

    # State for CSRF protection
    state = secrets.token_urlsafe(32)

    # Port for callback
    PORT = 45454

    # Will store the auth code
    auth_code = None
    server_error = None

    class OAuthHandler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            nonlocal auth_code, server_error
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)

            if 'code' in params and 'state' in params:
                if params['state'][0] == state:
                    auth_code = params['code'][0]
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write(b"""
                    <html><body style="font-family: system-ui; text-align: center; padding: 50px;">
                    <h1>Success!</h1>
                    <p>You can close this window and return to Claude Code G4.</p>
                    </body></html>
                    """)
                else:
                    server_error = "State mismatch"
                    self.send_error(400, "State mismatch")
            elif 'error' in params:
                server_error = params.get('error_description', params['error'])[0]
                self.send_error(400, server_error)
            else:
                self.send_error(400, "Missing authorization code")

        def log_message(self, format, *args):
            pass  # Suppress logs

    # Build authorization URL
    auth_params = {
        'client_id': CLIENT_ID,
        'response_type': 'code',
        'redirect_uri': f'http://localhost:{PORT}/callback',
        'scope': 'user:inference',
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256'
    }

    auth_url = f"{AUTH_URL}?{urlencode(auth_params)}"

    print(f"\n{Colors.CYAN}╔═══════════════════════════════════════════════════════════╗")
    print(f"║                    OAuth Login Required                    ║")
    print(f"╚═══════════════════════════════════════════════════════════╝{Colors.RESET}\n")
    print(f"Open this URL in a browser (on any machine):\n")
    print(f"{Colors.YELLOW}{auth_url}{Colors.RESET}\n")
    print(f"Waiting for authorization... (Ctrl+C to cancel)\n")

    # Start local server to receive callback
    try:
        with socketserver.TCPServer(("", PORT), OAuthHandler) as httpd:
            httpd.timeout = 300  # 5 minute timeout

            while auth_code is None and server_error is None:
                httpd.handle_request()

    except KeyboardInterrupt:
        print(f"\n{Colors.RED}Login cancelled.{Colors.RESET}")
        return ""
    except Exception as e:
        print(f"\n{Colors.RED}Error starting auth server: {e}{Colors.RESET}")
        print(f"You may need to manually get an API key from console.anthropic.com")
        return ""

    if server_error:
        print(f"\n{Colors.RED}OAuth error: {server_error}{Colors.RESET}")
        return ""

    if not auth_code:
        print(f"\n{Colors.RED}No authorization code received.{Colors.RESET}")
        return ""

    # Exchange code for token
    print(f"{Colors.GREEN}Authorization received! Exchanging for token...{Colors.RESET}")

    token_data = {
        'grant_type': 'authorization_code',
        'client_id': CLIENT_ID,
        'code': auth_code,
        'redirect_uri': f'http://localhost:{PORT}/callback',
        'code_verifier': code_verifier
    }

    try:
        req = urllib.request.Request(
            TOKEN_URL,
            data=urlencode(token_data).encode('utf-8'),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            method='POST'
        )

        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
            token_response = json.loads(response.read().decode('utf-8'))

        access_token = token_response.get('access_token')
        if access_token:
            # Save token
            config_dir = Path.home() / ".config" / "claude-code-g4"
            config_dir.mkdir(parents=True, exist_ok=True)
            token_file = config_dir / "oauth_token"
            token_file.write_text(access_token)
            print(f"{Colors.GREEN}Login successful! Token saved.{Colors.RESET}\n")
            return access_token
        else:
            print(f"{Colors.RED}No access token in response.{Colors.RESET}")
            return ""

    except Exception as e:
        print(f"{Colors.RED}Token exchange failed: {e}{Colors.RESET}")
        return ""


def get_auth() -> tuple:
    """Get authentication - returns (api_key, is_oauth)."""
    # Check for API key first
    api_key = get_api_key()
    if api_key:
        return api_key, False

    # Check for saved OAuth token
    token_file = Path.home() / ".config" / "claude-code-g4" / "oauth_token"
    if token_file.exists():
        return token_file.read_text().strip(), True

    return "", False

def print_banner():
    """Print startup banner."""
    print(f"""{Colors.CYAN}
╔═══════════════════════════════════════════════════════════╗
║  {Colors.BOLD}Claude Code G4{Colors.RESET}{Colors.CYAN} - AI Coding Assistant for PowerPC      ║
║  Version {VERSION} "{CODENAME}"                                   ║
╠═══════════════════════════════════════════════════════════╣
║  Running on: {get_system_info():<42} ║
╚═══════════════════════════════════════════════════════════╝
{Colors.RESET}""")

def get_system_info() -> str:
    """Get system information string."""
    try:
        uname = os.uname()
        return f"{uname.sysname} {uname.release} ({uname.machine})"
    except:
        return "Mac OS X (PowerPC)"

# =============================================================================
# Tool Implementations
# =============================================================================

class Tools:
    """Tool implementations matching Claude Code's tools."""

    @staticmethod
    def read_file(file_path: str, offset: int = 0, limit: int = 2000) -> Dict[str, Any]:
        """Read a file and return its contents."""
        try:
            path = Path(file_path).expanduser().resolve()
            if not path.exists():
                return {"error": f"File not found: {file_path}"}
            if path.is_dir():
                return {"error": f"Path is a directory: {file_path}"}

            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()

            # Apply offset and limit
            total_lines = len(lines)
            start = max(0, offset)
            end = min(total_lines, start + limit)
            selected = lines[start:end]

            # Format with line numbers
            content = ""
            for i, line in enumerate(selected, start=start+1):
                # Truncate long lines
                if len(line) > 2000:
                    line = line[:2000] + "...\n"
                content += f"{i:6d}\t{line}"

            return {
                "content": content,
                "total_lines": total_lines,
                "shown_lines": len(selected),
                "path": str(path)
            }
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def write_file(file_path: str, content: str) -> Dict[str, Any]:
        """Write content to a file."""
        try:
            path = Path(file_path).expanduser().resolve()
            path.parent.mkdir(parents=True, exist_ok=True)

            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)

            return {"success": True, "path": str(path), "bytes": len(content)}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def edit_file(file_path: str, old_string: str, new_string: str) -> Dict[str, Any]:
        """Replace old_string with new_string in file."""
        try:
            path = Path(file_path).expanduser().resolve()
            if not path.exists():
                return {"error": f"File not found: {file_path}"}

            content = path.read_text(encoding='utf-8')

            # Check if old_string exists
            count = content.count(old_string)
            if count == 0:
                return {"error": f"String not found in file"}
            if count > 1:
                return {"error": f"String found {count} times - must be unique"}

            new_content = content.replace(old_string, new_string, 1)
            path.write_text(new_content, encoding='utf-8')

            return {"success": True, "path": str(path)}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def bash(command: str, timeout: int = 120) -> Dict[str, Any]:
        """Execute a bash command."""
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=os.getcwd()
            )

            output = result.stdout
            if result.stderr:
                output += "\n" + result.stderr

            # Truncate if too long
            if len(output) > 30000:
                output = output[:30000] + "\n... (truncated)"

            return {
                "output": output,
                "exit_code": result.returncode
            }
        except subprocess.TimeoutExpired:
            return {"error": f"Command timed out after {timeout}s"}
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def glob_files(pattern: str, path: str = ".") -> Dict[str, Any]:
        """Find files matching a glob pattern."""
        try:
            base = Path(path).expanduser().resolve()
            matches = list(base.glob(pattern))

            # Sort by modification time (newest first)
            matches.sort(key=lambda p: p.stat().st_mtime, reverse=True)

            # Limit results
            matches = matches[:100]

            return {
                "files": [str(p) for p in matches],
                "count": len(matches)
            }
        except Exception as e:
            return {"error": str(e)}

    @staticmethod
    def grep(pattern: str, path: str = ".", file_pattern: str = "*") -> Dict[str, Any]:
        """Search for pattern in files."""
        try:
            base = Path(path).expanduser().resolve()
            results = []
            regex = re.compile(pattern)

            # Find matching files
            if base.is_file():
                files = [base]
            else:
                files = list(base.rglob(file_pattern))[:1000]

            for file_path in files:
                if not file_path.is_file():
                    continue
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        for i, line in enumerate(f, 1):
                            if regex.search(line):
                                results.append({
                                    "file": str(file_path),
                                    "line": i,
                                    "content": line.rstrip()[:200]
                                })
                                if len(results) >= 100:
                                    break
                except:
                    continue

                if len(results) >= 100:
                    break

            return {"matches": results, "count": len(results)}
        except Exception as e:
            return {"error": str(e)}

# =============================================================================
# Claude API Client
# =============================================================================

class ClaudeClient:
    """Client for Claude API with tool use support."""

    def __init__(self, api_key: str, model: str = DEFAULT_MODEL, is_oauth: bool = False):
        self.api_key = api_key
        self.model = model
        self.is_oauth = is_oauth
        self.conversation: List[Dict] = []
        self.tools = self._define_tools()

    def _define_tools(self) -> List[Dict]:
        """Define available tools for Claude."""
        return [
            {
                "name": "Read",
                "description": "Read a file from the filesystem",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Absolute path to file"},
                        "offset": {"type": "integer", "description": "Line offset (default 0)"},
                        "limit": {"type": "integer", "description": "Max lines (default 2000)"}
                    },
                    "required": ["file_path"]
                }
            },
            {
                "name": "Write",
                "description": "Write content to a file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Absolute path to file"},
                        "content": {"type": "string", "description": "Content to write"}
                    },
                    "required": ["file_path", "content"]
                }
            },
            {
                "name": "Edit",
                "description": "Replace a unique string in a file",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_path": {"type": "string", "description": "Absolute path to file"},
                        "old_string": {"type": "string", "description": "String to replace"},
                        "new_string": {"type": "string", "description": "Replacement string"}
                    },
                    "required": ["file_path", "old_string", "new_string"]
                }
            },
            {
                "name": "Bash",
                "description": "Execute a bash command",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string", "description": "Command to execute"},
                        "timeout": {"type": "integer", "description": "Timeout in seconds"}
                    },
                    "required": ["command"]
                }
            },
            {
                "name": "Glob",
                "description": "Find files matching a pattern",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Glob pattern"},
                        "path": {"type": "string", "description": "Base path (default .)"}
                    },
                    "required": ["pattern"]
                }
            },
            {
                "name": "Grep",
                "description": "Search for pattern in files",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Regex pattern"},
                        "path": {"type": "string", "description": "Path to search"},
                        "file_pattern": {"type": "string", "description": "File glob pattern"}
                    },
                    "required": ["pattern"]
                }
            }
        ]

    def _execute_tool(self, name: str, input_data: Dict) -> str:
        """Execute a tool and return result as JSON string."""
        print(f"{Colors.DIM}  → Executing {name}...{Colors.RESET}")

        if name == "Read":
            result = Tools.read_file(
                input_data["file_path"],
                input_data.get("offset", 0),
                input_data.get("limit", 2000)
            )
        elif name == "Write":
            result = Tools.write_file(input_data["file_path"], input_data["content"])
        elif name == "Edit":
            result = Tools.edit_file(
                input_data["file_path"],
                input_data["old_string"],
                input_data["new_string"]
            )
        elif name == "Bash":
            result = Tools.bash(
                input_data["command"],
                input_data.get("timeout", 120)
            )
        elif name == "Glob":
            result = Tools.glob_files(
                input_data["pattern"],
                input_data.get("path", ".")
            )
        elif name == "Grep":
            result = Tools.grep(
                input_data["pattern"],
                input_data.get("path", "."),
                input_data.get("file_pattern", "*")
            )
        else:
            result = {"error": f"Unknown tool: {name}"}

        return json.dumps(result)

    def send_message(self, user_message: str) -> Generator[str, None, None]:
        """Send a message and yield response chunks."""

        # Add user message to conversation
        self.conversation.append({
            "role": "user",
            "content": user_message
        })

        # Build request
        system_prompt = f"""You are Claude Code G4, an AI coding assistant running on a vintage PowerPC G4 Mac.

Current working directory: {os.getcwd()}
System: {get_system_info()}

You have access to tools for reading, writing, and editing files, running bash commands, and searching.
Be concise and efficient - this is a resource-constrained system.
When using tools, wait for results before continuing."""

        request_data = {
            "model": self.model,
            "max_tokens": 4096,
            "system": system_prompt,
            "messages": self.conversation,
            "tools": self.tools
        }

        # Make API request
        headers = {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01"
        }

        # Use appropriate auth header (skip if using proxy)
        if not PROXY_URL:
            if self.is_oauth:
                headers["Authorization"] = f"Bearer {self.api_key}"
            else:
                headers["x-api-key"] = self.api_key

        try:
            print(f"{Colors.DIM}  Connecting to API...{Colors.RESET}", flush=True)
            req = urllib.request.Request(
                API_URL,
                data=json.dumps(request_data).encode('utf-8'),
                headers=headers,
                method='POST'
            )

            # Create SSL context
            ctx = ssl.create_default_context()

            print(f"{Colors.DIM}  Sending request...{Colors.RESET}", flush=True)
            with urllib.request.urlopen(req, context=ctx, timeout=120) as response:
                print(f"{Colors.DIM}  Reading response...{Colors.RESET}", flush=True)
                response_text = response.read().decode('utf-8')

            response_data = json.loads(response_text)
            print(f"{Colors.DIM}  Got response!{Colors.RESET}", flush=True)

        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8')
            yield f"{Colors.RED}API Error: {e.code} - {error_body}{Colors.RESET}"
            return
        except Exception as e:
            yield f"{Colors.RED}Error: {e}{Colors.RESET}"
            return

        # Process response
        stop_reason = response_data.get("stop_reason")
        content_blocks = response_data.get("content", [])

        # Handle tool use
        while stop_reason == "tool_use":
            # Collect assistant message
            assistant_content = []
            tool_uses = []

            for block in content_blocks:
                if block["type"] == "text":
                    yield block["text"]
                    assistant_content.append(block)
                elif block["type"] == "tool_use":
                    tool_uses.append(block)
                    assistant_content.append(block)

            # Add assistant message to conversation
            self.conversation.append({
                "role": "assistant",
                "content": assistant_content
            })

            # Execute tools and collect results
            tool_results = []
            for tool_use in tool_uses:
                result = self._execute_tool(tool_use["name"], tool_use["input"])
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use["id"],
                    "content": result
                })

            # Add tool results to conversation
            self.conversation.append({
                "role": "user",
                "content": tool_results
            })

            # Continue conversation
            request_data["messages"] = self.conversation

            try:
                req = urllib.request.Request(
                    API_URL,
                    data=json.dumps(request_data).encode('utf-8'),
                    headers=headers,
                    method='POST'
                )

                with urllib.request.urlopen(req, context=ctx, timeout=120) as response:
                    response_text = response.read().decode('utf-8')

                response_data = json.loads(response_text)
                stop_reason = response_data.get("stop_reason")
                content_blocks = response_data.get("content", [])

            except Exception as e:
                yield f"{Colors.RED}Error: {e}{Colors.RESET}"
                return

        # Final response
        for block in content_blocks:
            if block["type"] == "text":
                yield block["text"]

        # Add final assistant message to conversation
        self.conversation.append({
            "role": "assistant",
            "content": content_blocks
        })

# =============================================================================
# Interactive CLI
# =============================================================================

def main():
    """Main CLI entry point."""
    print_banner()

    # Check for authentication (skip if using proxy)
    api_key, is_oauth = "", False
    if not PROXY_URL:
        api_key, is_oauth = get_auth()

        if not api_key:
            # No saved auth - try OAuth login
            print(f"{Colors.YELLOW}No authentication found. Starting OAuth login...{Colors.RESET}")
            api_key = oauth_login()
            is_oauth = True

            if not api_key:
                print(f"{Colors.RED}Error: Authentication failed!{Colors.RESET}")
                print(f"You can also set ANTHROPIC_API_KEY environment variable or create:")
                print(f"  ~/.config/claude-code-g4/api_key")
                sys.exit(1)

    if PROXY_URL:
        print(f"{Colors.GREEN}Using proxy: {PROXY_URL}{Colors.RESET}")
    else:
        auth_type = "OAuth" if is_oauth else "API key"
        print(f"{Colors.GREEN}Authenticated via {auth_type}.{Colors.RESET}")
    print(f"Model: {Colors.CYAN}{DEFAULT_MODEL}{Colors.RESET}")
    print(f"Working directory: {Colors.CYAN}{os.getcwd()}{Colors.RESET}")
    print()
    print(f"Type your message and press Enter. Use {Colors.BOLD}/quit{Colors.RESET} to exit.")
    print(f"Use {Colors.BOLD}/clear{Colors.RESET} to reset conversation.")
    print(f"Use {Colors.BOLD}/login{Colors.RESET} to re-authenticate.")
    print()

    client = ClaudeClient(api_key, is_oauth=is_oauth)

    # Setup readline history
    history_file = Path.home() / ".claude_code_g4_history"
    try:
        readline.read_history_file(history_file)
    except:
        pass

    while True:
        try:
            # Get user input
            user_input = input(f"{Colors.GREEN}>{Colors.RESET} ").strip()

            if not user_input:
                continue

            # Handle commands
            if user_input.lower() == "/quit":
                print(f"{Colors.CYAN}Goodbye!{Colors.RESET}")
                break
            elif user_input.lower() == "/clear":
                client.conversation = []
                print(f"{Colors.YELLOW}Conversation cleared.{Colors.RESET}")
                continue
            elif user_input.lower() == "/login":
                print(f"{Colors.YELLOW}Re-authenticating...{Colors.RESET}")
                new_key = oauth_login()
                if new_key:
                    client = ClaudeClient(new_key, is_oauth=True)
                    print(f"{Colors.GREEN}Logged in successfully!{Colors.RESET}")
                continue
            elif user_input.lower() == "/help":
                print(f"""
{Colors.BOLD}Commands:{Colors.RESET}
  /quit   - Exit Claude Code G4
  /clear  - Clear conversation history
  /login  - Re-authenticate with OAuth
  /help   - Show this help

{Colors.BOLD}Tips:{Colors.RESET}
  - Claude can read, write, and edit files
  - Claude can run bash commands
  - Claude can search with glob and grep
  - This is running on PowerPC - be patient!
""")
                continue

            # Send to Claude
            print()
            for chunk in client.send_message(user_input):
                print(chunk, end="", flush=True)
            print("\n")

        except KeyboardInterrupt:
            print(f"\n{Colors.YELLOW}(Use /quit to exit){Colors.RESET}")
            continue
        except EOFError:
            print(f"\n{Colors.CYAN}Goodbye!{Colors.RESET}")
            break

    # Save history
    try:
        readline.write_history_file(history_file)
    except:
        pass

if __name__ == "__main__":
    main()
