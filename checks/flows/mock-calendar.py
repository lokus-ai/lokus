#!/usr/bin/env python3
"""A stand-in for Google Calendar and Microsoft Graph, for checks/flows/calendar.sh and local runs.

Usage: mock-calendar.py <port> [state file] [request log]
One made-up directory of people; each has calendars with one provider. Both providers' sign-in
(authorize + token, PKCE checked), calendar list, events (incremental sync with a token, create,
change, delete, reply), free/busy and meeting links are answered under /google and /microsoft in
the shapes the real services document. An event with guests appears on each guest's calendar, as
an invitation does. Every request is written to the log as one JSON line; `mail` on a line is who
would have been emailed. /_ctl?offline=1|0 makes it unreachable; /_ctl?log=1 returns the log;
/_ctl?reset=1 forgets everything; /_ctl?delay=40 makes the next change answer that many seconds late
(the change itself is made at once, as a slow provider does); /_ctl?fail=500 (or 429, with &after=3
for Retry-After) refuses the next change that way without making it (&made=1: makes it, then
answers that way); /_ctl?drop=1 makes the next
change and then closes the connection with no answer. It proves the app's side only: it is not the real services.
"""
import base64, hashlib, json, os, re, sys, threading, time, uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, urlencode, unquote
from zoneinfo import ZoneInfo

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
STATE = sys.argv[2] if len(sys.argv) > 2 else ""
LOG = sys.argv[3] if len(sys.argv) > 3 else ""
UTC = timezone.utc
lock = threading.RLock()
AS_TEXT = False
PEOPLE = {
    "ana@acme.test": ("Ana Ruiz", "google"), "ben@acme.test": ("Ben Okafor", "google"),
    "cara@birch.test": ("Cara Lind", "microsoft"), "dev@birch.test": ("Dev Patel", "microsoft"),
    # Two people with long names and addresses, for checking that the calendar's screen cuts text cleanly.
    "alexandria.montgomery-fitzgerald@international-consulting.test": ("Alexandria Montgomery-Fitzgerald", "google"),
    "bartholomew.vandersteen@northern-lights-engineering.test": ("Bartholomew van der Steen-Achterberg", "microsoft"),
}
COLORS = ["#4f7cff", "#e2674a", "#3aa675", "#b266d9"]

def iso(d): return d.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
def parse(s):
    s = s.strip()
    if len(s) == 10: s += "T00:00:00Z"
    s = re.sub(r"\.(\d{6})\d+", r".\1", s)
    d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return d if d.tzinfo else d.replace(tzinfo=UTC)
def zone(name):
    try: return ZoneInfo(name or "UTC")
    except Exception: return UTC

def fresh():
    s = {"v": 1, "n": 0, "cals": {}, "events": {}, "tokens": {}, "refresh": {}, "codes": {}, "offline": False}
    for i, (email, (name, provider)) in enumerate(PEOPLE.items()):
        s["cals"][email] = [
            {"id": email if provider == "google" else f"cal-{email.split('@')[0]}", "name": name if provider == "google" or len(name) > 20 else "Calendar", "color": COLORS[i % 4], "primary": True},
            {"id": f"side-{email.split('@')[0]}", "name": "Side projects" if len(name) < 20 else f"Side projects and community work of {name}", "color": COLORS[(i + 2) % 4], "primary": False},
        ]
    day = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    def seed(owner, title, d, h, mins, guests=(), rrule=None, cal=0):
        e = {"id": new_id(s), "cal": s["cals"][owner][cal]["id"], "owner": owner, "title": title, "start": iso(day + timedelta(days=d, hours=h)),
             "end": iso(day + timedelta(days=d, hours=h, minutes=mins)), "allDay": False, "zone": "UTC", "location": "", "description": "",
             "attendees": [{"email": g, "name": PEOPLE.get(g, ("",))[0], "optional": False, "response": "needsAction"} for g in guests],
             "meet": None, "rrule": rrule, "master": None, "original": None, "cancelled": False, "v": s["v"], "gone": []}
        if guests: e["attendees"].insert(0, {"email": owner, "name": PEOPLE[owner][0], "optional": False, "response": "accepted"})
        s["events"][e["id"]] = e
    seed("ana@acme.test", "Design review", 0, 17, 60, ["ben@acme.test"])
    seed("ana@acme.test", "Standup", -3, 16, 15, rrule="RRULE:FREQ=DAILY;COUNT=14")
    seed("ana@acme.test", "Lunch with Sam", 1, 20, 60)
    seed("ana@acme.test", "Side: write post", 2, 18, 90, cal=1)
    seed("ben@acme.test", "Customer call: Birch", 0, 19, 45, ["ana@acme.test", "cara@birch.test"])
    seed("ben@acme.test", "Dentist", 1, 17, 60)
    seed("cara@birch.test", "Quarterly planning", 1, 16, 120, ["dev@birch.test"])
    seed("cara@birch.test", "1:1 Dev", 2, 17, 30, ["dev@birch.test"])
    seed("dev@birch.test", "Focus block", 0, 16, 120)
    return s
