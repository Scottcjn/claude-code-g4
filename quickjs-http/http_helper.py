#!/usr/bin/env python3
"""
HTTP Helper for QuickJS on Tiger/Leopard
Uses Python 3.10's OpenSSL for TLS 1.2/1.3 support
Called via os.exec from QuickJS
"""
import sys
import json
import urllib.request
import urllib.error
import ssl

def make_request(method, url, headers=None, body=None):
    """Make HTTP request and return JSON response."""
    headers = headers or {}

    # Create SSL context with modern TLS
    ctx = ssl.create_default_context()
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED

    # Build request
    data = body.encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, method=method)

    for key, value in headers.items():
        req.add_header(key, value)

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=120) as resp:
            response_body = resp.read().decode('utf-8')
            return {
                "ok": True,
                "status": resp.status,
                "headers": dict(resp.headers),
                "body": response_body
            }
    except urllib.error.HTTPError as e:
        return {
            "ok": False,
            "status": e.code,
            "error": str(e),
            "body": e.read().decode('utf-8') if e.fp else ""
        }
    except Exception as e:
        return {
            "ok": False,
            "status": 0,
            "error": str(e),
            "body": ""
        }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Usage: http_helper.py <json_request>"}))
        sys.exit(1)

    try:
        # Read request from stdin if arg is "-"
        if sys.argv[1] == "-":
            request_json = sys.stdin.read()
        else:
            request_json = sys.argv[1]

        req = json.loads(request_json)
        method = req.get("method", "GET")
        url = req.get("url", "")
        headers = req.get("headers", {})
        body = req.get("body", None)

        result = make_request(method, url, headers, body)
        print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
