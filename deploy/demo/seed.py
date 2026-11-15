#!/usr/bin/env python3
"""Fill a folder with a made-up startup's workspace, for demos and for recording a video.

    python3 deploy/demo/seed.py ~/Documents/Northstar

Everything is written through the same commands the app and the assistant use, so the
Customers list, the task board and Noticed show it exactly as they would real work. The
company (Northstar, a scheduling tool for clinics) and everyone in it are invented. Dates are
set around today, so "4 days ago" is true on the day it is run. Running it twice adds nothing.
"""
import datetime
import json
import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOKUS = os.path.join(ROOT, "target", "debug", "lokus")
VAULT = os.path.abspath(os.path.expanduser(sys.argv[1])) if len(sys.argv) > 1 else sys.exit(__doc__)
NOW = datetime.datetime.now(datetime.timezone.utc).replace(minute=0, second=0, microsecond=0)


def ago(days, hour=15, minute=0):
    at = (NOW - datetime.timedelta(days=days)).replace(hour=hour, minute=minute)
    return at.strftime("%Y-%m-%dT%H:%M:%SZ")


def day(days):
    return (NOW + datetime.timedelta(days=days)).strftime("%Y-%m-%d")


def said(days):
    return (NOW - datetime.timedelta(days=days)).strftime("%b %-d")


def run(command, args):
    done = subprocess.run([LOKUS, command, "--vault", VAULT, "--json", json.dumps(args)], capture_output=True, text=True)
    if done.returncode != 0 and "already exists" not in done.stdout + done.stderr:
        print(f"  {command} failed: {(done.stdout or done.stderr).strip()[:200]}")
    return done.stdout


def customer(fact):
    # A conversation is filed message by message, as the assistant files one.
    many = fact.pop("events", [])
    if len(fact) > 2 or not many:
        run("customers.record", {"fact": fact})
    for event in many:
        run("customers.record", {"fact": {"customer": fact["customer"], "source": fact.get("source"), "event": event}})


def note(path, text):
    run("note.create", {"path": path, "text": text})


os.makedirs(VAULT, exist_ok=True)
print(f"Filling {VAULT}")

# Customers: who they are, the people there, and what has happened with each.
customer({"customer": "kestrelbank.com", "name": "Kestrel Bank", "source": "stripe",
          "set": {"plan": "Scale", "mrr": 4800, "owner": "Pratham", "health": "at risk", "renewal": day(18), "seats": 120, "segment": "Enterprise"},
          "person": {"name": "Dana Whitlock", "email": "dana@kestrelbank.com", "role": "Head of Operations"}})
customer({"customer": "kestrelbank.com", "person": {"name": "Omar Reyes", "email": "omar@kestrelbank.com", "role": "IT lead"}})
customer({"customer": "kestrelbank.com", "source": "slack", "events": [
    {"id": "k1", "kind": "message", "thread": "export", "direction": "in", "from": "Dana Whitlock", "at": ago(4, 14, 5),
     "text": "The CSV export has failed three times this week on our biggest clinic group. Finance needs it for month end."},
    {"id": "k2", "kind": "message", "thread": "export", "direction": "out", "from": "Maya", "at": ago(4, 14, 40),
     "text": "Sorry about that, Dana. We can reproduce it on workspaces over 50k appointments. Raj is on it."},
    {"id": "k3", "kind": "message", "thread": "export", "direction": "in", "from": "Dana Whitlock", "at": ago(1, 9, 12),
     "text": "Any update? Our renewal conversation is next week and this keeps coming up internally."},
]})
customer({"customer": "kestrelbank.com", "source": "linear",
          "event": {"id": "ENG-412", "kind": "issue", "title": "CSV export times out over 50k appointments", "status": "in progress", "from": "Dana Whitlock", "at": ago(4, 15),
                    "text": "Export job is killed at 60 seconds. Three reports from Kestrel this week."}})
customer({"customer": "kestrelbank.com", "source": "granola",
          "event": {"id": "qbr-nov", "kind": "meeting", "title": "Quarterly review with Kestrel", "from": "Pratham", "at": ago(12, 17),
                    "text": "Dana wants SSO before renewal and a named contact for incidents. Omar asked for an audit log export. Happy with scheduling accuracy."}})

customer({"customer": "brightline.co", "name": "Brightline Clinics", "source": "stripe",
          "set": {"plan": "Team", "mrr": 1900, "owner": "Maya", "health": "watch", "renewal": day(9), "seats": 45, "segment": "Mid-market"},
          "person": {"name": "Priya Nair", "email": "priya@brightline.co", "role": "Clinic director"}})
