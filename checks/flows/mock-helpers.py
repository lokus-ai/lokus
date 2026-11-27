#!/usr/bin/env python3
"""Stand-ins for checks/flows/helpers.sh: a model provider, a search service and a tool server.

    mock-helpers.py vault DIR     write 30 made-up customers into DIR, and DIR/expected.json
    mock-helpers.py serve PORT DIR

The "model" (Anthropic Messages stream) is a script, not a model: it decides what to do from
the question and from what the tools returned, and builds every answer out of tool results it
was actually sent, so a wrong or missing result shows in the answer. It shows that Lokus's
side works; it says nothing about how a real model chooses.
  POST /v1/messages          the model; each call takes PACE["model"] seconds
  POST /web/search, /scrape  the search service, in Context.dev's shapes
  POST /mcp                  a tool server with one slow read tool, open_ask
  POST /pace {"helper": 3}   slow the helpers down, to look at them working
  POST /pace {"crowded": 4}  answer the next four model requests "too many requests"
  GET  /seen                 every model request: who asked, how big, which tools it called
"""
import json
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

NAMES = """Acme Robotics|Birch Dental|Cobalt Freight|Dune Analytics|Ember Foods|Fjord Travel|Garnet Legal|Harbor Clinics
Indigo Schools|Juniper Homes|Kestrel Air|Lumen Energy|Marlow Books|Nimbus Hosting|Onyx Security|Pioneer Farms|Quartz Bank
Redwood Tools|Sable Motors|Tidal Pools|Umber Coffee|Vesper Hotels|Willow Care|Xenon Labs|Yarrow Tea|Zenith Labs|Tundra Gear
Novel Paints|Glacier Water|Basalt Mining""".replace("\n", "|").split("|")
ASKS = ["SSO for the whole team", "a CSV export of invoices", "a second workspace", "an audit log", "a discount on renewal", "faster search on mobile"]
MONTHS = ["January", "March", "May", "July", "September", "November"]
SLICES = [("A", "F"), ("G", "M"), ("N", "S"), ("T", "Z")]


def customers():
    out = []
    for i, name in enumerate(sorted(NAMES)):
        missed = i % 4 == 1
        out.append({
            "name": name, "path": f"customers/{name}.md",
            "last_contact": f"2026-11-{1 + (i * 7) % 24:02d}",
            "open_ask": ASKS[i % len(ASKS)], "renewal": f"{MONTHS[i % len(MONTHS)]} 2027",
            "promised": f"2026-11-{2 + i % 15:02d}", "what": f"send {ASKS[(i + 2) % len(ASKS)]} details", "missed": missed,
        })
    return out


def write_vault(root):
    root = Path(root)
    (root / "customers").mkdir(parents=True, exist_ok=True)
    for c in customers():
        history = "\n".join(f"- 2026-{1 + n % 10:02d}-{3 + n:02d}: call about {ASKS[n % len(ASKS)]}; nothing decided, they will come back to it." for n in range(14))
        (root / c["path"]).write_text(
            f"# {c['name']}\n\nLast contact: {c['last_contact']}\nRenewal: {c['renewal']}\n"
            f"Follow-up promised: {c['promised']} ({c['what']})\nFollow-up done: {'no' if c['missed'] else 'yes'}\n\n## History\n\n{history}\n")
    (root / "Launch.md").write_text("# Launch\n\nThe launch is on 1 March 2027. Sam owns it.\n")
    (root / "Team.md").write_text("# Team\n\nSupport is run by Priya. Billing questions go to Omar.\n")
    (root / "expected.json").write_text(json.dumps(customers(), indent=1))


DATA = {}
PACE = {"model": 0.4, "helper": 0.4, "tool": 0.4}
SEEN = []
PAGE = "# Northwind Notes pricing\n\nNorthwind Notes Team costs 14 dollars per person per month from 1 February 2027. The free plan stays free.\n"


def said(message):
    """A message's plain words, or None when it carries tool results."""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if any(b.get("type") == "tool_result" for b in content):
        return None
    return "\n".join(b.get("text", "") for b in content if b.get("type") == "text")


