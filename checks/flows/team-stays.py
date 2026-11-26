#!/usr/bin/env python3
"""Flow: a team folder stays in its team, whatever happens to the sign-in, the relay or the computer.

Fifty incidents in the style of the one that started it (a sign-in that ran out, "Sync stopped",
another workspace opened, edits sent to a second team with the same name). Each drives the real
desktop app, a local relay and a stand-in account service (checks/flows/mock-auth.py) with made-up
people, and gives three verdicts:

  window    what the real window says: the same folder open, signed in, "Synced", no Share/Join/Reconnect
  edits     what was typed here, written by another program and typed by a teammate reaches the
            right team's folders, and no other team on the relay receives anything
  again     the same incident repeated holds every time

Usage:  python3 checks/flows/team-stays.py <label> [numbers...]   (results: $TEAM_STAYS/<label>.json)
        python3 checks/flows/team-stays.py table <before> <after>  (one table from two runs)
Needs: cargo build -p lokus-desktop -p lokus-cli -p lokus-server, and nothing else on ports 1420, 9911, 8798.
"""
import threading, base64, hashlib, hmac, json, os, shutil, signal, sqlite3, subprocess, sys, time, urllib.request

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BIN = os.environ.get("TEAM_STAYS_BIN", f"{REPO}/target/debug")
UI = os.environ.get("TEAM_STAYS_UI", f"{REPO}/ui")
T = os.environ.get("TEAM_STAYS", "/tmp/lokus-team-stays")
# A second run beside the first takes the next ports (TEAM_STAYS_PORTS=1), with a build whose window loads from that UI port.
N = int(os.environ.get("TEAM_STAYS_PORTS", "0"))
UI_PORT, AUTH_PORT, RELAY_PORT = 1420 + N, 9911 + N, 8798 + N
AUTH, RELAY = f"http://127.0.0.1:{AUTH_PORT}", f"http://127.0.0.1:{RELAY_PORT}"
LASTS, GRACE = 45, 3  # seconds a sign-in lasts, and how long the relay waits after it ran out
RAN_OUT = LASTS + GRACE + 12
SOON = 30  # how long anything may take to settle once it can
# The account library does not ask a service that failed it again for up to a minute, so a sign-in
# that ran out during an outage is renewed that long after the service is back, and one that was
# ended for good is known to be gone that long after it was first turned down.
AFTER_OUTAGE = 90
patient = [SOON]
BAD = ("Share", "Join", "Reconnect", "Connect")
procs = {}

def sh(*a, **k):
    return subprocess.run(a, capture_output=True, text=True, **k)

def spawn(name, argv, env=None, cwd=None):
    log = open(f"{T}/logs/{name}.log", "a")
    procs[name] = subprocess.Popen(argv, stdout=log, stderr=log, env={**os.environ, **(env or {})}, cwd=cwd, start_new_session=True)
    return procs[name]

def stop(name, sig=signal.SIGTERM):
    p = procs.pop(name, None)
    if p and p.poll() is None:
        os.killpg(p.pid, sig)
        try: p.wait(5)
        except subprocess.TimeoutExpired: os.killpg(p.pid, signal.SIGKILL)

