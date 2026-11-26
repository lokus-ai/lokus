#!/usr/bin/env python3
"""A stand-in for the account service (Supabase Auth), for checks/flows/team-stays.py.

Usage: mock-auth.py <port> <seconds a sign-in lasts>. Any password signs a made-up address in.
Sign-ins are short-lived HS256 tokens the local relay checks (SUPABASE_JWT_SECRET below); the
renewal token changes at every use and using an old one again revokes the sign-in, as the real
service does. /_ctl?offline=1|0 makes it unreachable; /_ctl?revoke=1 ends every sign-in; /_ctl?ttl=N changes how
long the next ones last.
"""
import base64, hashlib, hmac, json, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
SECRET = b"local-stand-in-secret"
USERS = {f"{n}@made-up.test": f"u-{n}" for n in ("ana", "ben", "cy", "dee")}
state = {"ttl": int(sys.argv[2]) if len(sys.argv) > 2 else 150, "offline": False, "family": {}, "used": {}, "revoked": set()}
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def jwt(sub, email):
    exp = int(time.time()) + state["ttl"]
    body = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()) + "." + b64(json.dumps({"sub": sub, "email": email, "aud": "authenticated", "role": "authenticated", "exp": exp, "iat": int(time.time())}).encode())
    return body + "." + b64(hmac.new(SECRET, body.encode(), hashlib.sha256).digest()), exp
def session(email, family):
    sub = USERS[email]; access, exp = jwt(sub, email); refresh = uuid.uuid4().hex[:12]
    state["family"][refresh] = (email, family)
    user = {"id": sub, "aud": "authenticated", "role": "authenticated", "email": email, "app_metadata": {"provider": "email"}, "user_metadata": {}, "created_at": "2026-01-01T00:00:00Z"}
    return {"access_token": access, "token_type": "bearer", "expires_in": state["ttl"], "expires_at": exp, "refresh_token": refresh, "user": user}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def out(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("access-control-allow-origin", "*"); self.send_header("access-control-allow-headers", "*"); self.send_header("access-control-allow-methods", "*"); self.send_header("content-length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def say(self, text): print(time.strftime("%H:%M:%S"), text, flush=True)
    def do_OPTIONS(self): self.out(200, {})
    def do_GET(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path == "/_ctl":
            if "ttl" in q: state["ttl"] = int(q["ttl"][0])
            if "offline" in q: state["offline"] = q["offline"][0] == "1"
            if "revoke" in q: state["revoked"] = set(f for _, f in state["family"].values())
            self.say(f"ctl offline={state['offline']} revoked={len(state['revoked'])}"); return self.out(200, {"ok": True})
        if state["offline"]: self.close_connection = True; self.connection.close(); return
        self.out(200, {})
    def do_PUT(self): self.out(200, {})
    def do_POST(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        body = json.loads(self.rfile.read(int(self.headers.get("content-length", 0)) or 0) or b"{}")
        if state["offline"]:
            self.say("refused to answer (offline)"); self.connection.close(); return
        if u.path.endswith("/logout"): return self.out(204, {})
        kind = q.get("grant_type", [""])[0]
        if kind == "password":
            if body.get("email") not in USERS: return self.out(400, {"error_code": "invalid_credentials", "msg": "Invalid login credentials"})
            self.say(f"signed in {body['email']}"); return self.out(200, session(body["email"], uuid.uuid4().hex[:6]))
        if kind == "refresh_token":
            r = body.get("refresh_token"); known = state["family"].get(r)
            if not known or known[1] in state["revoked"]:
                self.say(f"refresh {r}: REFUSED (revoked or unknown)"); return self.out(400, {"error_code": "refresh_token_not_found", "msg": "Invalid Refresh Token: Refresh Token Not Found"})
            used = state["used"].get(r)
            if used and time.time() - used > 10:
                state["revoked"].add(known[1]); self.say(f"refresh {r}: REUSED after {int(time.time()-used)}s, whole sign-in revoked"); return self.out(400, {"error_code": "refresh_token_already_used", "msg": "Invalid Refresh Token: Already Used"})
            state["used"].setdefault(r, time.time()); s = session(*known); self.say(f"refresh {r} -> {s['refresh_token']}"); return self.out(200, s)
        self.out(404, {})
ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