customer({"customer": "brightline.co", "source": "email", "events": [
    {"id": "b1", "kind": "message", "thread": "pricing", "direction": "in", "from": "Priya Nair", "at": ago(9, 11),
     "text": "We are opening two more clinics in January. What would the price be for 70 seats, and is there a discount for paying yearly?"},
]})

customer({"customer": "orbitrobotics.com", "name": "Orbit Robotics", "source": "stripe",
          "set": {"plan": "Scale", "mrr": 6200, "owner": "Pratham", "health": "good", "renewal": day(140), "seats": 210, "segment": "Enterprise"},
          "person": {"name": "Lena Fischer", "email": "lena@orbitrobotics.com", "role": "People operations"}})
customer({"customer": "orbitrobotics.com", "source": "stripe",
          "event": {"id": "pay-oct", "kind": "event", "title": "Paid $6,200 for November", "at": ago(13, 8)}})
customer({"customer": "orbitrobotics.com", "source": "slack", "events": [
    {"id": "o1", "kind": "message", "thread": "thanks", "direction": "in", "from": "Lena Fischer", "at": ago(2, 16),
     "text": "The new shift-swap flow cut our scheduling emails in half. The team loves it. Happy to be a reference."},
]})

customer({"customer": "meridianschools.org", "name": "Meridian Schools", "source": "stripe",
          "set": {"plan": "Team", "mrr": 1200, "owner": "Raj", "health": "good", "renewal": day(63), "seats": 30, "segment": "Education"},
          "person": {"name": "Tomas Alvarez", "email": "tomas@meridianschools.org", "role": "Operations manager"}})
customer({"customer": "fablestudio.io", "name": "Fable Studio", "source": "stripe",
          "set": {"plan": "Starter", "mrr": 290, "owner": "Maya", "health": "good", "renewal": day(27), "seats": 8, "segment": "Small business"},
          "person": {"name": "June Park", "email": "june@fablestudio.io", "role": "Founder"}})
customer({"customer": "fablestudio.io", "source": "linear",
          "event": {"id": "ENG-398", "kind": "issue", "title": "Calendar sync skips recurring events", "status": "done", "from": "June Park", "at": ago(6, 10),
                    "text": "Fixed in the Nov 9 release."}})
customer({"customer": "harborvet.com", "name": "Harbor Vet Group", "source": "stripe",
          "set": {"plan": "Team", "mrr": 1450, "owner": "Maya", "health": "watch", "renewal": day(41), "seats": 36, "segment": "Mid-market"},
          "person": {"name": "Sam Okafor", "email": "sam@harborvet.com", "role": "Practice manager"}})
customer({"customer": "harborvet.com", "source": "email", "events": [
    {"id": "h1", "kind": "message", "thread": "reminders", "direction": "in", "from": "Sam Okafor", "at": ago(7, 13),
     "text": "Text reminders went out an hour late twice last week. Clients are showing up at the wrong time."},
]})

# Tasks: the board the team works from.
for task in [
    {"title": "Fix the CSV export for large workspaces", "status": "doing", "priority": "urgent", "assignee": "Raj", "customer": "Kestrel Bank", "labels": ["bug", "churn-risk"], "due": day(2),
     "text": "Export is killed at 60 seconds over 50k appointments. Kestrel reported it three times. See [[Kestrel Bank]]."},
    {"title": "Send Brightline a quote for 70 seats", "status": "todo", "priority": "high", "assignee": "Maya", "customer": "Brightline Clinics", "labels": ["request", "expansion"], "due": day(1),
     "text": "Priya asked nine days ago. Renewal is close. Pricing is in [[Pricing v2]]."},
    {"title": "Ship SSO for Scale plans", "status": "doing", "priority": "high", "assignee": "Raj", "customer": "Kestrel Bank", "labels": ["feature"], "due": day(12),
     "text": "Kestrel wants it before renewal. Spec in [[SSO spec]]."},
    {"title": "Find why text reminders run late", "status": "todo", "priority": "high", "assignee": "Raj", "customer": "Harbor Vet Group", "labels": ["bug"],
     "text": "Twice last week for Harbor Vet. Probably the queue backing up at 8am."},
    {"title": "Write the audit log export", "status": "backlog", "priority": "medium", "assignee": "Raj", "customer": "Kestrel Bank", "labels": ["feature"],
     "text": "Omar asked in the quarterly review."},
    {"title": "Ask Orbit Robotics for a case study", "status": "todo", "priority": "medium", "assignee": "Pratham", "customer": "Orbit Robotics", "labels": ["marketing"],
     "text": "Lena offered to be a reference."},
    {"title": "Publish the November changelog", "status": "review", "priority": "medium", "assignee": "Maya", "labels": ["marketing"], "due": day(3),
     "text": "Draft is in [[November changelog]]."},
    {"title": "Move onboarding emails to the new template", "status": "backlog", "priority": "low", "assignee": "Maya", "labels": ["growth"]},
    {"title": "Fix recurring events in calendar sync", "status": "done", "priority": "high", "assignee": "Raj", "customer": "Fable Studio", "labels": ["bug"],
     "text": "Shipped in the Nov 9 release."},
    {"title": "Renew the SOC 2 audit", "status": "todo", "priority": "medium", "assignee": "Pratham", "labels": ["compliance"], "due": day(21)},
]:
    run("tasks.record", {"task": task})