def new_id(s): s["n"] += 1; return f"ev{s['n']:04d}{uuid.uuid4().hex[:6]}"

def load():
    if STATE and os.path.exists(STATE):
        with open(STATE) as f: return json.load(f)
    return fresh()
S = load()
def save():
    if STATE:
        with open(STATE + ".new", "w") as f: json.dump(S, f)
        os.replace(STATE + ".new", STATE)
def bump(e): S["v"] += 1; e["v"] = S["v"]

def record(entry):
    line = json.dumps(entry)
    print(line, flush=True)
    if LOG:
        with open(LOG, "a") as f: f.write(line + "\n")

# ---- recurrence -------------------------------------------------------------------------------
DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
def rule(text):
    return dict(p.split("=", 1) for p in text.split(":", 1)[-1].split(";") if "=" in p)
def occurrences(e, lo, hi):
    """Start times of a repeating event between lo and hi, in its own time zone's wall time."""
    r = rule(e["rrule"]); tz = zone(e["zone"]); first = parse(e["start"]).astimezone(tz)
    every = int(r.get("INTERVAL", 1)); count = int(r["COUNT"]) if "COUNT" in r else None
    until = parse(re.sub(r"(\d{4})(\d\d)(\d\d)T?(\d\d)?(\d\d)?(\d\d)?Z?", lambda m: f"{m[1]}-{m[2]}-{m[3]}T{m[4] or '23'}:{m[5] or '59'}:{m[6] or '59'}Z", r["UNTIL"])) if "UNTIL" in r else None
    days = [DAYS.index(d[-2:]) for d in r["BYDAY"].split(",")] if r.get("FREQ") == "WEEKLY" and "BYDAY" in r else None
    out, made, step = [], 0, 0
    while made < (count or 10**6) and step < 3000:
        if r.get("FREQ") == "DAILY": cands = [first + timedelta(days=step * every)]
        elif r.get("FREQ") == "WEEKLY":
            week = first - timedelta(days=first.weekday()) + timedelta(weeks=step * every)
            cands = [week + timedelta(days=d) for d in (days or [first.weekday()])]
        elif r.get("FREQ") == "MONTHLY":
            m = first.month - 1 + step * every
            try: cands = [first.replace(year=first.year + m // 12, month=m % 12 + 1)]
            except ValueError: cands = []
        else:
            try: cands = [first.replace(year=first.year + step * every)]
            except ValueError: cands = []
        step += 1
        for c in cands:
            c = c.replace(tzinfo=None).replace(tzinfo=tz).astimezone(UTC)
            if c < parse(e["start"]) or (count and made >= count): continue
            if until and c > until: return out
            made += 1
            if c > hi: return out
            if c >= lo - (parse(e["end"]) - parse(e["start"])): out.append(c)
    return out
def stamp(d): return d.strftime("%Y%m%dT%H%M%SZ")
def expand(e, lo, hi):
    """A repeating event as its separate occurrences, with the ones changed on their own."""
    length = parse(e["end"]) - parse(e["start"]); out = []
    changed = {x["original"]: x for x in S["events"].values() if x["master"] == e["id"]}
    for at in occurrences(e, lo, hi):
        one = changed.get(iso(at))
        if one: out.append(one); continue
        out.append({**e, "id": f"{e['id']}_{stamp(at)}", "start": iso(at), "end": iso(at + length), "master": e["id"], "original": iso(at), "rrule": None, "virtual": True})
    return out
def find(event_id):
    """The stored event for an id, making the one-off copy of an occurrence when it is first touched."""
    event_id = unquote(event_id)
    if event_id in S["events"]: return S["events"][event_id]
    m = re.match(r"(.+)_(\d{8}T\d{6}Z)$", event_id)
    if not m or m[1] not in S["events"]: return None
    master = S["events"][m[1]]; at = datetime.strptime(m[2], "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
    length = parse(master["end"]) - parse(master["start"])
    one = {**master, "id": event_id, "start": iso(at), "end": iso(at + length), "master": master["id"], "original": iso(at), "rrule": None, "gone": [], "attendees": [dict(a) for a in master["attendees"]]}
    S["events"][event_id] = one
    return one

# ---- who sees what ----------------------------------------------------------------------------
def primary(email): return next(c["id"] for c in S["cals"][email] if c["primary"])
def shows_in(e, email, cal):
    if e["owner"] == email: return e["cal"] == cal
    return cal == primary(email) and any(a["email"] == email for a in e["attendees"])
def listing(email, cal, lo, hi, since):
    out = []
    for e in list(S["events"].values()):
        if e["master"] or not shows_in(e, email, cal): continue
        if e["rrule"]:
            for old, v in e.get("gone", []):
                if since is not None and v > since: out.append({**e, "id": old, "cancelled": True, "rrule": None, "master": e["id"]})
            if e["cancelled"]:
                if since is not None and e["v"] > since:
                    out += [{**x, "cancelled": True} for x in expand({**e, "cancelled": False}, lo, hi)]
                continue
            for x in expand(e, lo, hi):
                if since is None and x["cancelled"]: continue
                if since is None or max(x["v"], e["v"]) > since: out.append(x)
        elif since is None:
            if not e["cancelled"] and parse(e["end"]) >= lo and parse(e["start"]) <= hi: out.append(e)
        elif e["v"] > since: out.append(e)
    return out
def busy(email, lo, hi):
    out = []
    for e in list(S["events"].values()):
        if e["master"] or e["cancelled"]: continue
        mine = e["owner"] == email or any(a["email"] == email and a["response"] != "declined" for a in e["attendees"])
        if not mine: continue
        for x in (expand(e, lo, hi) if e["rrule"] else [e]):
            if not x["cancelled"] and parse(x["end"]) > lo and parse(x["start"]) < hi: out.append((x["start"], x["end"]))
    return sorted(out)
def mailed(e, me, only=None):
    return sorted(a["email"] for a in e["attendees"] if a["email"] != me and (only is None or a["email"] in only))

def uid(e): return (e["master"] or e["id"]).split("_")[0] + "@stand-in.test"

# ---- Google shapes ----------------------------------------------------------------------------
def g_out(e, me):
    if e["cancelled"]: return {"id": e["id"], "status": "cancelled", **({"recurringEventId": e["master"]} if e["master"] else {})}
    when = (lambda t: {"date": t[:10]}) if e["allDay"] else (lambda t: {"dateTime": t, "timeZone": e["zone"]})
    o = {"kind": "calendar#event", "id": e["id"], "status": "confirmed", "summary": e["title"], "description": e["description"], "location": e["location"],
         "iCalUID": uid(e), "start": when(e["start"]), "end": when(e["end"]), "organizer": {"email": e["owner"], "self": e["owner"] == me},
         "updated": iso(datetime.now(UTC)), "htmlLink": f"http://127.0.0.1:{PORT}/google/event?eid={e['id']}"}
    if e["attendees"]:
        o["attendees"] = [{"email": a["email"], "displayName": a["name"], "optional": a["optional"], "responseStatus": a["response"], **({"self": True} if a["email"] == me else {}), **({"organizer": True} if a["email"] == e["owner"] else {})} for a in e["attendees"]]
    if e["meet"]:
        o["hangoutLink"] = e["meet"]; o["conferenceData"] = {"conferenceSolution": {"name": "Google Meet"}, "entryPoints": [{"entryPointType": "video", "uri": e["meet"]}]}
    if e["rrule"]: o["recurrence"] = [e["rrule"]]
    if e["master"]:
        o["recurringEventId"] = e["master"]; o["originalStartTime"] = {"dateTime": e["original"], "timeZone": e["zone"]}
    return o
def g_when(v):
    if "date" in v: return v["date"] + "T00:00:00Z", True, None
    d = parse(v["dateTime"]) if re.search(r"(Z|[+-]\d\d:\d\d)$", v["dateTime"]) else datetime.fromisoformat(v["dateTime"]).replace(tzinfo=zone(v.get("timeZone")))
    return iso(d), False, v.get("timeZone")
def g_in(e, body, me):
    if "summary" in body: e["title"] = body["summary"] or ""
    if "description" in body: e["description"] = body["description"] or ""
    if "location" in body: e["location"] = body["location"] or ""
    for key in ("start", "end"):
        if key in body:
            e[key], e["allDay"], z = g_when(body[key])
            if z: e["zone"] = z
    if "attendees" in body:
        old = {a["email"]: a for a in e["attendees"]}
        e["attendees"] = [{"email": a["email"], "name": a.get("displayName") or old.get(a["email"], {}).get("name") or PEOPLE.get(a["email"], ("",))[0], "optional": bool(a.get("optional")),
                           "response": a.get("responseStatus") or "needsAction"} for a in body["attendees"] or []]  # the list replaces the old one, answers and all
        if e["attendees"] and not any(a["email"] == e["owner"] for a in e["attendees"]):
            e["attendees"].insert(0, {"email": e["owner"], "name": PEOPLE[e["owner"]][0], "optional": False, "response": "accepted"})
    if "recurrence" in body: e["rrule"] = (body["recurrence"] or [None])[0]
    if "conferenceData" in body:
        e["meet"] = f"https://meet.google.com/{uuid.uuid4().hex[:3]}-{uuid.uuid4().hex[:4]}-{uuid.uuid4().hex[:3]}" if (body["conferenceData"] or {}).get("createRequest") else (e["meet"] if body["conferenceData"] else None)

# ---- Microsoft shapes -------------------------------------------------------------------------
M_REPLY = {"needsAction": "none", "accepted": "accepted", "declined": "declined", "tentative": "tentativelyAccepted"}
def m_time(t): return {"dateTime": parse(t).strftime("%Y-%m-%dT%H:%M:%S.0000000"), "timeZone": "UTC"}
def m_recur(e):
    r = rule(e["rrule"]); kind = {"DAILY": "daily", "WEEKLY": "weekly", "MONTHLY": "absoluteMonthly", "YEARLY": "absoluteYearly"}[r["FREQ"]]
    names = dict(zip(DAYS, ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]))
    pattern = {"type": kind, "interval": int(r.get("INTERVAL", 1))}
    if "BYDAY" in r: pattern["daysOfWeek"] = [names[d[-2:]] for d in r["BYDAY"].split(",")]
    rng = {"type": "noEnd", "startDate": e["start"][:10]}
    if "COUNT" in r: rng.update(type="numbered", numberOfOccurrences=int(r["COUNT"]))
    if "UNTIL" in r: rng.update(type="endDate", endDate=f"{r['UNTIL'][:4]}-{r['UNTIL'][4:6]}-{r['UNTIL'][6:8]}")
    return {"pattern": pattern, "range": rng}
def m_out(e, me):
    if e["cancelled"]: return {"id": e["id"], "@removed": {"reason": "deleted"}}
    mine = next((a["response"] for a in e["attendees"] if a["email"] == me), "needsAction")
    o = {"id": e["id"], "subject": e["title"], "bodyPreview": e["description"][:255],
         "body": {"contentType": "text", "content": e["description"]} if AS_TEXT else {"contentType": "html", "content": "<html><body>" + e["description"].replace("\n", "<br>") + "</body></html>"},
         "location": {"displayName": e["location"]}, "start": m_time(e["start"]), "end": m_time(e["end"]), "originalStartTimeZone": e["zone"], "isAllDay": e["allDay"],
         "iCalUId": uid(e), "organizer": {"emailAddress": {"address": e["owner"], "name": PEOPLE[e["owner"]][0]}}, "isOrganizer": e["owner"] == me,
         "responseStatus": {"response": "organizer" if e["owner"] == me else M_REPLY[mine]},
         "attendees": [{"type": "optional" if a["optional"] else "required", "emailAddress": {"address": a["email"], "name": a["name"]}, "status": {"response": M_REPLY[a["response"]]}} for a in e["attendees"] if a["email"] != e["owner"]],
         "isOnlineMeeting": bool(e["meet"]), "onlineMeetingProvider": "teamsForBusiness" if e["meet"] else "unknown", "onlineMeeting": {"joinUrl": e["meet"]} if e["meet"] else None,
         "type": "seriesMaster" if e["rrule"] else ("exception" if e["master"] and not e.get("virtual") else "occurrence" if e["master"] else "singleInstance"),
         "seriesMasterId": e["master"], "webLink": f"http://127.0.0.1:{PORT}/microsoft/event?id={e['id']}"}
    if e["rrule"]: o["recurrence"] = m_recur(e)
    return o
def m_when(v):
    d = datetime.fromisoformat(re.sub(r"\.\d+", "", v["dateTime"]).replace("Z", ""))
    return iso(d.replace(tzinfo=zone(v.get("timeZone")))), v.get("timeZone")
def m_in(e, body, me):
    if "subject" in body: e["title"] = body["subject"] or ""
    if "body" in body: e["description"] = (body["body"] or {}).get("content", "")
    if "location" in body: e["location"] = (body["location"] or {}).get("displayName", "")
    if "isAllDay" in body: e["allDay"] = bool(body["isAllDay"])
    for key in ("start", "end"):
        if key in body:
            e[key], z = m_when(body[key])
            if z and z != "UTC": e["zone"] = z
    if "attendees" in body:
        old = {a["email"]: a for a in e["attendees"]}
        e["attendees"] = [{"email": a["emailAddress"]["address"], "name": a["emailAddress"].get("name") or PEOPLE.get(a["emailAddress"]["address"], ("",))[0], "optional": a.get("type") == "optional",
                           "response": old.get(a["emailAddress"]["address"], {}).get("response", "needsAction")} for a in body["attendees"] or []]
        if e["attendees"]: e["attendees"].insert(0, {"email": e["owner"], "name": PEOPLE[e["owner"]][0], "optional": False, "response": "accepted"})
    if "recurrence" in body:
        rec = body["recurrence"]
        if not rec: e["rrule"] = None
        else:
            p, rng = rec["pattern"], rec.get("range", {}); short = {"monday": "MO", "tuesday": "TU", "wednesday": "WE", "thursday": "TH", "friday": "FR", "saturday": "SA", "sunday": "SU"}
            parts = ["FREQ=" + {"daily": "DAILY", "weekly": "WEEKLY", "absoluteMonthly": "MONTHLY", "absoluteYearly": "YEARLY"}[p["type"]]]
            if p.get("interval", 1) != 1: parts.append(f"INTERVAL={p['interval']}")
            if p.get("daysOfWeek"): parts.append("BYDAY=" + ",".join(short[d] for d in p["daysOfWeek"]))
            if rng.get("type") == "numbered": parts.append(f"COUNT={rng['numberOfOccurrences']}")
            if rng.get("type") == "endDate": parts.append("UNTIL=" + rng["endDate"].replace("-", "") + "T235959Z")
            e["rrule"] = "RRULE:" + ";".join(parts)
    if "isOnlineMeeting" in body:
        e["meet"] = (e["meet"] or f"https://teams.microsoft.com/l/meetup-join/{uuid.uuid4().hex[:16]}") if body["isOnlineMeeting"] else None

def blank(owner, cal):
    return {"id": new_id(S), "cal": cal, "owner": owner, "title": "", "start": "", "end": "", "allDay": False, "zone": "UTC", "location": "", "description": "",
            "attendees": [], "meet": None, "rrule": None, "master": None, "original": None, "cancelled": False, "v": 0, "gone": []}
def retime(e, before):
    """A repeating event whose times or rule changed: its old occurrences are gone."""
    if e["rrule"] and (before["start"], before["rrule"]) != (e["start"], e["rrule"]):
        now = datetime.now(UTC); S["v"] += 1
        e["gone"] = e.get("gone", []) + [(x["id"], S["v"]) for x in expand(before, now - timedelta(days=60), now + timedelta(days=120)) if x.get("virtual")]

class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    late = 0
    def log_message(self, *a): pass
    def out(self, code, body, kind="application/json"):
        data = body.encode() if isinstance(body, str) else json.dumps(body).encode()
        self.entry["status"] = code
        if self.late: self.kept = (code, kind, data); return
        self.send_response(code); self.send_header("content-type", kind); self.send_header("content-length", str(len(data))); self.end_headers(); self.wfile.write(data)
        self.entry["status"] = code
    def who(self):
        token = self.headers.get("authorization", "").removeprefix("Bearer ").strip()
        found = S["tokens"].get(token)
        if not found or found[1] < time.time() or found[2] != self.path.split("/")[1]: return None
        return found[0]
    def handle_one(self, method):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        size = int(self.headers.get("content-length") or 0); raw = self.rfile.read(size) if size else b""
        if u.path == "/_ctl":
            with lock:
                global S
                if "offline" in q: S["offline"] = q["offline"] == "1"
                if "delay" in q: S["delay"] = int(q["delay"])
                if "fail" in q: S["fail"] = [int(q["fail"]), q.get("after"), q.get("made") == "1"]
                if "drop" in q: S["drop"] = q["drop"] == "1"
                if "reset" in q:
                    S = fresh()
                    if LOG: open(LOG, "w").close()
                if "expire" in q: S["tokens"] = {t: (e, 0, p) for t, (e, _, p) in S["tokens"].items()}
                save()
            self.entry = {}
            if "log" in q: return self.out(200, open(LOG).read() if LOG and os.path.exists(LOG) else "", "text/plain")
            return self.out(200, {"ok": True, "offline": S["offline"]})
        if S["offline"]:
            self.close_connection = True; self.connection.close(); return
        form = raw.decode() if "x-www-form-urlencoded" in self.headers.get("content-type", "") else None
        try: body = {k: v[0] for k, v in parse_qs(form).items()} if form is not None else (json.loads(raw) if raw else {})
        except ValueError: body = {}
        shown = {k: ("…" if k in ("code", "code_verifier", "refresh_token", "client_secret") else v) for k, v in body.items()} if form is not None else body
        self.entry = {"at": iso(datetime.now(UTC)), "method": method, "path": u.path, "query": {k: v for k, v in q.items() if k not in ("code_challenge", "state")}, "body": shown}
        with lock:
            me = self.who(); self.entry["as"] = me
            global AS_TEXT
            AS_TEXT = 'outlook.body-content-type="text"' in self.headers.get("prefer", "")
            if method != "GET" and "/events" in u.path and S.get("delay"):
                self.late, S["delay"] = S["delay"], 0; self.entry["late"] = self.late
            change = method != "GET" and "/events" in u.path
            if change and S.get("fail") and S["fail"][2:] == [True]:
                self.failed, S["fail"] = S["fail"][0], None; self.late = -1; self.entry["made_then"] = self.failed
            elif change and S.get("fail"):
                (code, after), S["fail"] = S["fail"][:2], None; self.entry["status"] = code; save()
                data = json.dumps({"error": {"message": "stand-in: told to fail"}}).encode()
                self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(data)))
                if after: self.send_header("retry-after", after)
                self.end_headers(); self.wfile.write(data); record(self.entry); return
            if change and S.get("drop"):
                S["drop"] = False; self.late = -1; self.entry["dropped"] = True
            try:
                parts = [p for p in u.path.split("/") if p]
                if not parts: self.out(200, "calendar stand-in", "text/plain")
                elif parts[0] == "google": self.google(method, parts[1:], q, body, me)
                elif parts[0] == "microsoft": self.microsoft(method, parts[1:], q, body, me)
                else: self.out(404, {"error": "not found"})
            except Exception as e:
                import traceback; traceback.print_exc()
                self.out(500, {"error": {"message": repr(e)}})
            save()
        record(self.entry)
        if self.late < 0 and getattr(self, "failed", 0):
            code, self.failed, self.late = self.failed, 0, 0
            data = b'{"error": {"message": "stand-in: made, then failed"}}'
            self.send_response(code); self.send_header("content-type", "application/json"); self.send_header("content-length", str(len(data)))
            self.end_headers(); self.wfile.write(data); return
        if self.late < 0:
            self.late = 0; self.close_connection = True; self.connection.close(); return
        if self.late:
            code, kind, data = self.kept; self.late = 0; time.sleep(self.entry["late"])
            try: self.send_response(code); self.send_header("content-type", kind); self.send_header("content-length", str(len(data))); self.end_headers(); self.wfile.write(data)
            except OSError: pass
    def do_GET(self): self.handle_one("GET")
    def do_POST(self): self.handle_one("POST")
    def do_PATCH(self): self.handle_one("PATCH")
    def do_DELETE(self): self.handle_one("DELETE")

    # ---- sign-in, the same for both ----
    def authorize(self, provider, q):
        people = [e for e, (_, p) in PEOPLE.items() if p == provider]
        pick = q.get("pick") or (q.get("login_hint") if q.get("login_hint") in people else None)
        if not pick:
            links = "".join(f'<p><a style="font:18px system-ui" href="{self.path}&pick={e}">Continue as {PEOPLE[e][0]} ({e})</a></p>' for e in people)
            return self.out(200, f'<html><body style="font:16px system-ui;margin:60px"><h2>Stand-in {provider.title()} sign-in</h2><p>Not the real service. Pick a made-up person:</p>{links}</body></html>', "text/html")
        if pick not in people: return self.out(400, {"error": "no such person"})
        code = uuid.uuid4().hex
        S["codes"][code] = [pick, q.get("code_challenge", ""), q.get("redirect_uri", ""), provider]
        self.entry["as"] = pick
        go = q["redirect_uri"] + ("&" if "?" in q["redirect_uri"] else "?") + urlencode({"code": code, "state": q.get("state", "")})
        self.send_response(302); self.send_header("location", go); self.send_header("content-length", "0"); self.end_headers(); self.entry["status"] = 302
    def grant(self, email, provider, scope=""):
        access, renew = f"at-{uuid.uuid4().hex}", f"rt-{uuid.uuid4().hex}"
        S["tokens"][access] = (email, time.time() + 3600, provider); S["refresh"][renew] = (email, provider)
        self.entry["as"] = email
        return {"access_token": access, "refresh_token": renew, "expires_in": 3600, "token_type": "Bearer", "scope": scope}
    def token(self, provider, body):
        if body.get("grant_type") == "authorization_code":
            code = S["codes"].pop(body.get("code", ""), None)
            if not code or code[3] != provider: return self.out(400, {"error": "invalid_grant"})
            proof = base64.urlsafe_b64encode(hashlib.sha256(body.get("code_verifier", "").encode()).digest()).rstrip(b"=").decode()
            if proof != code[1] or body.get("redirect_uri") != code[2]: return self.out(400, {"error": "invalid_grant", "error_description": "PKCE or redirect mismatch"})
            return self.out(200, self.grant(code[0], provider))
        if body.get("grant_type") == "refresh_token":
            kept = S["refresh"].get(body.get("refresh_token", ""))
            if not kept or kept[1] != provider: return self.out(400, {"error": "invalid_grant"})
            answer = self.grant(kept[0], provider); S["refresh"].pop(answer["refresh_token"]); answer.pop("refresh_token")
            return self.out(200, answer)
        self.out(400, {"error": "unsupported_grant_type"})
    def window(self, q, lo_key, hi_key):
        """The sync position: how far the caller has read, and the dates it first asked for."""
        token = q.get("syncToken") or q.get("$deltatoken")
        if token:
            try: since, lo, hi = base64.urlsafe_b64decode(token).decode().split("|")
            except Exception: return None
            if q.get("syncToken") == "gone": return None
            return int(since), parse(lo), parse(hi), None
        now = datetime.now(UTC)
        lo = parse(q[lo_key]) if q.get(lo_key) else now - timedelta(days=30); hi = parse(q[hi_key]) if q.get(hi_key) else now + timedelta(days=90)
        return None, lo, hi, None
    def next_token(self, lo, hi): return base64.urlsafe_b64encode(f"{S['v']}|{iso(lo)}|{iso(hi)}".encode()).decode()

    def google(self, method, p, q, body, me):
        if p[:1] == ["authorize"]: return self.authorize("google", q)
        if p[:1] == ["token"]: return self.token("google", body)
        if not me: return self.out(401, {"error": {"code": 401, "message": "Invalid Credentials", "status": "UNAUTHENTICATED"}})
        if p == ["oauth2", "v3", "userinfo"]: return self.out(200, {"email": me, "name": PEOPLE[me][0]})
        p = p[2:] if p[:2] == ["calendar", "v3"] else p
        if p == ["users", "me", "calendarList"]:
            return self.out(200, {"kind": "calendar#calendarList", "items": [{"id": c["id"], "summary": c["name"], "backgroundColor": c["color"], "primary": c["primary"], "accessRole": "owner", "timeZone": "UTC"} for c in S["cals"][me]]})
        if p == ["freeBusy"]:
            lo, hi = parse(body["timeMin"]), parse(body["timeMax"]); cals = {}
            for item in body.get("items", []):
                who = item["id"]
                if PEOPLE.get(who, ("", ""))[1] != "google": cals[who] = {"errors": [{"domain": "global", "reason": "notFound"}], "busy": []}
                else: cals[who] = {"busy": [{"start": s, "end": e} for s, e in busy(who, lo, hi)]}
            return self.out(200, {"kind": "calendar#freeBusy", "timeMin": iso(lo), "timeMax": iso(hi), "calendars": cals})
        if len(p) >= 3 and p[0] == "calendars" and p[2] == "events":
            cal = unquote(p[1]); cal = primary(me) if cal == "primary" else cal
            if not any(c["id"] == cal for c in S["cals"][me]): return self.out(404, {"error": {"code": 404, "message": "Not Found"}})
            notify = q.get("sendUpdates", "none") != "none"
            if method == "GET" and len(p) == 3:
                w = self.window(q, "timeMin", "timeMax")
                if w is None: return self.out(410, {"error": {"code": 410, "message": "Sync token is no longer valid, a full sync is required.", "errors": [{"reason": "fullSyncRequired"}]}})
                since, lo, hi, _ = w
                return self.out(200, {"kind": "calendar#events", "items": [g_out(e, me) for e in listing(me, cal, lo, hi, since)], "nextSyncToken": self.next_token(lo, hi)})
            if method == "POST" and len(p) == 3:
                # A client may choose the id; the same id twice is refused, as Google does.
                if body.get("id") and body["id"] in S["events"]: return self.out(409, {"error": {"code": 409, "message": "The requested identifier already exists."}})
                e = blank(me, cal); e["id"] = body.get("id") or e["id"]; g_in(e, body, me); bump(e); S["events"][e["id"]] = e
                self.entry["mail"] = mailed(e, me) if notify else []
                return self.out(200, g_out(e, me))
            e = find(p[3]) if len(p) == 4 else None
            if not e or not (e["owner"] == me or any(a["email"] == me for a in e["attendees"])): return self.out(404, {"error": {"code": 404, "message": "Not Found"}})
            if method == "GET": return self.out(200, g_out(e, me))
            # A deleted event is gone to every change, as on Google; it can still be read, marked cancelled.
            if e["cancelled"]: return self.out(410, {"error": {"code": 410, "message": "Resource has been deleted"}})
            if method == "DELETE":
                e["cancelled"] = True; bump(e); self.entry["mail"] = mailed(e, me) if notify else []
                return self.out(204, "")
            if method == "PATCH":
                before = json.loads(json.dumps(e))
                if e["owner"] != me:
                    # A guest may only change their own reply.
                    if "attendees" in body: g_in(e, {"attendees": body["attendees"]}, me)
                    bump(e); self.entry["mail"] = [e["owner"]] if notify else []
                    return self.out(200, g_out(e, me))
                g_in(e, body, me); retime(e, before); bump(e)
                self.entry["mail"] = mailed(e, me) if notify else []
                return self.out(200, g_out(e, me))
        self.out(404, {"error": {"code": 404, "message": "Not Found"}})

    def microsoft(self, method, p, q, body, me):
        if p[:1] == ["authorize"]: return self.authorize("microsoft", q)
        if p[:1] == ["token"]: return self.token("microsoft", body)
        if not me: return self.out(401, {"error": {"code": "InvalidAuthenticationToken", "message": "Access token is empty or expired."}})
        p = p[1:] if p[:1] == ["v1.0"] else p
        if p == ["me"]: return self.out(200, {"mail": me, "userPrincipalName": me, "displayName": PEOPLE[me][0]})
        if p == ["me", "calendars"]:
            return self.out(200, {"value": [{"id": c["id"], "name": c["name"], "hexColor": c["color"], "isDefaultCalendar": c["primary"], "canEdit": True} for c in S["cals"][me]]})
        if p == ["me", "calendar", "getSchedule"]:
            lo, _ = m_when(body["startTime"]); hi, _ = m_when(body["endTime"]); lo, hi = parse(lo), parse(hi); out = []
            for who in body.get("schedules", []):
                if PEOPLE.get(who, ("", ""))[1] != "microsoft": out.append({"scheduleId": who, "error": {"message": "Unable to resolve the mailbox.", "responseCode": "ErrorMailRecipientNotFound"}})
                else: out.append({"scheduleId": who, "availabilityView": "", "scheduleItems": [{"status": "busy", "start": m_time(s), "end": m_time(e)} for s, e in busy(who, lo, hi)]})
            return self.out(200, {"value": out})
        if len(p) == 5 and p[:2] == ["me", "calendars"] and p[3:] == ["calendarView", "delta"]:
            cal = unquote(p[2])
            if not any(c["id"] == cal for c in S["cals"][me]): return self.out(404, {"error": {"code": "ErrorItemNotFound", "message": "The specified object was not found in the store."}})
            w = self.window(q, "startDateTime", "endDateTime")
            if w is None: return self.out(410, {"error": {"code": "SyncStateNotFound", "message": "The sync state generation is not found."}})
            since, lo, hi, _ = w
            link = f"http://127.0.0.1:{PORT}/microsoft/v1.0/me/calendars/{p[2]}/calendarView/delta?$deltatoken={self.next_token(lo, hi)}"
            return self.out(200, {"value": [m_out(e, me) for e in listing(me, cal, lo, hi, since)], "@odata.deltaLink": link})
        if len(p) == 4 and p[:2] == ["me", "calendars"] and p[3] == "events" and method == "POST":
            cal = unquote(p[2])
            if not any(c["id"] == cal for c in S["cals"][me]): return self.out(404, {"error": {"code": "ErrorItemNotFound", "message": "not found"}})
            # The same transactionId twice is the same event, as Graph does for a client's retry.
            again = next((x for x in S["events"].values() if body.get("transactionId") and x.get("tx") == body["transactionId"] and x["owner"] == me), None)
            if again: self.entry["mail"] = []; return self.out(201, m_out(again, me))
            e = blank(me, cal); e["tx"] = body.get("transactionId"); m_in(e, body, me); bump(e); S["events"][e["id"]] = e
            self.entry["mail"] = mailed(e, me)
            return self.out(201, m_out(e, me))
        if len(p) >= 3 and p[:2] == ["me", "events"]:
            e = find(p[2])
            if not e or not (e["owner"] == me or any(a["email"] == me for a in e["attendees"])): return self.out(404, {"error": {"code": "ErrorItemNotFound", "message": "The specified object was not found in the store."}})
            # Graph no longer knows a deleted event.
            if e["cancelled"]: return self.out(404, {"error": {"code": "ErrorItemNotFound", "message": "The specified object was not found in the store."}})
            if len(p) == 4 and method == "POST" and p[3] in ("accept", "decline", "tentativelyAccept"):
                next(a for a in e["attendees"] if a["email"] == me)["response"] = {"accept": "accepted", "decline": "declined", "tentativelyAccept": "tentative"}[p[3]]
                bump(e); self.entry["mail"] = [e["owner"]] if body.get("sendResponse", True) else []
                return self.out(202, "")
            if method == "GET": return self.out(200, m_out(e, me))
            if method == "DELETE":
                e["cancelled"] = True; bump(e); self.entry["mail"] = mailed(e, me)
                return self.out(204, "")
            if method == "PATCH":
                before = json.loads(json.dumps(e)); m_in(e, body, me); retime(e, before); bump(e)
                # Graph: a change to only the guest list goes to the guests that changed.
                was, now = {a["email"] for a in before["attendees"]}, {a["email"] for a in e["attendees"]}
                self.entry["mail"] = mailed(e, me, (was ^ now) if list(body) == ["attendees"] else None) if e["attendees"] or before["attendees"] else []
                return self.out(200, m_out(e, me))
        self.out(404, {"error": {"code": "ResourceNotFound", "message": "not found"}})

if __name__ == "__main__":
    save()
    print(json.dumps({"listening": PORT}), flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