class Talk:
    def __init__(self, body):
        self.tools = [t["name"] for t in body.get("tools", [])]
        self.messages = body["messages"]
        self.first = said(self.messages[0]) or ""
        self.helper = self.first.startswith("You are a helper")
        asked = [i for i, m in enumerate(self.messages) if m["role"] == "user" and said(m) is not None]
        self.at = asked[-1]
        self.question = said(self.messages[self.at])
        self.calls, self.results = [], {}
        for m in self.messages[(0 if self.helper else self.at):]:
            for b in m["content"] if isinstance(m["content"], list) else []:
                if b.get("type") == "tool_use":
                    self.calls.append(b)
                if b.get("type") == "tool_result":
                    text = b["content"] if isinstance(b["content"], str) else "\n".join(x.get("text", "") for x in b["content"])
                    self.results[b["tool_use_id"]] = text

    def tool(self, ending):
        return next((t for t in self.tools if t.endswith(ending)), ending)

    def did(self, name, **match):
        return [c for c in self.calls if c["name"].endswith(name) and all(c["input"].get(k) == v for k, v in match.items())]

    def result(self, call):
        return self.results.get(call["id"], "")

    def field(self, label):
        found = re.search(rf"^{label}: (.*)$", self.first, re.M)
        return found.group(1) if found else ""


def in_slice(name, where):
    found = re.search(r"start with ([A-Z]) to ([A-Z])", where)
    return bool(found) and found.group(1) <= name[0] <= found.group(2)


def listed(talk):
    """The customers a list_folder result names."""
    return sorted(set(re.findall(r"customers/([^/\n]+?)\.md", "\n".join(talk.result(c) for c in talk.did("list_folder")))))


def read_of(talk, name):
    return "\n".join(talk.result(c) for c in talk.did("read_note", path=f"customers/{name}.md"))


def line_for(talk, name):
    note = read_of(talk, name)
    last = re.search(r"Last contact: (\S+)", note)
    ask = "\n".join(talk.result(c) for c in talk.did("open_ask", customer=name)).strip()
    return f"- {name}: last contact {last.group(1) if last else '?'}; open ask: {ask or '?'} (customers/{name}.md)"


def sweep(talk, names, at_once):
    """Read each customer's note and ask the tool server for its open ask, `at_once` per reply."""
    todo = [n for n in names if not talk.did("read_note", path=f"customers/{n}.md")][:at_once]
    return [c for n in todo for c in (("read_note", {"path": f"customers/{n}.md"}), (talk.tool("open_ask"), {"customer": n}))]


def helper(talk):
    goal, where, latest = talk.field("Goal"), talk.field("Where to look"), talk.question
    if latest != talk.first:  # asked again: answer from what was already read
        if "renewal" in latest.lower():
            names = [n for n in listed(talk) if in_slice(n, where)]
            return "\n".join(f"- {n}: renews {(re.search(r'Renewal: (.+)', read_of(talk, n)) or [0, '?'])[1]} (customers/{n}.md)" for n in names)
        return "Nothing more to add."
    if goal.startswith("Edit"):
        if not talk.did("edit_note"):
            return [("edit_note", {"path": "customers/Acme Robotics.md", "old_text": "Renewal: ", "new_text": "Owner: Sam\nRenewal: "})]
        return f"I could not make the edit. Lokus said: {talk.result(talk.did('edit_note')[0])}"
    if "do not support" in goal:
        paths = re.findall(r"research/[\w\-/ ]+\.md", where)
        if not talk.did("read_note"):
            return [("read_note", {"path": p}) for p in paths]
        report = talk.result(talk.did("read_note", path=paths[0])[0])
        findings = "\n".join(talk.result(c) for c in talk.did("read_note")[1:])
        bad = [n for n in re.findall(r"^- (.+?):", report, re.M) if f"- {n}:" not in findings]
        return "Unsupported claims:\n" + "\n".join(f"- {n}: no findings note says this; the findings do not list {n}." for n in bad) if bad else "Every claim is supported."
    if not talk.did("list_folder"):
        return [("list_folder", {"path": "customers"})]
    names = [n for n in listed(talk) if in_slice(n, where)]
    if "missed" in goal:
        if not talk.did("read_note"):
            return [("read_note", {"path": f"customers/{n}.md"}) for n in names]
        lines = []
        for n in names:
            note = read_of(talk, n)
            promised = re.search(r"Follow-up promised: (\S+) \((.+)\)", note)
            if "Follow-up done: no" in note and promised:
                lines.append(f"- {n}: promised to {promised.group(2)} by {promised.group(1)}; not done. Source: customers/{n}.md")
        if not talk.did("write_findings"):
            return [("write_findings", {"text": f"# Missed follow-ups, {where}\n\n" + "\n".join(lines) + f"\n\nRead: {len(names)} customer notes.\n"})]
        return f"{len(lines)} missed follow-ups among {len(names)} customers. " + talk.result(talk.did("write_findings")[0])
    more = sweep(talk, names, 1 if PACE["helper"] > 1 else 30)
    return more or "\n".join(line_for(talk, n) for n in names)