# The two list pages setup makes: every customer, and the board.
note("Customers.md", "---\nview: customers\nsource: customers\n---\n")
note("Tasks.md", "---\nview: tasks\n---\n")

# Notes: the plans and write-ups a team keeps, linked to each other.
note("Roadmap.md", f"""---
icon: 🧭
---
# Roadmap

What Northstar ships this quarter, in the order we agreed at the [[Weekly sync]].

## Now

- **Large exports.** The fix for [[Kestrel Bank]] and anyone over 50k appointments.
- **SSO for Scale plans.** See the [[SSO spec]]. Needed before Kestrel renews on {day(18)}.

## Next

- Audit log export
- Reminder queue rework, after the late texts at [[Harbor Vet Group]]

## Later

- Self-serve seat changes, so quotes like the one [[Brightline Clinics]] asked for need nobody
- A public API

Pricing changes are tracked in [[Pricing v2]].
""")
note("Weekly sync.md", f"""---
icon: 🗓️
---
# Weekly sync

## {said(2)}

**There:** Pratham, Maya, Raj

- Export fix is the top priority. Raj has a streaming version working locally and wants two more days.
- Maya has not sent Brightline their quote yet. It waits on the yearly discount in [[Pricing v2]].
- Orbit Robotics offered to be a reference. Pratham will ask for a case study.
- Late reminders at Harbor Vet: nobody owns it yet.

**Decided**

1. Export fix ships before anything else.
2. Yearly discount is 15%, so the Brightline quote can go out.

## {said(9)}

- Recurring-event bug for [[Fable Studio]] shipped.
- Quarterly review with [[Kestrel Bank]] went well; they want SSO.
""")
note("Pricing v2.md", """---
icon: 💳
---
# Pricing v2

| Plan | Per seat, monthly | Seats | Includes |
| --- | --- | --- | --- |
| Starter | $36 | up to 10 | Scheduling, reminders |
| Team | $42 | up to 100 | Everything in Starter, calendar sync, reports |
| Scale | $40 | 100 and up | Everything in Team, SSO, audit log, a named contact |

Paying yearly takes 15% off. Decided at the [[Weekly sync]].

A quote for 70 Team seats, yearly: 70 × $42 × 12 × 0.85 = **$29,988**.
""")
note("SSO spec.md", """---
icon: 🔐
status: in progress
owner: Raj
---
# SSO spec

Single sign-on for Scale plans, asked for by [[Kestrel Bank]].

## What it does

- Sign in with Okta, Google Workspace or Microsoft Entra
- New people are added to the right clinic from their group
- An owner can require SSO for everyone

## Open questions

- Do we support SCIM in the first version, or only sign-in?
- Who is the named contact for incidents that Dana asked for?
""")
note("November changelog.md", """# November changelog

- **Shift swaps.** Staff can trade shifts and a manager approves with one tap.
- **Recurring events** now sync to Google and Outlook calendars.
- **Faster reports.** The weekly report loads in under a second.

Coming next: exports for very large workspaces, and SSO.
""")
note("How we work/Support.md", """# Support

- Answer every customer the same day, even if the answer is "we are looking".
- A bug that a customer reported gets a task with their name on it, so it shows on their page.
- When a fix ships, tell the people who asked. Do not wait for them to notice.
""")
note("How we work/Onboarding a clinic.md", """# Onboarding a clinic

1. Import their staff list from a CSV.
2. Set opening hours and appointment types.
3. Connect their calendar.
4. Send the first week of reminders with us watching.

Most clinics are live in three days. [[Orbit Robotics]] took one.
""")

# Files that are not notes: a table, so there is one to open and to ask the assistant about.
run("file.write", {"path": "data/MRR by customer.csv", "text": "Customer,Plan,Seats,MRR,Health,Renewal\n"
    f"Orbit Robotics,Scale,210,6200,good,{day(140)}\nKestrel Bank,Scale,120,4800,at risk,{day(18)}\n"
    f"Brightline Clinics,Team,45,1900,watch,{day(9)}\nHarbor Vet Group,Team,36,1450,watch,{day(41)}\n"
    f"Meridian Schools,Team,30,1200,good,{day(63)}\nFable Studio,Starter,8,290,good,{day(27)}\n"})