def get(url, token=None, method="GET", body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("content-type", "application/json")
    if token: req.add_header("authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=10) as r:
        text = r.read()
        return json.loads(text) if text.strip() else None

def until(check, wait=SOON, every=0.5):
    end = time.time() + wait
    while True:
        try:
            got = check()
            if got: return got
        except Exception:
            pass
        if time.time() > end: return None
        time.sleep(every)

def token(who):
    """A day-long sign-in for a made-up teammate, signed the way the stand-in account service signs."""
    b = lambda x: base64.urlsafe_b64encode(x).rstrip(b"=").decode()
    body = b(b'{"alg":"HS256","typ":"JWT"}') + "." + b(json.dumps({"sub": f"u-{who}", "email": f"{who}@made-up.test", "aud": "authenticated", "role": "authenticated", "exp": int(time.time()) + 86400}).encode())
    return body + "." + b(hmac.new(b"local-stand-in-secret", body.encode(), hashlib.sha256).digest())

# ---- the three services -------------------------------------------------------------------------

def auth(**q):
    if q.get("offline"): patient[0] = AFTER_OUTAGE
    get(f"{AUTH}/_ctl?" + "&".join(f"{k}={v}" for k, v in q.items()))

def relay_up():
    spawn("relay", [f"{BIN}/lokus-server"], {"SUPABASE_URL": AUTH, "SUPABASE_JWT_SECRET": "local-stand-in-secret", "LOKUS_SIGN_IN_GRACE": str(GRACE), "LOKUS_DATA": f"{T}/relay.db", "PORT": str(RELAY_PORT)})
    assert until(lambda: urllib.request.urlopen(f"{RELAY}/health", timeout=2).read() == b"ok"), "the relay did not start"

def relay_down():
    stop("relay", signal.SIGKILL)

def services():
    for d in ("logs", "pictures"): os.makedirs(f"{T}/{d}", exist_ok=True)
    env = {"VITE_SUPABASE_URL": AUTH, "VITE_SUPABASE_ANON_KEY": "x", "VITE_LOKUS_RELAY": RELAY, "VITE_POSTHOG_KEY": ""}
    spawn("vite", ["pnpm", "exec", "vite", "--strictPort", "--port", str(UI_PORT)], env, cwd=UI)
    spawn("auth", ["python3", f"{REPO}/checks/flows/mock-auth.py", str(AUTH_PORT), str(LASTS)])
    assert until(lambda: urllib.request.urlopen(f"http://localhost:{UI_PORT}", timeout=2).status == 200, 60), "the UI server did not start"
    assert until(lambda: get(f"{AUTH}/_ctl?offline=0")), "the account service did not start"

def rows():
    """How many edits each team on the relay holds."""
    db = sqlite3.connect(f"file:{T}/relay.db?mode=ro", uri=True, timeout=5)
    try:
        counts = {w: 0 for (w,) in db.execute("select id from workspaces")}
        counts.update(dict(db.execute("select workspace, count(*) from updates group by workspace")))
        return counts
    finally:
        db.close()

# ---- one copy of the app ------------------------------------------------------------------------

class App:
    def __init__(self, name, home=None):
        self.name, self.home, self.sock = name, home or f"{T}/home{name}", f"{T}/{name}.sock"
        self.docs = f"{self.home}/Documents"

    def start(self):
        os.makedirs(self.docs, exist_ok=True)
        if os.path.exists(self.sock): os.remove(self.sock)
        env = {"HOME": self.home, "CFFIXED_USER_HOME": self.home, "LOKUS_DEV_SOCK": self.sock, "VITE_SUPABASE_URL": AUTH, "VITE_SUPABASE_ANON_KEY": "x", "VITE_LOKUS_RELAY": RELAY, "VITE_POSTHOG_KEY": ""}
        self.p = spawn(f"app{self.name}", [f"{BIN}/lokus-desktop"], env, cwd=REPO)
        assert until(lambda: self.state() is not None, 90), f"app {self.name} did not start"
        if os.environ.get("TEAM_STAYS_TRACE"): threading.Thread(target=self.trace, args=(self.p,), daemon=True).start()
        time.sleep(1)

    def trace(self, p):
        """Every change in what the window says, with the time, for looking into an incident."""
        last = None
        while p.poll() is None:
            now = json.dumps({**(self.state() or {}), "team.json": os.path.exists(f"{self.docs}/Clean/.lokus/team.json")})
            if now != last: open(f"{T}/trace.log", "a").write(f"{time.strftime('%H:%M:%S')} {now}\n")
            last = now
            time.sleep(1)

    def quit(self):
        stop(f"app{self.name}")
        time.sleep(0.5)

    def do(self, command, wait=20, **args):
        try:
            out = sh(f"{BIN}/lokus", "app", command, *[f"{k}={v}" for k, v in args.items()], env={**os.environ, "LOKUS_DEV_SOCK": self.sock}, timeout=wait)
        except subprocess.TimeoutExpired:
            return None
        try: return json.loads(out.stdout)
        except ValueError: return None

    def state(self):
        s = self.do("debug.state", wait=8)
        return s if s and "vault" in s else None

    def see(self, visible):
        sh("osascript", "-e", f'tell application "System Events" to set visible of (first process whose unix id is {self.p.pid}) to {"true" if visible else "false"}')
        if visible: sh("osascript", "-e", f'tell application "System Events" to set frontmost of (first process whose unix id is {self.p.pid}) to true')

    def freeze(self, frozen):
        os.kill(self.p.pid, signal.SIGSTOP if frozen else signal.SIGCONT)

    def picture(self, name):
        path = f"{T}/pictures/{name}.png"
        self.do("window.snapshot", path=path)
        until(lambda: os.path.exists(path), 5)
        return path

    def sign_in(self, who="ana"):
        return self.do("account.signIn", email=f"{who}@made-up.test", password="made-up")

    def open(self, root):
        self.do("vault.use", path=root, wait=40)
        return until(lambda: (self.state() or {}).get("vault") == root, 15)

    def online(self, wait=SOON):
        return until(lambda: (self.state() or {}).get("sync", {}).get("status") == "online", wait)

    def typed(self, root, line):
        """Type a line at the top of Mine.md in the real editor; if the window cannot be typed in, another program writes the file."""
        if self.do("note.open", path="Mine.md", wait=8) and self.do("editor.select", anchor=0, wait=8) and self.do("editor.type", text=line + "\n", wait=8):
            self.do("note.save", wait=8)
            return "typed"
        wrote(root, "Mine.md", line)
        return "file"

def wrote(root, note, line):
    """What the assistant, or any other program, does: read the note and write it back with a line added, through the core command."""
    path = f"{root}/{note}"
    old = open(path).read() if os.path.exists(path) else ""
    sh(f"{BIN}/lokus", "note.write" if old else "note.create", "--vault", root, f"path={note}", f"text={line}\n{old}")

def has(root, note, line):
    try: return line in open(f"{root}/{note}").read()
    except OSError: return False

class Mate:
    """A teammate's computer: the same sync, from the command line, into its own folder."""
    def __init__(self, who, team):
        self.who, self.team, self.root = who, team, f"{T}/mate-{who}-{team[:8]}"
        os.makedirs(self.root, exist_ok=True)
        self.start()
    def start(self):
        spawn(f"mate-{self.who}-{self.team[:8]}", [f"{BIN}/lokus", "sync", "--vault", self.root, f"server={RELAY}", f"workspace={self.team}", f"token={token(self.who)}"])
    def stop(self):
        stop(f"mate-{self.who}-{self.team[:8]}")

def team(owner, name, *members):
    """A team on the relay, made by `owner`, with (who, role) members who accepted an invitation."""
    made = get(f"{RELAY}/v1/workspaces", token(owner), "POST", {"name": name})["id"]
    for who, role in members:
        code = get(f"{RELAY}/v1/workspaces/{made}/invites", token(owner), "POST", {"role": role})["code"]
        get(f"{RELAY}/v1/invites/{code}/accept", token(who), "POST")
    return made

# ---- the starting point every incident shares -----------------------------------------------------

class World:
    """Ana's computer with the folder Clean in the team Clean, Ben in the same team on his own computer.
    `many` adds four more workspaces: Lokus (another team of hers) and three folders of her own notes."""
    def __init__(self, many=False, role="owner", start=True):
        for name in [n for n in procs if n.startswith(("app", "mate"))]: stop(name)
        auth(offline=0, ttl=LASTS)
        # Nothing is left from the incident before: a new relay, a new computer.
        relay_down()
        for f in ("relay.db", "relay.db-wal", "relay.db-shm"):
            if os.path.exists(f"{T}/{f}"): os.remove(f"{T}/{f}")
        relay_up()
        self.a = App("A")
        time.sleep(2)  # the window's storage is written by a helper that outlives the app for a moment
        for home in [d for d in os.listdir(T) if d.startswith("home")]: shutil.rmtree(f"{T}/{home}")
        for stale in [d for d in os.listdir(T) if d.startswith("mate-")]: shutil.rmtree(f"{T}/{stale}", ignore_errors=True)
        self.many, self.role = many, role
        # A viewer's own notes go nowhere, so a viewer starts with an empty folder and the notes are the teammate's.
        self.root = self.folder("Clean") if role != "viewer" else f"{self.a.docs}/Clean"
        os.makedirs(self.root, exist_ok=True)
        self.n = 0
        self.before = None
        self.clean = team("ana", "Clean", ("ben", "editor")) if role == "owner" else team("ben", "Clean", ("ana", role))
        self.teams = {self.clean}
        self.ben = Mate("ben", self.clean)
        if not start: return
        # The folder says whose it is before the app sees it: a team with no folder here is given one of its own
        # ("Clean 2") by the first look, which is right for a team joined elsewhere and wrong for this starting point.
        self.belongs(self.root, self.clean)
        self.a.start()
        self.a.sign_in()
        self.a.open(self.root)
        self.a.do("sync.connect", server=RELAY, workspace=self.clean)
        if role == "viewer": self.folder("Clean", self.ben.root)
        assert self.a.online(), "the folder did not connect to its team"
        if many:
            self.lokus_root = self.folder("Lokus")
            self.lokus = team("ana", "Lokus", ("ben", "editor"))
            self.belongs(self.lokus_root, self.lokus)
            self.teams.add(self.lokus)
            self.ben2 = Mate("ben", self.lokus)
            self.a.open(self.lokus_root)
            self.a.do("sync.connect", server=RELAY, workspace=self.lokus)
            assert self.a.online(), "the second team folder did not connect"
            for name in ("Notes", "Journal", "Scratch"):
                self.a.open(self.folder(name))
            self.a.open(self.root)
            assert self.a.online(), "the folder did not connect again"
        assert until(lambda: has(self.root if role == "viewer" else self.ben.root, "Plan.md", "made-up plan")), "the notes did not cross"
        extra = sorted(set(os.listdir(self.a.docs)) - {"Clean", "Lokus", "Notes", "Journal", "Scratch"})
        assert not extra, f"the start made folders nobody asked for: {extra}"
        self.mark()

    def belongs(self, root, team_id):
        os.makedirs(f"{root}/.lokus", exist_ok=True)
        with open(f"{root}/.lokus/team.json", "w") as f:
            json.dump({"server": RELAY, "workspace": team_id, "token": None}, f)

    def folder(self, name, root=None):
        root = root or f"{self.a.docs}/{name}"
        os.makedirs(root, exist_ok=True)
        for note, text in (("Plan.md", f"# Plan\n\nmade-up plan for {name}\n"), ("Mine.md", "# Mine\n"), ("Theirs.md", "# Theirs\n"), ("Assistant.md", "# Assistant\n")):
            open(f"{root}/{note}", "w").write(text)
        return root

    def mark(self):
        self.before = rows()

    def edits(self, root=None, mate=None, mine=True, theirs=True):
        """One line typed here, one written here by another program, one typed by the teammate. Returns what must arrive where."""
        root, mate = root or self.root, mate or self.ben
        self.n += 1
        due = []
        if mine:
            self.a.typed(root, f"mine-{self.n}")
            wrote(root, "Assistant.md", f"assistant-{self.n}")
            due += [(mate.root, "Mine.md", f"mine-{self.n}"), (mate.root, "Assistant.md", f"assistant-{self.n}")]
        if theirs:
            wrote(mate.root, "Theirs.md", f"theirs-{self.n}")
            due += [(root, "Theirs.md", f"theirs-{self.n}")]
        return due

    def arrived(self, due, wait=None):
        wait = wait or patient[0]
        missing = lambda: [f"{note}:{line}" for root, note, line in due if not has(root, note, line)]
        until(lambda: not missing(), wait)
        return missing()

    def strays(self):
        """Edits that went to a team other than the ones this computer's folders belong to, and teams that should not exist."""
        now = rows()
        return [f"{w[:8]} +{n - self.before.get(w, 0)}" for w, n in now.items() if w not in self.teams and (w not in self.before or n > self.before[w])]

    def window(self, label="Synced", root=None, account="ana@made-up.test", wait=SOON, team_page=True):
        """What the real window says once things could have settled. Empty when it is as it should be."""
        root = root or self.root
        ok = lambda s: s and s["vault"] == root and s["account"] == account and s["label"] == label
        until(lambda: ok(self.a.state()), wait)
        s = self.a.state()
        if not s: return ["the window does not answer"]
        wrong = []
        if s["vault"] != root: wrong.append(f"open folder is {os.path.basename(s['vault'] or 'none')}, not {os.path.basename(root)}")
        if s["account"] != account: wrong.append(f"account shows {s['account'] or 'signed out'}")
        if s["label"] != label: wrong.append(f"says “{s['label']}”" + (f" ({s['sync'].get('reason')})" if s["sync"].get("reason") else ""))
        if team_page:
            self.a.do("teams.open")
            time.sleep(1.5)
            page = self.a.state() or s
            offered = [b for b in page["buttons"] if b in BAD or b.startswith("Share ")]
            if offered: wrong.append("Team page offers " + "/".join(offered))
            if "Sync stopped" in (page["team"] or ""): wrong.append("Team page says Sync stopped")
            self.a.do("ui.key", key="Escape")
        return wrong

class Result:
    def __init__(self): self.window, self.edits, self.again, self.notes = None, None, None, []
    def put(self, field, wrong):
        wrong = [w for w in wrong if w]
        if getattr(self, field) in (None, "pass"): setattr(self, field, "pass" if not wrong else "FAIL: " + "; ".join(wrong))

def incident(w, r, trouble, times=2, **kind):
    """The usual shape: edits are made while `trouble` holds, then the folders and the window are looked at. Then again."""
    for turn in range(times):
        due = []
        trouble(w, lambda **k: due.extend(w.edits(**{**kind, **k})))
        # The folders first: looking at the window's Team page asks for the sign-in, which would help it along.
        missing = w.arrived(due)
        wrong_edits = ([f"did not arrive: {', '.join(missing)}"] if missing else []) + ([f"went to another team: {', '.join(w.strays())}"] if w.strays() else [])
        wrong_window = w.window()
        if turn == 0:
            r.put("window", wrong_window)
            r.put("edits", wrong_edits)
            w.a.picture(f"{r.label}-{r.number:02d}")
            if wrong_window or wrong_edits:
                r.notes.append("state: " + json.dumps(w.a.state())[:900])
                return r.put("again", ["failed the first time"])
        elif wrong_window or wrong_edits:
            return r.put("again", [f"turn {turn + 1}: " + "; ".join(wrong_window + wrong_edits)])
    r.put("again", [])

def check(w, r, due=(), turn=0, **window):
    """Look once, for an incident with its own shape."""
    missing = w.arrived(list(due))
    wrong_edits = ([f"did not arrive: {', '.join(missing)}"] if missing else []) + ([f"went to another team: {', '.join(w.strays())}"] if w.strays() else [])
    wrong_window = w.window(**window)
    if turn == 0:
        r.put("window", wrong_window)
        r.put("edits", wrong_edits)
        w.a.picture(f"{r.label}-{r.number:02d}")
        if wrong_window or wrong_edits: r.put("again", ["failed the first time"])
    else:
        r.put("again", [f"turn {turn + 1}: " + "; ".join(wrong_window + wrong_edits)] if wrong_window or wrong_edits else [])
    return not (wrong_window or wrong_edits)

# ---- kinds of trouble ---------------------------------------------------------------------------

def hidden(w, edit, shown=True):
    w.a.see(False); time.sleep(RAN_OUT); edit()
    w.said = (w.a.state() or {}).get("label")  # what it had come to, before anyone looked
    if shown: w.a.see(True)

def asleep(w, edit, long=RAN_OUT):
    w.a.see(False); w.a.freeze(True); edit(mine=False); time.sleep(long); edit(theirs=False); w.a.freeze(False); w.a.see(True)

def no_account_service(w, edit, long=RAN_OUT + 15):
    auth(offline=1); time.sleep(long); edit(); auth(offline=0)

def relay_gone(w, edit, long=15):
    relay_down(); time.sleep(long / 2); edit(theirs=False); time.sleep(long / 2); relay_up()

def relay_stuck(w, edit, long=25):
    os.killpg(procs["relay"].pid, signal.SIGSTOP); time.sleep(long / 2); edit(); time.sleep(long / 2); os.killpg(procs["relay"].pid, signal.SIGCONT)

def restart(w, edit, between=lambda: None):
    w.a.quit(); edit(mine=False); wrote(w.root, "Assistant.md", f"closed-{w.n}"); between(); w.a.start()

def sign_in_again(w, r, root=None):
    """The sign-in is truly gone: the window must say so with one button, on the same folder, and offer nothing else."""
    s = until(lambda: (lambda s: s if s and s["label"] == "Sign in again" else None)(w.a.state()), AFTER_OUTAGE) or w.a.state() or {}
    wrong = []
    if s.get("vault") != (root or w.root): wrong.append(f"open folder is {os.path.basename(s.get('vault') or 'none')}")
    if s.get("label") != "Sign in again": wrong.append(f"says “{s.get('label')}” where it should say “Sign in again”")
    w.a.do("teams.open"); time.sleep(1.5)
    page = w.a.state() or {}
    offered = [b for b in page.get("buttons", []) if b in BAD or b.startswith("Share ")]
    if offered: wrong.append("Team page offers " + "/".join(offered))
    if page.get("buttons", []).count("Sign in again") != 1: wrong.append("Team page has no single “Sign in again” button")
    w.a.picture(f"{r.label}-{r.number:02d}-sign-in-again")
    w.a.do("ui.key", key="Escape")
    r.put("window", wrong)
    auth(offline=0)
    w.a.sign_in()

def wiped(w, r):
    """After the window's storage is lost: either nothing is asked at all, or one sign-in is, on the same folder."""
    if until(lambda: (lambda s: s and s["label"] == "Synced" and s.get("vault") == w.root)(w.a.state()), SOON):
        return r.put("window", [])
    sign_in_again(w, r)

def old_version(w, roots):
    """Leave the folders as the version before this one kept them: the team in the window's storage only."""
    # The folder's own file goes first: if the running app looks in between, it moves the entry into the folder
    # itself, which is the same move the new version makes at its first start.
    for root, team_id in roots:
        if os.path.exists(f"{root}/.lokus/team.json"): os.remove(f"{root}/.lokus/team.json")
        # Said twice over: the command line reads a value that looks like an object as one, and storage holds words.
        out = w.a.do("debug.storage", key=f"lokus.sync:{root}", value=json.dumps(json.dumps({"server": RELAY, "workspace": team_id, "token": None})))
        assert out and f"lokus.sync:{root}" in out.get("keys", []), "the earlier version's entry was not written"
    w.a.quit()

def clear_storage(w):
    shutil.rmtree(f"{w.a.home}/Library/WebKit", ignore_errors=True)
    shutil.rmtree(f"{w.a.home}/Library/Caches", ignore_errors=True)

# ---- the fifty ----------------------------------------------------------------------------------

ALL = {}
def S(number, title, steps, many=False, role="owner", start=True):
    def keep(fn):
        ALL[number] = dict(title=title, steps=steps, many=many, role=role, start=start, run=fn)
        return fn
    return keep

@S(1, "Another app in front until the sign-in runs out", "Window hidden past the sign-in's life; he types, the assistant writes, Ben types; window brought back.")
def _(w, r):
    incident(w, r, hidden); r.notes.append(f"before it was looked at again it said “{w.said}”")

@S(2, "Sign-in runs out and the window is never looked at", "Window hidden past the sign-in's life and left hidden; edits on both sides must still cross.")
def _(w, r):
    incident(w, r, lambda w, e: hidden(w, e, shown=False)); w.a.see(True)

@S(3, "Mac asleep past the sign-in's life", "App frozen and hidden past the sign-in's life; Ben types and another program writes the notes meanwhile; wake.")
def _(w, r): incident(w, r, asleep)

@S(4, "A long sleep", "Asleep three sign-in lives; Ben types during it; wake.")
def _(w, r): incident(w, r, lambda w, e: asleep(w, e, 3 * RAN_OUT), times=2)

@S(5, "Sign-in runs out while the account service cannot be reached", "Window hidden, account service unreachable, sign-in runs out, window shown, service back ten seconds later.")
def _(w, r):
    def trouble(w, edit):
        auth(offline=1); w.a.see(False); time.sleep(RAN_OUT); edit(); w.a.see(True); time.sleep(10); auth(offline=0)
    incident(w, r, trouble)

@S(6, "Account service unreachable while he works", "Window in front, account service unreachable for longer than a sign-in lasts, then back.")
def _(w, r): incident(w, r, no_account_service)

@S(7, "Account service unreachable and he keeps coming back to the window", "Service unreachable past the sign-in's life; window left and returned to four times; it must never show him signed out.")
def _(w, r):
    seen = []
    def trouble(w, edit):
        auth(offline=1); time.sleep(RAN_OUT)
        for _ in range(4):
            w.a.see(False); time.sleep(2); w.a.see(True); time.sleep(3)
            s = w.a.state() or {}
            if s.get("account") != "ana@made-up.test": seen.append("showed him signed out while the account service was unreachable")
            if s.get("vault") != w.root: seen.append("changed folder")
        edit(); auth(offline=0)
    incident(w, r, trouble, times=1)
    r.window = "pass" if r.window == "pass" and not seen else f"FAIL: {'; '.join(sorted(set(seen)) or [r.window])}"
    r.again = "pass" if r.window == "pass" and r.edits == "pass" else "FAIL: see window"

@S(8, "Wake with no account service", "Asleep past the sign-in's life; on wake the account service is unreachable for twenty seconds, then back.")
def _(w, r):
    def trouble(w, edit):
        auth(offline=1); asleep(w, edit); time.sleep(20); auth(offline=0)
    incident(w, r, trouble)

@S(9, "The sign-in is ended for good", "Every sign-in revoked at the account service; he types meanwhile; window must say Sign in again with one button; he signs in.")
def _(w, r):
    for turn in range(2):
        auth(revoke=1); time.sleep(RAN_OUT); due = w.edits()
        if turn == 0: sign_in_again(w, r)
        else: auth(offline=0); w.a.sign_in()
        if not check(w, r, due, turn): break

@S(10, "Sign-in ended for good, five workspaces, window hidden", "Five workspaces, Clean open; sign-ins revoked while hidden; shown; he signs in; Clean must still be open.", many=True)
def _(w, r):
    auth(revoke=1); w.a.see(False); time.sleep(RAN_OUT); due = w.edits(); w.a.see(True)
    sign_in_again(w, r)
    check(w, r, due)
    auth(revoke=1); time.sleep(RAN_OUT); due = w.edits(); w.a.sign_in(); check(w, r, due, 1)

@S(11, "He signs out and in again with five workspaces", "Five workspaces, Clean open; Sign out; edits on both sides; Sign in; Clean must still be open and in its team.", many=True)
def _(w, r):
    for turn in range(2):
        w.a.do("account.signOut"); time.sleep(3); due = w.edits(); w.a.sign_in()
        if not check(w, r, due, turn): break

@S(12, "The incident: sign-in lost, a team of his has no folder on this computer", "Five workspaces, Clean open; he is also in a team Docs that has no folder here; sign-in lost and restored; Clean must stay open, chats and all.", many=True)
def _(w, r):
    docs = team("ben", "Docs", ("ana", "editor")); w.teams.add(docs)
    for turn in range(2):
        w.a.do("account.signOut"); time.sleep(3); due = w.edits(); w.a.sign_in(); time.sleep(8)
        w.a.see(False); w.a.see(True); time.sleep(5)
        if not check(w, r, due, turn): break

@S(13, "Two copies of Lokus on one sign-in", "A second copy of the app opened on the same account store; both renew the same sign-in for three lives.")
def _(w, r):
    b = App("B", w.a.home); b.start()
    def trouble(w, edit): time.sleep(3 * RAN_OUT); edit()
    incident(w, r, trouble); b.quit()

@S(14, "The same person on two computers", "A second computer signed in as her with its own copy of the folder; sign-in runs out hidden on the first; edits cross all three ways.")
def _(w, r):
    b = App("B"); shutil.rmtree(b.home, ignore_errors=True); os.makedirs(f"{b.docs}/Clean"); b.start(); b.sign_in(); b.open(f"{b.docs}/Clean")
    b.do("sync.connect", server=RELAY, workspace=w.clean); b.online()
    def trouble(w, edit):
        hidden(w, edit); wrote(f"{b.docs}/Clean", "Second.md", f"second-{w.n}")
    incident(w, r, trouble)
    r.put("edits", [] if until(lambda: has(w.root, "Second.md", f"second-{w.n}")) and has(f"{b.docs}/Clean", "Mine.md", f"mine-{w.n}") else ["the two computers did not exchange edits"])
    b.quit()

@S(15, "Two copies, one asleep while the other renews", "Two copies on one account store; the first asleep for two sign-in lives while the second keeps renewing; wake.")
def _(w, r):
    b = App("B", w.a.home); b.start()
    incident(w, r, lambda w, e: asleep(w, e, 2 * RAN_OUT)); b.quit()

@S(16, "Relay down for a quarter of a minute", "Relay stopped 15 seconds while he and the assistant write; started again.")
def _(w, r): incident(w, r, relay_gone, times=3)

@S(17, "Relay down while the sign-in runs out", "Relay stopped for longer than a sign-in lasts, window hidden; started; window shown.")
def _(w, r):
    def trouble(w, edit):
        w.a.see(False); relay_gone(w, edit, RAN_OUT); w.a.see(True)
    incident(w, r, trouble)

@S(18, "Relay slow", "Relay frozen 25 seconds mid-connection while both sides type; continues.")
def _(w, r): incident(w, r, relay_stuck, times=3)

@S(19, "Relay silent for over a minute", "Relay frozen 70 seconds, past the sign-in's life; continues.")
def _(w, r): incident(w, r, lambda w, e: relay_stuck(w, e, 70))

@S(20, "Relay restarted three times in a row", "Relay stopped and started three times, four seconds apart, with edits between.")
def _(w, r):
    def trouble(w, edit):
        for _ in range(3): relay_gone(w, edit, 4); time.sleep(4)
    incident(w, r, trouble)

@S(21, "App opened while the relay is down", "App quit; relay stopped; app started; edits; relay started.")
def _(w, r):
    def trouble(w, edit):
        w.a.quit(); relay_down(); w.a.start(); edit(theirs=False); time.sleep(8); relay_up()
    incident(w, r, trouble)

@S(22, "Restart with five workspaces", "Five workspaces, Clean open; quit; Ben types and another program writes while closed; start.", many=True)
def _(w, r): incident(w, r, restart, times=3)

@S(23, "Restart after the sign-in ran out", "Quit; wait past the sign-in's life; start.")
def _(w, r): incident(w, r, lambda w, e: restart(w, e, lambda: time.sleep(RAN_OUT)))

@S(24, "Restart with the sign-in run out and no account service", "Quit; wait past the sign-in's life; account service unreachable; start; service back 20 seconds later.")
def _(w, r):
    def trouble(w, edit):
        restart(w, edit, lambda: (time.sleep(RAN_OUT), auth(offline=1))); time.sleep(20)
        s = w.a.state() or {}
        if s.get("account") != "ana@made-up.test": r.notes.append("showed him signed out while the account service was unreachable")
        auth(offline=0)
    incident(w, r, trouble)
    if r.notes: r.window = "FAIL: " + r.notes[0]

@S(25, "Much written while the app was closed", "Quit; another program writes ten notes' worth and Ben types ten lines; start.")
def _(w, r):
    def trouble(w, edit):
        w.a.quit()
        for _ in range(10): edit(mine=False); wrote(w.root, "Assistant.md", f"closed-{w.n}")
        w.a.start()
    incident(w, r, trouble)
    lines = [f"closed-{n}" for n in range(1, w.n + 1)]
    r.put("edits", [] if until(lambda: all(has(w.ben.root, "Assistant.md", l) for l in lines)) else ["some of what was written while closed did not reach the teammate"])

@S(26, "Update from the version before", "Folder kept the way the earlier version kept it (team in the window's storage only); the new version opens it.")
def _(w, r):
    def trouble(w, edit):
        old_version(w, [(w.root, w.clean)]); edit(mine=False); wrote(w.root, "Assistant.md", f"closed-{w.n}"); w.a.start()
    incident(w, r, trouble)
    left = [k for k in (w.a.state() or {}).get("stored", []) if k.startswith("lokus.sync:")]
    r.notes.append(f"left in the window's storage: {left or 'nothing'}; team kept in the folder: {os.path.exists(w.root + '/.lokus/team.json')}")

@S(27, "Update with five workspaces and two teams", "Both team folders kept the earlier way; new version opens; Clean stays open; Lokus connects when he opens it and its edits go to Lokus only.", many=True)
def _(w, r):
    old_version(w, [(w.root, w.clean), (w.lokus_root, w.lokus)]); w.a.start()
    check(w, r, w.edits())
    w.a.open(w.lokus_root)
    due = w.edits(root=w.lokus_root, mate=w.ben2)
    check(w, r, due, 1, root=w.lokus_root)
    w.a.open(w.root)

@S(28, "Update with the sign-in run out and no account service", "Folder kept the earlier way; sign-in runs out while closed; account service unreachable when the new version opens; back 20 seconds later.")
def _(w, r):
    def trouble(w, edit):
        old_version(w, [(w.root, w.clean)]); edit(mine=False); time.sleep(RAN_OUT); auth(offline=1); w.a.start(); time.sleep(20); auth(offline=0)
    incident(w, r, trouble)

@S(29, "The window's storage is wiped", "Quit; the app's web storage deleted (sign-in and everything else it kept); start; the folder must still be the team's and ask for nothing, or at most one sign-in.")
def _(w, r):
    for turn in range(2):
        w.a.quit(); clear_storage(w); w.a.start(); due = w.edits()
        if turn == 0: wiped(w, r)
        elif (w.a.state() or {}).get("label") != "Synced": w.a.sign_in()
        if not check(w, r, due, turn): break

@S(30, "Storage wiped with five workspaces and two teams", "As 29 with five workspaces; after signing in Clean is still open, no second folder for either team appears.", many=True)
def _(w, r):
    w.a.quit(); clear_storage(w); w.a.start(); due = w.edits(); wiped(w, r); time.sleep(8)
    check(w, r, due)
    extra = sorted(set(os.listdir(w.a.docs)) - {"Clean", "Lokus", "Notes", "Journal", "Scratch"})
    r.put("window", [f"made new folders: {extra}"] if extra else [])
    w.a.open(w.lokus_root); check(w, r, w.edits(root=w.lokus_root, mate=w.ben2), 1, root=w.lokus_root); w.a.open(w.root)

@S(31, "Only the folder's team entry is lost", "The window's storage loses this folder's team entry (the morning of the incident); restart.")
def _(w, r):
    def trouble(w, edit):
        w.a.do("debug.storage", key=f"lokus.sync:{w.root}"); time.sleep(2); restart(w, edit)
    incident(w, r, trouble)

@S(32, "Team entry lost and the relay down when the app opens", "As 31, with the relay stopped at start; the Team page is looked at before the relay is back; it must not offer Share.")
def _(w, r):
    w.a.do("debug.storage", key=f"lokus.sync:{w.root}"); time.sleep(2); w.a.quit(); relay_down(); w.a.start(); due = w.edits(theirs=False)
    w.a.do("teams.open"); time.sleep(2)
    page = w.a.state() or {}
    offered = [b for b in page.get("buttons", []) if b in BAD or b.startswith("Share ")]
    w.a.picture(f"{r.label}-{r.number:02d}-relay-down"); w.a.do("ui.key", key="Escape")
    r.put("window", ["Team page offers " + "/".join(offered) + " while the relay is down"] if offered else [])
    relay_up(); check(w, r, due)

@S(33, "Team entry and sign-in both lost", "Storage wiped and the relay slow at start; he signs in; no second team named Clean may appear on the relay.")
def _(w, r):
    w.a.quit(); clear_storage(w); os.killpg(procs["relay"].pid, signal.SIGSTOP); w.a.start(); due = w.edits(theirs=False); w.a.sign_in(); time.sleep(5); os.killpg(procs["relay"].pid, signal.SIGCONT)
    check(w, r, due)
    names = [n for (n,) in sqlite3.connect(f"{T}/relay.db").execute("select name from workspaces")]
    r.put("edits", [f"{names.count('Clean')} teams named Clean on the relay"] if names.count("Clean") != 1 else [])

def moved(w, r, to, wipe=False, via=None):
    w.a.quit()
    if via: w.a.start(); w.a.open(via); 
    os.rename(w.root, to); old, w.root = w.root, to
    wrote(w.root, "Assistant.md", f"moved-{w.n}")
    if wipe: clear_storage(w)
    if not via: w.a.start()
    if wipe: w.a.sign_in()
    w.a.open(w.root)
    due = w.edits() + [(w.ben.root, "Assistant.md", f"moved-{w.n - 1}")]
    ok = check(w, r, due)
    grew = sum(rows().values()) - sum(w.before.values())
    r.put("edits", [f"the folder was sent to the relay all over again ({grew} edits)"] if grew > 40 else [])
    if ok: incident(w, r, relay_gone, times=1); r.again = "pass" if r.edits == "pass" and r.window == "pass" else "FAIL: after the move, a relay drop: " + str(r.edits)

@S(34, "The folder is renamed in Finder", "Quit; Clean renamed to Clean notes; start; he opens it. It must still be the team's, with nothing sent twice.")
def _(w, r): moved(w, r, f"{w.a.docs}/Clean notes")

@S(35, "The folder is moved while another workspace is open", "Five workspaces; Notes open; Clean moved into another place on disk; he opens it there.", many=True)
def _(w, r):
    os.makedirs(f"{w.a.home}/Work", exist_ok=True); moved(w, r, f"{w.a.home}/Work/Clean", via=f"{w.a.docs}/Notes")

@S(36, "Folder renamed and the window's storage wiped", "Quit; folder renamed; web storage deleted; start; sign in; open the folder.")
def _(w, r): moved(w, r, f"{w.a.docs}/Clean 2026", wipe=True)

def twin(w):
    """A second team also called Clean, with its own folder here and its own teammate."""
    other = team("ana", "Clean", ("ben", "editor")); w.teams.add(other)
    root = w.folder("Clean (client)"); mate = Mate("ben", other)
    w.a.open(root); w.a.do("sync.connect", server=RELAY, workspace=other); w.a.online()
    return root, mate

@S(37, "Two folders in two teams with the same name", "Two teams both called Clean, a folder for each; sign-in runs out hidden; each folder's edits must reach its own team only.")
def _(w, r):
    root, mate = twin(w)
    for turn in range(2):
        w.a.see(False); time.sleep(RAN_OUT); w.a.see(True)
        due = w.edits(root=root, mate=mate); ok = check(w, r, due, turn, root=root)
        w.a.open(w.root); due = w.edits(); ok = check(w, r, due, max(turn, 1), root=w.root) and ok
        crossed = [l for l in (f"mine-{w.n}",) if has(mate.root, "Mine.md", l)] + [l for l in (f"mine-{w.n - 1}",) if has(w.ben.root, "Mine.md", l)]
        r.put("edits", [f"crossed into the other team: {crossed}"] if crossed else [])
        if not ok: break
        w.a.open(root)
    w.a.open(w.root)

@S(38, "A second team with the same name sits on the relay", "A team also called Clean exists that he owns alone, with no folder here (as after the incident); sign-in lost and restored; restart. Nothing may go to it and the open folder must not change.")
def _(w, r):
    ghost = get(f"{RELAY}/v1/workspaces", token("ana"), "POST", {"name": "Clean"})["id"]; w.mark()
    def trouble(w, edit):
        w.a.do("account.signOut"); time.sleep(3); edit(); w.a.sign_in(); time.sleep(6); restart(w, edit)
    incident(w, r, trouble)
    r.put("edits", [f"{rows()[ghost]} edits went to the second team"] if rows().get(ghost) else [])

@S(39, "The folder is told to sync with another team", "What pressing Share did that morning: the team folder asked to connect to a new team of the same name; then he types.")
def _(w, r):
    ghost = get(f"{RELAY}/v1/workspaces", token("ana"), "POST", {"name": "Clean"})["id"]; w.mark()
    def trouble(w, edit):
        w.a.do("sync.connect", server=RELAY, workspace=ghost); time.sleep(6); edit()
    incident(w, r, trouble)
    r.put("edits", [f"{rows()[ghost]} edits went to the second team"] if rows().get(ghost) else [])

@S(40, "Same-name teams, five workspaces, restart and a run-out sign-in", "Five workspaces plus a second Clean team's folder; quit; sign-in runs out; start. Clean (the first) must be open and each team gets its own edits.", many=True)
def _(w, r):
    root, mate = twin(w); w.a.open(w.root)
    incident(w, r, lambda w, e: restart(w, e, lambda: time.sleep(RAN_OUT)))
    w.a.open(root); due = w.edits(root=root, mate=mate); check(w, r, due, 1, root=root)
    r.put("edits", ["crossed into the other team"] if has(w.ben.root, "Mine.md", f"mine-{w.n}") else []); w.a.open(w.root)

def gone(w, r, how, many):
    """He is no longer in the team, by the relay's own list: syncing ends, and the folder stays open with its notes."""
    how()
    s = until(lambda: (lambda s: s if s and s["label"] == "Sync is off" else None)(w.a.state()), AFTER_OUTAGE) or w.a.state() or {}
    wrong = []
    if s.get("vault") != w.root: wrong.append(f"open folder changed to {os.path.basename(s.get('vault') or 'none')}")
    if s.get("label") != "Sync is off": wrong.append(f"says “{s.get('label')}”")
    w.a.picture(f"{r.label}-{r.number:02d}")
    r.put("window", wrong)
    w.a.typed(w.root, "after-removal"); time.sleep(6)
    r.put("edits", (["notes missing from disk"] if not has(w.root, "Plan.md", "made-up plan") else []) + (["an edit made after removal reached the team"] if has(w.ben.root, "Mine.md", "after-removal") else []) + w.strays())
    w.a.quit(); w.a.start(); s = w.a.state() or {}
    r.put("again", [f"after a restart the open folder is {os.path.basename(s.get('vault') or 'none')}"] if s.get("vault") != w.root else [])

@S(41, "Removed from the team while connected", "Five workspaces; the owner removes him while he is online. The relay's list confirms it: syncing ends, Clean stays open, notes stay.", many=True, role="editor")
def _(w, r): gone(w, r, lambda: get(f"{RELAY}/v1/workspaces/{w.clean}/members/u-ana", token("ben"), "DELETE"), True)

@S(42, "Removed while the Mac slept", "Five workspaces; asleep; the owner removes him; wake.", many=True, role="editor")
def _(w, r):
    def how():
        w.a.see(False); w.a.freeze(True); get(f"{RELAY}/v1/workspaces/{w.clean}/members/u-ana", token("ben"), "DELETE"); time.sleep(RAN_OUT); w.a.freeze(False); w.a.see(True)
    gone(w, r, how, True)

@S(43, "The team is deleted while he is offline", "Five workspaces; relay unreachable for him (app closed); the owner deletes the team; app started.", many=True, role="editor")
def _(w, r):
    def how():
        w.a.quit(); get(f"{RELAY}/v1/workspaces/{w.clean}", token("ben"), "DELETE"); w.a.start()
    gone(w, r, how, True)

@S(44, "Removed and invited back before he returns", "Asleep; the owner removes him, then invites him again and he is in the team again before waking; wake. The folder is still the team's.", role="editor")
def _(w, r):
    def trouble(w, edit):
        w.a.see(False); w.a.freeze(True); get(f"{RELAY}/v1/workspaces/{w.clean}/members/u-ana", token("ben"), "DELETE")
        code = get(f"{RELAY}/v1/workspaces/{w.clean}/invites", token("ben"), "POST", {"role": "editor"})["code"]; get(f"{RELAY}/v1/invites/{code}/accept", token("ana"), "POST")
        edit(mine=False); time.sleep(RAN_OUT); edit(theirs=False); w.a.freeze(False); w.a.see(True)
    incident(w, r, trouble)

@S(45, "A viewer", "He may only read; sign-in runs out hidden; Ben types. Ben's edits arrive, his own stay on this computer, and nothing offers Share.", role="viewer")
def _(w, r):
    incident(w, r, hidden, mine=False)
    w.a.typed(w.root, "viewer-wrote"); time.sleep(6)
    r.put("edits", ["a viewer's edit reached the team"] if has(w.ben.root, "Mine.md", "viewer-wrote") else [])

@S(46, "Made a viewer and an editor again during sleep", "Asleep; the owner makes him a viewer, then an editor again; wake; he types.", role="editor")
def _(w, r):
    def trouble(w, edit):
        w.a.see(False); w.a.freeze(True)
        for role in ("viewer", "editor"): get(f"{RELAY}/v1/workspaces/{w.clean}/members/u-ana", token("ben"), "PATCH", {"role": role}); time.sleep(2)
        time.sleep(RAN_OUT); w.a.freeze(False); w.a.see(True); time.sleep(8); edit()
    incident(w, r, trouble)

@S(47, "He presses Leave", "Five workspaces, Clean open; Team page, Leave, confirm. Only then does the folder stop being the team's; the other team's folder is untouched.", many=True, role="editor")
def _(w, r):
    w.a.do("teams.open"); time.sleep(2); w.a.do("ui.click", text="Leave…"); time.sleep(1); w.a.do("ui.click", text="Leave"); time.sleep(6)
    members = [m.get("user") or m.get("id") for m in get(f"{RELAY}/v1/workspaces/{w.clean}/members", token("ben"))]
    s = w.a.state() or {}
    w.a.picture(f"{r.label}-{r.number:02d}")
    r.put("window", ["still shown as synced with the team he left"] if s.get("vault") == w.root and s.get("label") == "Synced" else [])
    r.put("edits", (["still a member on the relay"] if "u-ana" in members else []) + (["notes missing from disk"] if not has(w.root, "Plan.md", "made-up plan") else []))
    w.a.open(w.lokus_root); w.root, w.ben = w.lokus_root, w.ben2
    r.put("again", w.arrived(w.edits()) + w.window())

@S(48, "Thirty edits a side through relay and account-service drops", "Relay and account service each dropped twice while 30 lines are typed here and 30 by Ben; every line must arrive once, in the right team.")
def _(w, r):
    def trouble(w, edit):
        for n in range(30):
            if n in (5, 20): relay_down()
            if n in (10, 25): relay_up()
            if n == 8: auth(offline=1)
            if n == 28: auth(offline=0)
            edit()
    incident(w, r, trouble, times=1)
    twice = [f"mine-{n}" for n in range(1, w.n + 1) if open(f"{w.ben.root}/Mine.md").read().count(f"mine-{n}\n") > 1]
    r.put("edits", [f"arrived twice: {twice[:5]}"] if twice else []); r.again = r.edits if r.window == "pass" else r.window

@S(49, "Going round five workspaces while the sign-in runs out", "Three rounds through all five workspaces across a hidden sign-in run-out; he ends on Clean; each team got its own edits.", many=True)
def _(w, r):
    for turn in range(3):
        w.a.see(False); time.sleep(RAN_OUT if turn == 0 else 5); w.a.see(True)
        for root in (w.lokus_root, f"{w.a.docs}/Notes", f"{w.a.docs}/Journal", f"{w.a.docs}/Scratch", w.lokus_root): w.a.open(root)
        due = w.edits(root=w.lokus_root, mate=w.ben2); ok = check(w, r, due, turn, root=w.lokus_root)
        w.a.open(w.root); ok = check(w, r, w.edits(), max(turn, 1)) and ok
        r.put("edits", ["crossed into the other team"] if has(w.ben.root, "Mine.md", f"mine-{w.n - 1}") else [])
        if not ok: break

@S(50, "Everything at once", "Five workspaces; asleep past the sign-in's life; on wake the relay is down and the account service unreachable; Ben, the assistant and he all write; then both come back.", many=True)
def _(w, r):
    def trouble(w, edit):
        auth(offline=1); relay_down(); asleep(w, edit); time.sleep(10); edit(theirs=False); relay_up(); time.sleep(5); auth(offline=0)
    incident(w, r, trouble)

# ---- running them -------------------------------------------------------------------------------

def run(label, numbers):
    services()
    out = f"{T}/{label}.json"
    done = json.load(open(out)) if os.path.exists(out) else {}
    for number in numbers or sorted(ALL):
        s = ALL[number]; r = Result(); r.label, r.number = label, number
        began = time.time(); patient[0] = SOON
        try:
            w = World(s["many"], s["role"], s["start"])
            s["run"](w, r)
        except Exception as e:  # an incident that cannot even be set up is a failure of that incident, not of the run
            r.notes.append(f"stopped: {type(e).__name__}: {e}")
            for f in ("window", "edits", "again"):
                if getattr(r, f) is None: setattr(r, f, f"FAIL: {r.notes[-1]}")
        finally:
            for name in [n for n in procs if n.startswith("app")]:
                try: os.kill(procs[name].pid, signal.SIGCONT)
                except OSError: pass
            if "relay" in procs:
                try: os.killpg(procs["relay"].pid, signal.SIGCONT)
                except OSError: pass
        done[str(number)] = dict(title=s["title"], steps=s["steps"], window=r.window or "pass", edits=r.edits or "pass", again=r.again or "pass", notes=r.notes, seconds=round(time.time() - began))
        json.dump(done, open(out, "w"), indent=1)
        print(f"{number:2d} {s['title']}\n     window: {done[str(number)]['window']}\n     edits:  {done[str(number)]['edits']}\n     again:  {done[str(number)]['again']}" + "".join(f"\n     note:   {n}" for n in r.notes), flush=True)
    for name in list(procs): stop(name)
    passed = sum(all(v[f] == "pass" for f in ("window", "edits", "again")) for v in done.values())
    print(f"{passed} of {len(done)} incidents pass all three")

def table(before, after):
    b, a = json.load(open(f"{T}/{before}.json")), json.load(open(f"{T}/{after}.json"))
    short = lambda v: "pass" if v == "pass" else v
    lines = ["# Fifty incidents: a team folder stays in its team", "", f"Run on the real desktop app with a local relay and a stand-in account service, made-up people. `{before}` is the head of `next`, `{after}` is this change.", "",
             "Three verdicts each: **window** (what the real window shows), **edits** (which team on the relay got what; nothing lost or misrouted), **again** (the same incident repeated).", ""]
    for n in sorted(ALL):
        x, y = b.get(str(n)), a.get(str(n))
        lines += [f"## {n}. {ALL[n]['title']}", "", ALL[n]["steps"], ""]
        for name, run_ in ((before, x), (after, y)):
            if not run_: lines += [f"- {name}: not run"]; continue
            lines += [f"- **{name}** window: {short(run_['window'])}", f"  - edits: {short(run_['edits'])}", f"  - again: {short(run_['again'])}"] + [f"  - note: {m}" for m in run_["notes"]]
        lines.append("")
    count = lambda d: sum(all(v[f] == "pass" for f in ("window", "edits", "again")) for v in d.values())
    lines[4:4] = [f"**{before}: {count(b)} of {len(b)} pass all three. {after}: {count(a)} of {len(a)}.**", ""]
    open(f"{T}/team-stays-results.md", "w").write("\n".join(lines) + "\n")
    print(f"{T}/team-stays-results.md")

if __name__ == "__main__":
    if len(sys.argv) > 3 and sys.argv[1] == "table": table(sys.argv[2], sys.argv[3])
    elif len(sys.argv) > 1: run(sys.argv[1], [int(n) for n in sys.argv[2:]])
    else: print(__doc__)
