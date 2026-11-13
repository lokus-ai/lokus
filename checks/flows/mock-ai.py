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
        if self.path == "/seen":
            return self.json(200, SEEN)
        if self.path.startswith("/v1/models") or self.path == "/models":
            return self.json(200, {"data": [{"id": "mock-model"}]})
        self.json(405, {})

    def do_DELETE(self):
        self.json(200, {})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))) or b"{}")
        if self.path == "/mcp":
            if "id" not in body:
                self.send_response(202)
                self.end_headers()
                return
            return self.json(200, {"jsonrpc": "2.0", "id": body["id"], "result": mcp_reply(body)})
        SEEN.append({"path": self.path, "key": self.headers.get("x-api-key") or self.headers.get("authorization"), "body": body})
        if self.headers.get("x-api-key") == "wrong":
            return self.json(401, {"error": {"type": "authentication_error", "message": "invalid x-api-key"}})
        step = script(body["messages"])
        if self.path == "/v1/messages":
            return sse(self, anthropic_events(step))
        if self.path == "/chat/completions":
            return sse(self, openai_events(step))
        self.json(404, {})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8798), Handler).serve_forever()