# Noticed: what the assistant found on its own.
for key, item in [
    ("waiting kestrel export", {
        "title": "Kestrel Bank has waited 4 days on the export bug",
        "summary": f"Dana asked again yesterday and their renewal is **{said(-18)}**.",
        "evidence": [
            {"text": f"{said(4)}: Dana reported **three failed exports**", "source": "slack"},
            {"text": f"{said(4)}: ENG-412 opened, still **in progress**", "source": "linear"},
            {"text": f"{said(1)}: Dana asked for an update, **no reply yet**", "source": "slack"},
            {"text": f"{said(3)}: a fix shipped, switched **off** for Kestrel", "source": "northstar admin"},
        ],
        "metric": "4 days", "recommend": "Turn the export fix on for Kestrel, retry it, and tell Dana",
        "action": "Use the northstar API. Read GET /v1/admin/deploys and GET /v1/admin/exports?workspace=kestrel-bank&status=failed. The streaming export shipped behind the switch streaming_export, which is off for Kestrel: turn it on with POST /v1/admin/flags {workspace: kestrel-bank, flag: streaming_export, on: true}, then retry the newest failed export with POST /v1/admin/exports/{id}/retry. If it succeeds, set the task 'Fix the CSV export for large workspaces' to review and write Dana Whitlock a short reply saying the export works now.",
        "situation": "a customer near renewal is waiting on a bug that is already being fixed",
        "customer": "Kestrel Bank", "urgency": "now", "confidence": "read",
        "if_ignored": "A $4,800 a month account walks into renewal with an open complaint"}),
    ("waiting brightline quote", {
        "title": "Brightline asked for a quote 9 days ago",
        "summary": "They are adding **25 seats** and nobody has answered. The price is already decided.",
        "evidence": [
            {"text": f"{said(9)}: Priya asked the price for **70 seats**, yearly", "source": "email"},
            {"text": f"{said(2)}: yearly discount set at **15%**", "source": "Weekly sync"},
            {"text": "Pricing v2 works it out: **$29,988** a year", "source": "Pricing v2"},
        ],
        "metric": "9 days", "recommend": "Make the $29,988 yearly quote as a PDF for Priya",
        "action": "Make a one-page PDF quote for Brightline Clinics with create_pdf, saved as quotes/Brightline quote.pdf: 70 Team seats, paid yearly, $42 a seat a month less 15%, $29,988 a year, taken from the note Pricing v2, addressed to Priya Nair. Then set the task 'Send Brightline a quote for 70 seats' to review.",
        "situation": "a customer asked for a price that has since been decided",
        "customer": "Brightline Clinics", "urgency": "now", "confidence": "read",
        "if_ignored": "An expansion worth about $1,000 a month more goes cold before renewal"}),
    ("unowned harbor reminders", {
        "title": "Nobody owns the late reminders at Harbor Vet",
        "summary": "Sam reported it **7 days ago**; the sync notes say it has no owner.",
        "evidence": [
            {"text": f"{said(7)}: reminders went out **an hour late** twice", "source": "email"},
            {"text": f"{said(2)}: 'nobody owns it yet'", "source": "Weekly sync"},
        ],
        "metric": "7 days", "recommend": "Assign the reminder task to Raj, due this week",
        "action": "Update the task 'Find why text reminders run late' with record_task: assignee Raj, priority high, status todo, and add to its text what GET /v1/admin/reminders/queue on the northstar API says about the 08:00 batch.",
        "situation": "a customer bug has a task but no owner",
        "customer": "Harbor Vet Group", "urgency": "soon", "confidence": "read",
        "if_ignored": "Clients keep arriving at the wrong time and Harbor Vet stays on watch"}),
    ("good orbit reference", {
        "title": "Orbit Robotics offered to be a reference",
        "summary": "Lena said shift swaps **halved** their scheduling emails. Worth a case study.",
        "evidence": [{"text": f"{said(2)}: 'Happy to be a reference'", "source": "slack"}],
        "recommend": "Ask Lena for a 20-minute call for a case study",
        "situation": "a happy customer offers to be a reference",
        "customer": "Orbit Robotics", "urgency": "fyi", "confidence": "read",
        "if_ignored": "A warm offer from the biggest account is forgotten"}),
]:
    # Written fresh each run, so a card someone acted on while rehearsing is whole again.
    subprocess.run([LOKUS, "noticed.remove", "--vault", VAULT, "--json", json.dumps({"id": key.replace(" ", "-")})], capture_output=True)
    run("noticed.report", {"key": key, "item": {"kind": "finding", **item}})

print("Done. Open it in Lokus: workspace name at the top of the sidebar, Open a folder as a workspace.")