def research(talk):
    topic, folder = "Missed follow-ups, all customers", "research/missed-follow-ups"
    stage = lambda name, note=None: ("research_stage", {"topic": topic, "stage": name, **({"note": note} if note else {})})
    slices = [(f"customers-{a}-{b}".lower(), f"Customers {a}–{b}", f"customers/ notes whose names start with {a} to {b}") for a, b in SLICES]
    if not talk.did("research_stage", stage="plan"):
        plan = f"# Plan: {topic}\n\nQuestion: which customers were promised a follow-up that was not done?\n\nParts:\n" + "\n".join(f"- {name}: {where}" for _, name, where in slices) + "\n\nDone means: every customer note read, each missed follow-up listed with its source, a task for each.\n"
        return [stage("plan", f"{folder}/plan.md"), ("create_note", {"path": f"{folder}/plan.md", "text": plan})]
    if not talk.did("research_stage", stage="gather"):
        return [stage("gather"), ("delegate", {"tasks": [{
            "name": name, "goal": "List every customer with a missed follow-up: one that was promised and is not done.",
            "context": "Each customer note has the lines 'Follow-up promised: DATE (what)' and 'Follow-up done: yes or no'. Today is 2026-11-26.",
            "look_in": where, "return": "The count, and the path of your findings note.", "findings": f"{folder}/{part}.md"} for part, name, where in slices]})]
    found = [f"{folder}/{part}.md" for part, _, _ in slices]
    if not talk.did("read_note"):
        return [("read_note", {"path": p}) for p in found]
    claims = [l for c in talk.did("read_note") for l in talk.result(c).splitlines() if l.startswith("- ")]
    planted = "- Yarrow Tea: promised to send pricing by 2026-11-10; not done. Source: customers/Yarrow Tea.md"
    if not talk.did("research_stage", stage="check"):
        draft = f"# Report: {topic} (draft)\n\n{len(claims) + 1} customers were promised a follow-up that was not done.\n\n" + "\n".join(claims + [planted]) + "\n\nUncertain: nothing yet.\n"
        return [stage("check"), ("create_note", {"path": f"{folder}/report.md", "text": draft}), ("delegate", {"tasks": [{
            "name": "Check the report", "goal": "Find every claim in the draft report that the findings notes do not support.",
            "context": "The report must only say what a findings note says. A claim is a line starting with a customer's name.",
            "look_in": ", ".join([f"{folder}/report.md"] + found), "return": "The unsupported claims, one per line, or 'Every claim is supported.'"}]})]
    if not talk.did("research_stage", stage="report"):
        check = talk.result(talk.did("delegate")[-1])
        out = [stage("report", f"{folder}/report.md")]
        if "Yarrow Tea" in check:
            out.append(("edit_note", {"path": f"{folder}/report.md", "old_text": planted, "new_text": "Removed after the check: a missed follow-up for Yarrow Tea. No findings note supports it, and customers/Yarrow Tea.md says it was done."}))
            out.append(("edit_note", {"path": f"{folder}/report.md", "old_text": f"(draft)\n\n{len(claims) + 1} customers were", "new_text": f"\n\n{len(claims)} customers were"}))
        return out
    if not talk.did("research_stage", stage="changes"):
        tasks = []
        for line in claims:
            name, what, due = re.match(r"- (.+?): promised to (.+) by (\S+);", line).groups()
            tasks.append(("record_task", {"title": f"Follow up with {name}: {what}", "priority": "high", "text": f"Promised by {due} and not done. Source: customers/{name}.md, {folder}/report.md"}))
        return [stage("changes")] + tasks
    made = [talk.result(c) for c in talk.did("record_task")]
    return f"**{len(made)} customers have a missed follow-up; a task now exists for each.**\n\nReport: {folder}/report.md\n\nThe check removed one claim the sources did not support (Yarrow Tea).\n\n" + "\n".join(f"- {m}" for m in made)


