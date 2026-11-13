#!/usr/bin/env python3
"""A stand-in for a model provider and a tool server, for checks/flows/assistant.sh.

Speaks just enough of the Anthropic Messages stream, the OpenAI chat-completions
stream and MCP over HTTP to drive the assistant through a full tool loop without
a real key. It scripts the "model": search, read, edit, call the tool server, answer.
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SEEN = []  # every request body, so the flow can check what was sent


def script(messages):
    """The next step, from how many tool results the conversation already holds."""
    done = sum(
        1
        for m in messages
        for b in (m["content"] if isinstance(m["content"], list) else [])
        if b.get("type") == "tool_result"
    ) + sum(1 for m in messages if m.get("role") == "tool")
    steps = [
        ("search_notes", {"query": "launch"}),
        ("read_note", {"path": "Plan.md"}),
        ("edit_note", {"path": "Plan.md", "old_text": "Launch: TBD", "new_text": "Launch: 1 March"}),
        ("mcp__cli__add", {"a": 2, "b": 3}),
    ]
    return steps[done] if done < len(steps) else None


def sse(handler, events):
    handler.send_response(200)
    handler.send_header("content-type", "text/event-stream")
    handler.end_headers()
    for event in events:
        handler.wfile.write(event.encode())
        handler.wfile.flush()


def anthropic_events(step):
    def ev(kind, data):
        return f"event: {kind}\ndata: {json.dumps({'type': kind, **data})}\n\n"

    out = [ev("message_start", {"message": {"id": "msg_1", "role": "assistant", "content": []}})]
    if step is None:
        out += [
            ev("content_block_start", {"index": 0, "content_block": {"type": "text", "text": ""}}),
            ev("content_block_delta", {"index": 0, "delta": {"type": "text_delta", "text": "The launch is "}}),
            ev("content_block_delta", {"index": 0, "delta": {"type": "text_delta", "text": "on 1 March, see [[Plan]]."}}),
            ev("content_block_stop", {"index": 0}),
            ev("message_delta", {"delta": {"stop_reason": "end_turn"}}),
        ]
    else:
        name, args = step
        raw = json.dumps(args)
        half = len(raw) // 2
        out += [
            ev("content_block_start", {"index": 0, "content_block": {"type": "thinking", "thinking": "", "signature": ""}}),
            ev("content_block_delta", {"index": 0, "delta": {"type": "signature_delta", "signature": "sig"}}),
            ev("content_block_stop", {"index": 0}),
            ev("content_block_start", {"index": 1, "content_block": {"type": "tool_use", "id": f"toolu_{name}", "name": name, "input": {}}}),
            ev("content_block_delta", {"index": 1, "delta": {"type": "input_json_delta", "partial_json": raw[:half]}}),
            ev("content_block_delta", {"index": 1, "delta": {"type": "input_json_delta", "partial_json": raw[half:]}}),
            ev("content_block_stop", {"index": 1}),
            ev("message_delta", {"delta": {"stop_reason": "tool_use"}}),
        ]
    return out + [ev("message_stop", {})]


def openai_events(step):
    def ev(delta, finish=None):
        return f"data: {json.dumps({'choices': [{'delta': delta, 'finish_reason': finish}]})}\n\n"

    if step is None:
        return [ev({"content": "The launch is "}), ev({"content": "on 1 March, see [[Plan]]."}), ev({}, "stop"), "data: [DONE]\n\n"]
    name, args = step
    raw = json.dumps(args)
    half = len(raw) // 2
    return [
        ev({"tool_calls": [{"index": 0, "id": f"call_{name}", "function": {"name": name, "arguments": raw[:half]}}]}),
        ev({"tool_calls": [{"index": 0, "function": {"arguments": raw[half:]}}]}),
        ev({}, "tool_calls"),
        "data: [DONE]\n\n",
    ]


def responses_events(step):
    """The OpenAI Responses stream, as a ChatGPT plan is served."""
    def ev(kind, data):
        return f"event: {kind}\ndata: {json.dumps({'type': kind, **data})}\n\n"

    if step is None:
        return [ev("response.output_text.delta", {"delta": "The launch is "}), ev("response.output_text.delta", {"delta": "on 1 March, see [[Plan]]."}), ev("response.completed", {"response": {"status": "completed"}})]
    name, args = step
    item = {"type": "function_call", "call_id": f"call_{name}", "name": name, "arguments": json.dumps(args)}
    return [ev("response.output_item.done", {"item": item}), ev("response.completed", {"response": {"status": "completed"}})]


def mcp_reply(message):
    method = message.get("method")
    if method == "initialize":
        version = message["params"].get("protocolVersion", "2025-06-18")
        return {"protocolVersion": version, "capabilities": {"tools": {}}, "serverInfo": {"name": "mock", "version": "1"}}
    if method == "tools/list":
        schema = {"type": "object", "properties": {"a": {"type": "number"}, "b": {"type": "number"}}, "required": ["a", "b"]}
        return {"tools": [{"name": "add", "description": "Add two numbers", "inputSchema": schema, "annotations": {"readOnlyHint": True}}]}
    if method == "tools/call":
        args = message["params"].get("arguments", {})
        return {"content": [{"type": "text", "text": str(args.get("a", 0) + args.get("b", 0))}]}
    return {}


def oauth_get(handler, base):
    """The sign-in side of a tool server that demands OAuth (at /mcp-auth)."""
    from urllib.parse import parse_qs, urlparse

    url = urlparse(handler.path)
    if url.path.startswith("/.well-known/oauth-protected-resource"):
        return handler.json(200, {"resource": f"{base}/mcp-auth", "authorization_servers": [base]})
    if url.path.startswith("/.well-known/oauth-authorization-server") or url.path.startswith("/.well-known/openid-configuration"):
        return handler.json(200, {
            "issuer": base, "authorization_endpoint": f"{base}/authorize", "token_endpoint": f"{base}/token",
            "registration_endpoint": f"{base}/register", "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"], "code_challenge_methods_supported": ["S256"],
            "token_endpoint_auth_methods_supported": ["none"],
        })
    if url.path == "/api/accounts/authorize":
        q = parse_qs(url.query)
        SEEN.append({"path": url.path, "key": None, "body": {k: v[0] for k, v in q.items()}})
        # First sign-in registers the app: hand back a client id of its own.
        handler.send_response(302)
        handler.send_header("location", f"{q['redirect_uri'][0]}?code=plan-code&state={q['state'][0]}&client_id=oaiapp_test")
        handler.end_headers()
        return True
    if url.path == "/authorize":
        q = parse_qs(url.query)
        # A real server shows a consent page here; the stand-in says yes at once.
        handler.send_response(302)
        handler.send_header("location", f"{q['redirect_uri'][0]}?code=the-code&state={q['state'][0]}")
        handler.end_headers()
        return True
    return False


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def json(self, status, body):
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        base = f"http://{self.headers.get('host')}"
        if self.path.startswith("/.well-known/") or self.path.startswith("/authorize") or self.path.startswith("/api/accounts/authorize"):
            if oauth_get(self, base) is not False:
                return
        if self.path == "/seen":
            return self.json(200, SEEN)
        if self.path.startswith("/v1/models") or self.path == "/models":
            return self.json(200, {"data": [{"id": "mock-model"}]})
        self.json(405, {})

    def do_DELETE(self):
        self.json(200, {})

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("content-length", 0)))
        if self.path == "/api/accounts/oauth/token":
            form = dict(pair.split("=", 1) for pair in raw.decode().split("&"))
            SEEN.append({"path": self.path, "key": None, "body": {k: form.get(k) for k in ("grant_type", "client_id")}})
            return self.json(200, {"access_token": "plan-token", "refresh_token": "plan-refresh", "expires_in": 3600, "scope": "openid offline_access resource.invoke chatgpt.tokens.use.direct"})
        if self.path == "/token":
            return self.json(200, {"access_token": "signed-in-token", "token_type": "Bearer", "expires_in": 3600, "refresh_token": "r1"})
        body = json.loads(raw or b"{}")
        base = f"http://{self.headers.get('host')}"
        if self.path == "/register":
            return self.json(201, {"client_id": "lokus-test", "redirect_uris": body.get("redirect_uris", []), "token_endpoint_auth_method": "none"})
        if self.path == "/mcp-auth" and self.headers.get("authorization") != "Bearer signed-in-token":
            self.send_response(401)
            self.send_header("www-authenticate", f'Bearer resource_metadata="{base}/.well-known/oauth-protected-resource/mcp-auth"')
            self.send_header("content-length", "0")
            self.end_headers()
            return
        if self.path in ("/mcp", "/mcp-auth"):
            if "id" not in body:
                self.send_response(202)
                self.end_headers()
                return
            return self.json(200, {"jsonrpc": "2.0", "id": body["id"], "result": mcp_reply(body)})
        SEEN.append({"path": self.path, "key": self.headers.get("x-api-key") or self.headers.get("authorization"), "body": body})
        if self.headers.get("x-api-key") == "wrong":
            return self.json(401, {"error": {"type": "authentication_error", "message": "invalid x-api-key"}})
        step = script(body["messages"]) if "messages" in body else None
        if self.path == "/v1/messages":
            return sse(self, anthropic_events(step))
        if self.path == "/responses":
            if self.headers.get("authorization") != "Bearer plan-token":
                return self.json(401, {"detail": "not signed in"})
            done = sum(1 for item in body["input"] if item.get("type") == "function_call_output")
            steps = [("search_notes", {"query": "launch"}), ("edit_note", {"path": "Plan.md", "old_text": "Launch: TBD", "new_text": "Launch: 1 March"})]
            return sse(self, responses_events(steps[done] if done < len(steps) else None))
        if self.path == "/chat/completions":
            return sse(self, openai_events(step))
        self.json(404, {})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8798), Handler).serve_forever()
