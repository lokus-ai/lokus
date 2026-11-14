#!/usr/bin/env python3
"""A made-up product's admin API, to show Lokus reading and acting in a team's own system.

    python3 deploy/demo/admin.py          # listens on http://127.0.0.1:8899

It is the back office of Northstar, the invented company deploy/demo/seed.py writes about. In
Lokus, add it under Settings, Connections, "Your own product's API":

    Name   northstar
    URL    http://127.0.0.1:8899
    Key    northstar-demo-key
    Start  Start with GET /v1/admin. It lists every route.

The story it holds: Kestrel Bank's exports fail because they time out, a fix shipped behind a
switch that is off for Kestrel, and turning it on and retrying makes the export succeed.
Nothing is kept between runs.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

KEY = "northstar-demo-key"
FLAGS = {"kestrel-bank": {"streaming_export": False}, "orbit-robotics": {"streaming_export": True}}
EXPORTS = [
    {"id": "exp_9041", "workspace": "kestrel-bank", "kind": "appointments.csv", "rows": 58214, "status": "failed", "error": "timed out after 60s", "started": "4 days ago"},
    {"id": "exp_9077", "workspace": "kestrel-bank", "kind": "appointments.csv", "rows": 58214, "status": "failed", "error": "timed out after 60s", "started": "3 days ago"},
    {"id": "exp_9102", "workspace": "kestrel-bank", "kind": "appointments.csv", "rows": 58390, "status": "failed", "error": "timed out after 60s", "started": "yesterday"},
    {"id": "exp_9088", "workspace": "orbit-robotics", "kind": "appointments.csv", "rows": 91775, "status": "succeeded", "seconds": 14, "started": "2 days ago"},
]
ROUTES = [
    {"method": "GET", "path": "/v1/admin", "does": "This list."},
    {"method": "GET", "path": "/v1/admin/workspaces", "does": "Every customer workspace: plan, seats, appointments, feature switches."},
    {"method": "GET", "path": "/v1/admin/exports?workspace=&status=", "does": "Export jobs, newest first. status is failed or succeeded."},
    {"method": "POST", "path": "/v1/admin/exports/{id}/retry", "does": "Run a failed export again."},
    {"method": "GET", "path": "/v1/admin/deploys", "does": "What shipped lately."},
    {"method": "POST", "path": "/v1/admin/flags", "does": "Turn a feature switch on or off for one workspace. Body: {workspace, flag, on}."},
    {"method": "GET", "path": "/v1/admin/reminders/queue", "does": "How late text reminders are going out, by hour."},
]
WORKSPACES = [
    {"id": "kestrel-bank", "name": "Kestrel Bank", "plan": "Scale", "seats": 120, "appointments": 58390},
    {"id": "orbit-robotics", "name": "Orbit Robotics", "plan": "Scale", "seats": 210, "appointments": 91775},
    {"id": "brightline-clinics", "name": "Brightline Clinics", "plan": "Team", "seats": 45, "appointments": 12040},
    {"id": "harbor-vet", "name": "Harbor Vet Group", "plan": "Team", "seats": 36, "appointments": 9310},
]
DEPLOYS = [
    {"when": "3 days ago", "what": "Streaming export for very large workspaces. Behind the switch streaming_export; on for Orbit Robotics only while it is tested."},
    {"when": "5 days ago", "what": "Calendar sync keeps recurring events."},
    {"when": "9 days ago", "what": "Shift swaps."},
]


class Admin(BaseHTTPRequestHandler):
    def answer(self, status, body):
        data = json.dumps(body, indent=1).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def allowed(self):
        if self.headers.get("authorization") == f"Bearer {KEY}":
            return True
        self.answer(401, {"error": "give the staff key as a Bearer token"})
        return False

    def do_GET(self):
        if not self.allowed():
            return
        path, _, query = self.path.partition("?")
        asked = dict(part.split("=", 1) for part in query.split("&") if "=" in part)
        if path == "/v1/admin":
            return self.answer(200, {"product": "Northstar admin", "routes": ROUTES})
        if path == "/v1/admin/workspaces":
            return self.answer(200, [{**w, "flags": FLAGS.get(w["id"], {"streaming_export": False})} for w in WORKSPACES])
        if path == "/v1/admin/exports":
            jobs = [j for j in EXPORTS if asked.get("workspace", j["workspace"]) == j["workspace"] and asked.get("status", j["status"]) == j["status"]]
            return self.answer(200, list(reversed(jobs)))
        if path == "/v1/admin/deploys":
            return self.answer(200, DEPLOYS)
        if path == "/v1/admin/reminders/queue":
            return self.answer(200, {"note": "Minutes late, by the hour reminders were due.", "07:00": 1, "08:00": 62, "09:00": 9, "10:00": 0, "cause": "One worker handles the 08:00 batch; it has grown 4x since September."})
        self.answer(404, {"error": "no such route; GET /v1/admin lists them"})

    def do_POST(self):
        if not self.allowed():
            return
        length = int(self.headers.get("content-length") or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            return self.answer(400, {"error": "the body is not JSON"})
        if self.path == "/v1/admin/flags":
            workspace, flag = body.get("workspace"), body.get("flag")
            if workspace not in {w["id"] for w in WORKSPACES} or not flag:
                return self.answer(400, {"error": "give workspace (an id from /v1/admin/workspaces), flag and on"})
            FLAGS.setdefault(workspace, {})[flag] = bool(body.get("on", True))
            return self.answer(200, {"workspace": workspace, "flags": FLAGS[workspace]})
        if self.path.startswith("/v1/admin/exports/") and self.path.endswith("/retry"):
            job = next((j for j in EXPORTS if j["id"] == self.path.split("/")[4]), None)
            if not job:
                return self.answer(404, {"error": "no such export"})
            # The same job fails the same way until the fix is switched on for that workspace.
            if FLAGS.get(job["workspace"], {}).get("streaming_export"):
                fresh = {**job, "id": f"exp_{9200 + len(EXPORTS)}", "status": "succeeded", "seconds": 11, "started": "just now"}
                fresh.pop("error", None)
            else:
                fresh = {**job, "id": f"exp_{9200 + len(EXPORTS)}", "started": "just now"}
            EXPORTS.append(fresh)
            return self.answer(200, fresh)
        self.answer(404, {"error": "no such route; GET /v1/admin lists them"})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("Northstar admin on http://127.0.0.1:8899  (key: northstar-demo-key)")
    ThreadingHTTPServer(("127.0.0.1", 8899), Admin).serve_forever()