def assistant(talk):
    q = talk.question.lower()
    if "/research" in q or "audit" in q:
        return research(talk)
    if "last contact and open ask" in q:
        if "delegate" in talk.tools and "yourself" not in q:
            if not talk.did("delegate"):
                broken = " [stand-in: fail]" if "break" in q else ""
                return [("delegate", {"tasks": [{
                    "name": f"Customers {a}–{b}", "goal": "For each customer give the last contact date and the open ask.",
                    "context": "The last contact is the 'Last contact:' line of the customer's note. The open ask comes from the open_ask tool, by customer name." + (broken if a == "T" else ""),
                    "look_in": f"customers/ notes whose names start with {a} to {b}",
                    "return": "One line per customer: '- Name: last contact DATE; open ask: ASK (note path)'."} for a, b in SLICES]})]
            result = talk.result(talk.did("delegate")[0])
            lines = [l for l in result.splitlines() if l.startswith("- ")]
            failed = re.findall(r"^(h\d+ .*(?:failed|stopped).*)$", result, re.M)
            return f"**{len(lines)} customers.**\n\n" + "\n".join(lines) + ("\n\nNot finished:\n" + "\n".join(failed) if failed else "")
        if not talk.did("list_folder"):
            return [("list_folder", {"path": "customers"})]
        return sweep(talk, listed(talk), 6) or f"**{len(listed(talk))} customers.**\n\n" + "\n".join(line_for(talk, n) for n in listed(talk))
    if "renewal" in q and "helper" in q:
        if not talk.did("helper_send"):
            return [("helper_send", {"id": "h1", "message": "For the same customers, give the renewal month of each. Do not read anything again."})]
        return talk.result(talk.did("helper_send")[0])
    if "helper" in q and "edit" in q:
        if not talk.did("delegate"):
            return [("delegate", {"tasks": [{"name": "Edit Acme owner", "goal": "Edit customers/Acme Robotics.md: add the line 'Owner: Sam'.", "context": "The person wants Sam as the owner of Acme Robotics.", "look_in": "customers/Acme Robotics.md", "return": "Whether the edit was made."}]})]
        return talk.result(talk.did("delegate")[0])
    if "web" in q or "northwind" in q:
        if not talk.did("web_search"):
            return [("web_search", {"query": "Northwind Notes Team price 2027"})]
        found = talk.result(talk.did("web_search")[0])
        link = re.search(r"https?://\S+?(?=[\s\"')\]])", found + " ")
        if not link:
            return f"I could not look on the web: {found.strip()}"
        if not talk.did("web_read"):
            return [("web_read", {"url": link.group(0)})]
        page = talk.result(talk.did("web_read")[0])
        price = re.search(r"[^.\n]*\d+ dollars[^.\n]*\.", page)
        return f"**{price.group(0).strip() if price else page.strip()[:200]}**\n\nSource: [{link.group(0)}]({link.group(0)})"
    # An everyday question: look it up, read the note, answer from it.
    named = next((f"customers/{n}.md" for n in DATA if n.lower() in q), next((f"{n}.md" for n in ("Launch", "Team") if n.lower() in q), None))
    if not named:
        return "I found nothing about that in your notes."
    if not talk.did("read_note"):
        return [("read_note", {"path": named})]
    note = talk.result(talk.did("read_note")[0])
    wanted = next((l for l in note.splitlines() if ":" in l and l.split(":")[0].lower() in q), None)
    return f"{wanted or note.strip()[:300]} ({named})"


def events(step, tokens):
    ev = lambda kind, data: f"event: {kind}\ndata: {json.dumps({'type': kind, **data})}\n\n"
    out = [ev("message_start", {"message": {"id": "msg", "role": "assistant", "content": [], "usage": {"input_tokens": tokens}}})]
    if isinstance(step, str):
        out += [ev("content_block_start", {"index": 0, "content_block": {"type": "text", "text": ""}}), ev("content_block_delta", {"index": 0, "delta": {"type": "text_delta", "text": step}}), ev("content_block_stop", {"index": 0})]
    else:
        for i, (name, args) in enumerate(step):
            out += [ev("content_block_start", {"index": i, "content_block": {"type": "tool_use", "id": f"toolu_{time.time_ns()}_{i}", "name": name, "input": {}}}), ev("content_block_delta", {"index": i, "delta": {"type": "input_json_delta", "partial_json": json.dumps(args)}}), ev("content_block_stop", {"index": i})]
    written = len(json.dumps(step)) // 4
    return out + [ev("message_delta", {"delta": {"stop_reason": "end_turn" if isinstance(step, str) else "tool_use"}, "usage": {"output_tokens": written}}), ev("message_stop", {})]


def mcp(message):
    method = message.get("method")
    if method == "initialize":
        return {"protocolVersion": message["params"].get("protocolVersion", "2025-06-18"), "capabilities": {"tools": {}}, "serverInfo": {"name": "desk", "version": "1"}}
    if method == "tools/list":
        schema = {"type": "object", "properties": {"customer": {"type": "string"}}, "required": ["customer"]}
        return {"tools": [{"name": "open_ask", "description": "What a customer is still waiting on, by customer name.", "inputSchema": schema, "annotations": {"readOnlyHint": True}}]}
    if method == "tools/call":
        time.sleep(PACE["tool"])
        name = message["params"].get("arguments", {}).get("customer", "")
        return {"content": [{"type": "text", "text": DATA.get(name, {}).get("open_ask", "no such customer")}]}
    return {}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

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
        if self.path.startswith("/pages/"):
            raw = PAGE.encode()
            self.send_response(200)
            self.send_header("content-type", "text/plain; charset=utf-8")
            self.send_header("content-length", str(len(raw)))
            self.end_headers()
            return self.wfile.write(raw)
        self.json(200, {"data": [{"id": "mock-model"}]})

    def do_DELETE(self):
        self.json(200, {})

    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("content-length", 0)))
        body = json.loads(raw or b"{}")
        base = f"http://{self.headers.get('host')}"
        if self.path == "/pace":
            PACE.update(body)
            return self.json(200, PACE)
        if self.path == "/web/search":
            SEEN.append({"who": "search", "key": self.headers.get("authorization"), "query": body.get("query")})
            time.sleep(PACE["tool"])
            return self.json(200, {"results": [{"title": "Northwind Notes pricing", "url": f"{base}/pages/northwind-pricing", "description": "Plans and prices for Northwind Notes from February 2027."}]})
        if self.path == "/web/scrape":
            time.sleep(PACE["tool"])
            return self.json(200, {"url": body.get("url"), "markdown": {"data": PAGE}})
        if self.path == "/mcp":
            if "id" not in body:
                self.send_response(202)
                self.send_header("content-length", "0")
                return self.end_headers()
            return self.json(200, {"jsonrpc": "2.0", "id": body["id"], "result": mcp(body)})
        if PACE.get("crowded", 0) > 0:
            PACE["crowded"] -= 1
            SEEN.append({"who": "crowded", "at": time.time()})
            return self.json(429, {"type": "error", "error": {"type": "rate_limit_error", "message": "too many requests"}})
        talk = Talk(body)
        who, came = "helper" if talk.helper else "assistant", time.time()
        time.sleep(PACE[who if who == "helper" else "model"])
        if "[stand-in: fail]" in talk.first:
            return self.json(400, {"type": "error", "error": {"type": "invalid_request_error", "message": "the stand-in was told to fail this helper"}})
        step = helper(talk) if talk.helper else assistant(talk)
        SEEN.append({"who": who, "name": talk.field("Where to look") if talk.helper else "", "chars": len(raw), "calls": [] if isinstance(step, str) else [name for name, _ in step], "came": came, "at": time.time()})
        out = "".join(events(step, len(raw) // 4)).encode()
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("content-length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)


if __name__ == "__main__":
    if sys.argv[1] == "vault":
        write_vault(sys.argv[2])
    else:
        DATA.update({c["name"]: c for c in json.loads((Path(sys.argv[3]) / "expected.json").read_text())})
        ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), Handler).serve_forever()
