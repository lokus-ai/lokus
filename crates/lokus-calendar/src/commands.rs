//! @part-of calendar
//! Every calendar feature as a named command, JSON in and JSON out. The command line, the app,
//! shortcuts and the assistant all come through `run`; `COMMANDS` is the one list of them.

use std::path::Path;

use chrono::{Datelike, Duration, TimeZone, Timelike, Utc};
use serde_json::{json, Value};

use crate::model::{bad, differ, key, split, stamp, time, Account, CalError, Event, Guest, Result};
use crate::store::{Held, Store};
use crate::{auth, notes, provider, sync, team};

pub struct Spec {
    pub name: &'static str,
    pub about: &'static str,
    /// The arguments, as `name: what it is` lines.
    pub args: &'static [(&'static str, &'static str, &'static str)],
    /// Sends an invitation or changes an event or a setting: the assistant asks first.
    pub writes: bool,
}

const EVENT_ARGS: &[(&str, &str, &str)] = &[
    ("title", "string", "What it is called"),
    (
        "start",
        "string",
        "When it starts, like 2026-12-01T15:00:00Z",
    ),
    ("end", "string", "When it ends"),
    ("all_day", "boolean", "It takes the whole day"),
    ("zone", "string", "Its time zone, like Europe/Berlin"),
    ("location", "string", "Where"),
    ("description", "string", "Notes for the guests"),
    (
        "guests",
        "array",
        "Guests: email addresses, or {email, optional}",
    ),
    ("meeting", "boolean", "Add a Google Meet or Teams link"),
    (
        "repeat",
        "string",
        "A repeat rule like RRULE:FREQ=WEEKLY;BYDAY=MO, or empty for none",
    ),
    (
        "send",
        "boolean",
        "Send it to the guests now instead of holding it as pending changes",
    ),
    (
        "notify",
        "boolean",
        "Email the guests when it is sent (default true)",
    ),
];

pub const COMMANDS: &[Spec] = &[
    Spec { name: "calendar.status", about: "The connected calendar accounts, their calendars, and what is waiting to be sent.", args: &[], writes: false },
    Spec { name: "calendar.account.add", about: "Connect a Google or Microsoft 365 account: opens the provider's sign-in in the browser.", args: &[("provider", "string", "google or microsoft")], writes: true },
    Spec { name: "calendar.account.remove", about: "Disconnect a calendar account and forget its sign-in and local copy.", args: &[("account", "string", "The account, like google:ana@acme.test")], writes: true },
    Spec { name: "calendar.calendars.set", about: "Hide or show a calendar, change its colour, or make it where new events go.", args: &[("account", "string", "The account"), ("calendar", "string", "The calendar's id"), ("hidden", "boolean", "Hide it"), ("color", "string", "A colour like #4f7cff"), ("default", "boolean", "New events go here")], writes: true },
    Spec { name: "calendar.events", about: "The events between two times, from the local copy.", args: &[("from", "string", "Start, like 2026-12-01T00:00:00Z"), ("to", "string", "End")], writes: false },
    Spec { name: "calendar.event.get", about: "One event.", args: &[("key", "string", "The event's key")], writes: false },
    Spec { name: "calendar.event.create", about: "Make an event. With guests it is held until sent (send=true, or calendar.event.send).", args: &[("account", "string", "The account to make it on (default: the default calendar's)"), ("calendar", "string", "The calendar (default: the default calendar)"), ("title", "string", "What it is called"), ("start", "string", "When it starts, like 2026-12-01T15:00:00Z"), ("end", "string", "When it ends"), ("all_day", "boolean", "It takes the whole day"), ("zone", "string", "Its time zone, like Europe/Berlin"), ("location", "string", "Where"), ("description", "string", "Notes for the guests"), ("guests", "array", "Guests: email addresses, or {email, optional}"), ("meeting", "boolean", "Add a Google Meet or Teams link"), ("repeat", "string", "A repeat rule like RRULE:FREQ=WEEKLY;BYDAY=MO"), ("send", "boolean", "Send the invitation now"), ("notify", "boolean", "Email the guests (default true)")], writes: true },
    Spec { name: "calendar.event.update", about: "Change an event. If it has guests the change is held as pending until sent.", args: &[("key", "string", "The event's key"), ("scope", "string", "For a repeating event: this (default) or all")], writes: true },
    Spec { name: "calendar.event.send", about: "Send an event's held changes to the provider: the invitation, or one update.", args: &[("key", "string", "The event's key"), ("notify", "boolean", "Email the guests (default true)")], writes: true },
    Spec { name: "calendar.event.discard", about: "Drop an event's held changes.", args: &[("key", "string", "The event's key")], writes: true },
    Spec { name: "calendar.event.delete", about: "Delete an event.", args: &[("key", "string", "The event's key"), ("scope", "string", "For a repeating event: this (default) or all"), ("notify", "boolean", "Email the guests (default true)")], writes: true },
    Spec { name: "calendar.event.reply", about: "Answer an invitation.", args: &[("key", "string", "The event's key"), ("reply", "string", "yes, no or maybe"), ("scope", "string", "For a repeating event: this (default) or all")], writes: true },
    Spec { name: "calendar.sync", about: "Send what is waiting and read what changed at the providers.", args: &[], writes: false },
    Spec { name: "calendar.busy", about: "When people are busy, asked of their calendar provider. Times only.", args: &[("emails", "array", "Email addresses"), ("from", "string", "Start"), ("to", "string", "End")], writes: false },
    Spec { name: "calendar.team.publish", about: "Write this person's busy times, without titles, into the open team folder.", args: &[], writes: true },
    Spec { name: "calendar.team", about: "The team's busy times as last synced into the open folder, each with its age.", args: &[], writes: false },
    Spec { name: "calendar.find_time", about: "Times when several people are all free.", args: &[("emails", "array", "Email addresses"), ("minutes", "number", "How long (default 30)"), ("from", "string", "Earliest (default now)"), ("to", "string", "Latest (default a week on)"), ("zone", "string", "Time zone for working hours"), ("first_hour", "number", "Working day starts (default 9)"), ("last_hour", "number", "Working day ends (default 18)")], writes: false },
    Spec { name: "calendar.block", about: "Block a time on another calendar: a plain 'Busy' event with no details.", args: &[("account", "string", "The account to block it on"), ("calendar", "string", "The calendar (default: that account's main one)"), ("key", "string", "The event whose time to block; or give start and end"), ("start", "string", "Start"), ("end", "string", "End"), ("title", "string", "What to call it (default Busy)")], writes: true },
    Spec { name: "calendar.note", about: "The meeting note of an event: a Markdown note in the open folder with the time and guests filled in.", args: &[("key", "string", "The event's key"), ("zone", "string", "Time zone to write the time in"), ("shared", "boolean", "Write it even though this folder syncs to a team (asked for once)")], writes: true },
    Spec { name: "calendar.briefing", about: "The day's events in order, as a short briefing.", args: &[("zone", "string", "Time zone"), ("date", "string", "The day, like 2026-12-01 (default today)")], writes: false },
];

fn text<'a>(args: &'a Value, name: &str) -> Option<&'a str> {
    args[name].as_str().map(str::trim).filter(|s| !s.is_empty())
}

fn need<'a>(args: &'a Value, name: &str) -> Result<&'a str> {
    text(args, name).ok_or_else(|| bad(format!("'{name}' is needed")))
}

fn emails(args: &Value) -> Vec<String> {
    match &args["emails"] {
        Value::String(s) => s
            .split(',')
            .map(|e| e.trim().to_lowercase())
            .filter(|e| !e.is_empty())
            .collect(),
        other => other
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|e| e.as_str())
            .map(|e| e.trim().to_lowercase())
            .collect(),
    }
}

fn guests(value: &Value, old: &[Guest]) -> Vec<Guest> {
    let listed: Vec<Value> = match value {
        Value::String(s) => s
            .split(',')
            .map(|e| json!(e.trim()))
            .filter(|e| e != "")
            .collect(),
        other => other.as_array().cloned().unwrap_or_default(),
    };
    listed
        .iter()
        .filter_map(|g| {
            let email = g.as_str().or(g["email"].as_str())?.trim().to_lowercase();
            let was = old.iter().find(|o| o.email.eq_ignore_ascii_case(&email));
            Some(Guest {
                name: g["name"]
                    .as_str()
                    .map(str::to_string)
                    .or(was.map(|w| w.name.clone()))
                    .unwrap_or_default(),
                optional: g["optional"]
                    .as_bool()
                    .unwrap_or(was.is_some_and(|w| w.optional)),
                reply: was
                    .map(|w| w.reply.clone())
                    .unwrap_or_else(|| "needsAction".into()),
                email,
            })
        })
        .filter(|g| g.email.contains('@'))
        .collect()
}

/// Lay the given fields over an event.
fn apply(event: &mut Event, args: &Value) -> Result<()> {
    if let Some(v) = args["title"].as_str() {
        event.title = v.to_string();
    }
    if let Some(v) = text(args, "start") {
        event.start = stamp(time(v)?);
    }
    if let Some(v) = text(args, "end") {
        event.end = stamp(time(v)?);
    }
    if let Some(v) = args["all_day"].as_bool() {
        event.all_day = v;
    }
    if let Some(v) = args["zone"].as_str() {
        if !v.is_empty() && v.parse::<chrono_tz::Tz>().is_err() {
            return Err(bad(format!("'{v}' is not a time zone like Europe/Berlin")));
        }
        event.zone = v.to_string();
    }
    if let Some(v) = args["location"].as_str() {
        event.location = v.to_string();
    }
    if let Some(v) = args["description"].as_str() {
        event.description = v.to_string();
    }
    if !args["guests"].is_null() {
        event.guests = guests(&args["guests"], &event.guests);
    }
    if let Some(v) = args["meeting"].as_bool() {
        event.want_meeting = v;
        if !v {
            event.meeting = None;
        }
    }
    if let Some(v) = args["repeat"].as_str() {
        event.repeat = Some(v.trim()).filter(|r| !r.is_empty()).map(|r| {
            if r.starts_with("RRULE:") {
                r.to_string()
            } else {
                format!("RRULE:{r}")
            }
        });
    }
    if event.start.is_empty() || event.end.is_empty() {
        return Err(bad("'start' and 'end' are needed"));
    }
    if event.end <= event.start {
        return Err(bad("an event ends after it starts"));
    }
    Ok(())
}

fn status(dir: &Path) -> Result<Value> {
    let available = json!({ "google": auth::endpoints(crate::Provider::Google).is_some(),
        "microsoft": auth::endpoints(crate::Provider::Microsoft).is_some(),
        "stand_in": auth::endpoints(crate::Provider::Google).is_some_and(|e| e.stand_in)
            || auth::endpoints(crate::Provider::Microsoft).is_some_and(|e| e.stand_in) });
    if !Store::exists(dir) {
        return Ok(
            json!({ "accounts": [], "calendars": [], "waiting": [], "synced": null, "available": available }),
        );
    }
    let store = Store::open(dir)?;
    let accounts: Vec<Value> = store
        .accounts()?
        .into_iter()
        .map(|a| {
            let signed_in = auth::kept(&a.id).is_some();
            let mut v = serde_json::to_value(a).unwrap_or_default();
            v["signed_in"] = json!(signed_in);
            v
        })
        .collect();
    Ok(
        json!({ "accounts": accounts, "calendars": store.calendars()?, "waiting": store.waiting()?,
        "synced": store.setting("synced")?, "available": available }),
    )
}

async fn add_account(
    dir: &Path,
    args: &Value,
    show: &(dyn Fn(&str) + Send + Sync),
) -> Result<Value> {
    let which = crate::Provider::from_id(need(args, "provider")?)?;
    let tokens = auth::sign_in(which, |url| show(url)).await?;
    // Who it is is only known once signed in: the sign-in waits under a name of its own.
    let slot = format!("new-{}", uuid::Uuid::new_v4().simple());
    auth::keep(&slot, &tokens);
    let found = provider::me(which, &slot).await;
    auth::forget(&slot);
    let (email, name) = found?;
    if email.is_empty() {
        return Err(CalError::new(
            "sign_in",
            "Sign-in worked but the provider did not say whose calendar it is.",
        ));
    }
    let account = Account {
        id: format!("{}:{email}", which.id()),
        provider: which,
        email,
        name,
    };
    auth::keep(&account.id, &tokens);
    let store = Store::open(dir)?;
    store.add_account(&account)?;
    store.retry(&account.id)?;
    drop(store);
    let synced = sync::run(dir).await?;
    Ok(json!({ "account": account, "sync": synced }))
}

/// Where a new event goes: the calendar named, the account's main one, or the default.
fn target(store: &Store, args: &Value) -> Result<(String, String)> {
    let calendars = store.calendars()?;
    match (text(args, "account"), text(args, "calendar")) {
        (Some(a), Some(c)) => calendars.iter().find(|x| x.account == a && x.id == c),
        (Some(a), None) => calendars
            .iter()
            .find(|x| x.account == a && x.primary)
            .or(calendars.iter().find(|x| x.account == a)),
        (None, Some(c)) => calendars.iter().find(|x| x.id == c),
        (None, None) => {
            return store
                .default_calendar()?
                .ok_or_else(|| CalError::new("no_account", "Connect a calendar account first."))
        }
    }
    .map(|c| (c.account.clone(), c.id.clone()))
    .ok_or_else(|| bad("no such calendar on a connected account"))
}

fn create(dir: &Path, args: &Value) -> Result<Value> {
    let store = Store::open(dir)?;
    let (account, calendar) = target(&store, args)?;
    let id = format!("local-{}", uuid::Uuid::new_v4().simple());
    let me = store.account(&account)?;
    let mut event = Event {
        key: key(&account, &calendar, &id),
        account: account.clone(),
        calendar,
        id,
        organizer: me.email,
        mine: true,
        ..Event::default()
    };
    apply(&mut event, args)?;
    let notify = args["notify"].as_bool().unwrap_or(true);
    if event.guests.is_empty() || args["send"] == true {
        store.put(&event)?;
        store.queue(
            &account,
            &event.key,
            "create",
            &json!({ "event": event }),
            notify,
        )?;
    } else {
        // An invitation is never sent by making the event: "Send invite" sends it.
        event.unsent = true;
        store.hold(&Held {
            event: event.clone(),
            changed: differ(&Event::default(), &event),
            scope: "this".into(),
        })?;
    }
    Ok(json!({ "event": store.event(&event.key)? }))
}

fn update(dir: &Path, args: &Value) -> Result<Value> {
    let store = Store::open(dir)?;
    let k = need(args, "key")?;
    let scope = text(args, "scope").unwrap_or("this");
    let held = store.held(k)?;
    let base = store.stored(k)?;
    let shown = store.event(k)?.ok_or_else(|| bad("no such event"))?;
    if !shown.mine {
        return Err(CalError::new(
            "not_yours",
            "Only the organiser can change this event.",
        ));
    }
    let mut event = shown.clone();
    apply(&mut event, args)?;
    let notify = args["notify"].as_bool().unwrap_or(true);
    let new = held.as_ref().is_some_and(|h| h.event.unsent);
    let had_guests = base.as_ref().is_some_and(|b| !b.guests.is_empty());
    let holds = (new || had_guests || !event.guests.is_empty()) && args["send"] != true;
    // Compared with what the provider has, so changing something back is no change at all.
    let against = base.clone().unwrap_or_default();
    let changed = differ(&against, &event);
    for flag in [&mut event.pending, &mut event.queued] {
        *flag = false;
    }
    event.changes.clear();
    event.error = None;
    if holds {
        if changed.is_empty() && !new {
            store.release(k)?;
        } else {
            store.hold(&Held {
                event: event.clone(),
                changed,
                scope: scope.into(),
            })?;
        }
    } else if !changed.is_empty() {
        store.release(k)?;
        if new {
            event.unsent = false;
            store.put(&event)?;
            store.queue(
                &event.account,
                k,
                "create",
                &json!({ "event": event }),
                notify,
            )?;
        } else {
            store.put(&event)?;
            let was = json!({ "start": against.start, "repeat": against.repeat });
            store.queue(
                &event.account,
                k,
                "update",
                &json!({ "event": event, "changed": changed, "scope": scope, "was": was }),
                notify,
            )?;
        }
    }
    Ok(json!({ "event": store.event(k)? }))
}

/// "Send invite" and "Send update": everything held for the event goes as one change.
fn send(dir: &Path, args: &Value) -> Result<Value> {
    let store = Store::open(dir)?;
    let k = need(args, "key")?;
    let notify = args["notify"].as_bool().unwrap_or(true);
    let Some(held) = store.held(k)? else {
        return Ok(json!({ "event": store.event(k)?, "sent": false }));
    };
    let mut event = held.event.clone();
    let base = store.stored(k)?;
    store.release(k)?;
    if event.unsent {
        event.unsent = false;
        store.put(&event)?;
        store.queue(
            &event.account,
            k,
            "create",
            &json!({ "event": event }),
            notify,
        )?;
    } else {
        // A guest may have answered since the change was made here: their answer is the provider's.
        // Not for a whole series: this event's answers are one date's, not the series'.
        let one = held.scope != "all";
        for g in event.guests.iter_mut().filter(|_| one) {
            let now = base
                .iter()
                .flat_map(|b| &b.guests)
                .find(|b| b.email == g.email);
            if let Some(b) = now {
                g.reply.clone_from(&b.reply);
            }
        }
        let was = base
            .map(|b| json!({ "start": b.start, "repeat": b.repeat }))
            .unwrap_or(Value::Null);
        store.put(&event)?;
        store.queue(
            &event.account,
            k,
            "update",
            &json!({ "event": event, "changed": held.changed, "scope": held.scope, "was": was }),
            notify,
        )?;
    }
    Ok(json!({ "event": store.event(k)?, "sent": true }))
}

fn delete(dir: &Path, args: &Value) -> Result<Value> {
    let store = Store::open(dir)?;
    let k = need(args, "key")?;
    let (account, calendar, id) = split(k)?;
    let event = store.event(k)?.ok_or_else(|| bad("no such event"))?;
    let never_sent = id.starts_with("local-");
    if never_sent && store.taking(k)? {
        // It is on its way to the provider this moment; dropping it here would leave it there.
        return Err(CalError::new(
            "sending",
            "This event is being sent. Delete it in a moment.",
        ));
    }
    store.release(k)?;
    if never_sent {
        // It never reached the provider: there is nothing to delete there.
        for q in store.waiting()?.into_iter().filter(|q| q.key == k) {
            store.sent(q.n)?;
        }
    } else {
        let scope = text(args, "scope").unwrap_or("this");
        store.queue(
            account,
            k,
            "delete",
            &json!({ "event": event, "scope": scope }),
            args["notify"].as_bool().unwrap_or(true),
        )?;
        if scope == "all" {
            if let Some(series) = &event.series {
                store.drop_series(account, calendar, series)?;
            }
        }
    }
    store.drop_event(k)?;
    Ok(json!({ "deleted": k }))
}

fn reply(dir: &Path, args: &Value) -> Result<Value> {
    let store = Store::open(dir)?;
    let k = need(args, "key")?;
    let answer = match need(args, "reply")? {
        "yes" | "accepted" => "accepted",
        "no" | "declined" => "declined",
        "maybe" | "tentative" => "tentative",
        other => return Err(bad(format!("'reply' is yes, no or maybe, not '{other}'"))),
    };
    let mut event = store.stored(k)?.ok_or_else(|| bad("no such event"))?;
    let me = store.account(&event.account)?;
    event.reply = answer.to_string();
    for g in event
        .guests
        .iter_mut()
        .filter(|g| g.email.eq_ignore_ascii_case(&me.email))
    {
        g.reply = answer.to_string();
    }
    store.put(&event)?;
    let scope = text(args, "scope").unwrap_or("this");
    store.queue(
        &event.account,
        k,
        "reply",
        &json!({ "event": event, "answer": answer, "scope": scope }),
        true,
    )?;
    Ok(json!({ "event": store.event(k)? }))
}

/// Each person's busy times from whichever connected account can see their calendar.
async fn busy(dir: &Path, who: &[String], from: &str, to: &str) -> Result<Vec<provider::Busy>> {
    let accounts = if Store::exists(dir) {
        Store::open(dir)?.accounts()?
    } else {
        Vec::new()
    };
    let mut out: Vec<provider::Busy> = who
        .iter()
        .map(|e| provider::Busy {
            email: e.clone(),
            known: false,
            times: Vec::new(),
        })
        .collect();
    for account in accounts {
        let ask: Vec<String> = out
            .iter()
            .filter(|b| !b.known)
            .map(|b| b.email.clone())
            .collect();
        if ask.is_empty() {
            break;
        }
        // An account that cannot answer says nothing about the others.
        for found in provider::busy(&account, &ask, from, to)
            .await
            .unwrap_or_default()
        {
            if found.known {
                if let Some(slot) = out.iter_mut().find(|b| b.email == found.email) {
                    *slot = found;
                }
            }
        }
    }
    Ok(out)
}

async fn find_time(dir: &Path, root: Option<&Path>, args: &Value) -> Result<Value> {
    let who = emails(args);
    let minutes = args["minutes"]
        .as_i64()
        .or(args["minutes"].as_str().and_then(|m| m.parse().ok()))
        .unwrap_or(30)
        .clamp(5, 720);
    let from = text(args, "from")
        .map(time)
        .transpose()?
        .unwrap_or_else(Utc::now)
        .max(Utc::now());
    let to = text(args, "to")
        .map(time)
        .transpose()?
        .unwrap_or(from + Duration::days(7));
    let tz: chrono_tz::Tz = text(args, "zone")
        .and_then(|z| z.parse().ok())
        .unwrap_or(chrono_tz::UTC);
    let hour = |name: &str, default: u32| {
        args[name]
            .as_u64()
            .map(|h| h as u32)
            .or(args[name].as_str().and_then(|h| h.parse().ok()))
            .unwrap_or(default)
            .min(24)
    };
    let (first, last) = (hour("first_hour", 9), hour("last_hour", 18));
    let (from_s, to_s) = (stamp(from), stamp(to));
    let mut taken: Vec<(String, String)> = Vec::new();
    if Store::exists(dir) {
        let mine = Store::open(dir)?.events(&from_s, &to_s, true)?;
        taken.extend(
            mine.into_iter()
                .filter(|e| !e.all_day && e.reply != "declined")
                .map(|e| (e.start, e.end)),
        );
    }
    let asked = busy(dir, &who, &from_s, &to_s).await?;
    let shared = root.map(team::read).transpose()?.unwrap_or_default();
    let mut unknown = Vec::new();
    for person in asked {
        let synced = shared.iter().find(|m| {
            m["emails"]
                .as_array()
                .is_some_and(|e| e.iter().any(|x| x == person.email.as_str()))
        });
        if let Some(member) = synced {
            taken.extend(
                serde_json::from_value::<Vec<(String, String)>>(member["busy"].clone())
                    .unwrap_or_default(),
            );
        }
        if person.known {
            taken.extend(person.times);
        } else if synced.is_none() {
            unknown.push(person.email);
        }
    }
    let taken: Vec<(chrono::DateTime<Utc>, chrono::DateTime<Utc>)> = team::merged(taken)
        .iter()
        .filter_map(|(s, e)| Some((time(s).ok()?, time(e).ok()?)))
        .collect();
    let length = Duration::minutes(minutes);
    // Candidates start on the half hour, inside working hours on weekdays in the zone asked for.
    let mut at = from
        .with_second(0)
        .and_then(|t| t.with_nanosecond(0))
        .unwrap_or(from);
    at += Duration::minutes((30 - at.minute() as i64 % 30) % 30);
    let mut slots = Vec::new();
    while at + length <= to && slots.len() < 8 {
        let local = at.with_timezone(&tz);
        let ends = (at + length).with_timezone(&tz);
        let working = local.weekday().num_days_from_monday() < 5
            && local.hour() >= first
            && (ends.hour() * 60 + ends.minute()) <= last * 60
            && ends.date_naive() == local.date_naive();
        if working && !taken.iter().any(|(s, e)| *s < at + length && *e > at) {
            slots.push(json!({ "start": stamp(at), "end": stamp(at + length),
                "local": tz.from_utc_datetime(&at.naive_utc()).format("%a %-d %b %H:%M").to_string() }));
            at += length.max(Duration::minutes(30));
        } else {
            at += Duration::minutes(30);
        }
    }
    Ok(json!({ "slots": slots, "minutes": minutes, "zone": tz.name(), "unknown": unknown }))
}

fn block(dir: &Path, args: &Value) -> Result<Value> {
    let store = Store::open(dir)?;
    let (start, end) = match text(args, "key") {
        Some(k) => {
            let e = store.event(k)?.ok_or_else(|| bad("no such event"))?;
            (e.start, e.end)
        }
        None => (
            need(args, "start")?.to_string(),
            need(args, "end")?.to_string(),
        ),
    };
    need(args, "account")?;
    drop(store);
    // Only the time crosses over: no title, guests or place from the other calendar.
    let mut made = json!({ "account": args["account"], "title": text(args, "title").unwrap_or("Busy"), "start": start, "end": end });
    if let Some(calendar) = text(args, "calendar") {
        made["calendar"] = json!(calendar);
    }
    create(dir, &made)
}

/// Run one calendar command. `root` is the open folder, for the commands that write a note
/// into it; `show` is handed the sign-in address when a browser is needed.
pub async fn run(
    dir: &Path,
    root: Option<&Path>,
    name: &str,
    args: &Value,
    show: &(dyn Fn(&str) + Send + Sync),
) -> Result<Value> {
    let mut out = run_one(dir, root, name, args, show).await?;
    // An event's note is named only in the folder it was written in.
    let noted = match root {
        Some(root) if Store::exists(dir) => Store::open(dir)?.noted(&root.to_string_lossy())?,
        _ => Vec::new(),
    };
    let here = |e: &mut Value| {
        if !e["note"].is_null() && !noted.iter().any(|k| e["key"] == k.as_str()) {
            e["note"] = Value::Null;
        }
    };
    if let Some(event) = out.get_mut("event") {
        here(event);
    }
    if let Some(events) = out.get_mut("events").and_then(Value::as_array_mut) {
        events.iter_mut().for_each(here);
    }
    Ok(out)
}

async fn run_one(
    dir: &Path,
    root: Option<&Path>,
    name: &str,
    args: &Value,
    show: &(dyn Fn(&str) + Send + Sync),
) -> Result<Value> {
    match name {
        "calendar.status" => status(dir),
        "calendar.account.add" => add_account(dir, args, show).await,
        "calendar.account.remove" => {
            let id = need(args, "account")?;
            Store::open(dir)?.remove_account(id)?;
            auth::forget(id);
            status(dir)
        }
        "calendar.calendars.set" => {
            let store = Store::open(dir)?;
            let (account, id) = (need(args, "account")?, need(args, "calendar")?);
            if !store
                .calendars()?
                .iter()
                .any(|c| c.account == account && c.id == id)
            {
                return Err(bad("no such calendar"));
            }
            store.set_calendar(account, id, args["hidden"].as_bool(), text(args, "color"))?;
            if args["default"] == true {
                store.set_setting("default", &format!("{account}|{id}"))?;
            }
            Ok(json!({ "calendars": store.calendars()? }))
        }
        "calendar.events" => {
            let (from, to) = (
                stamp(time(need(args, "from")?)?),
                stamp(time(need(args, "to")?)?),
            );
            let events = if Store::exists(dir) {
                Store::open(dir)?.events(&from, &to, false)?
            } else {
                Vec::new()
            };
            Ok(json!({ "events": events }))
        }
        "calendar.event.get" => {
            Ok(json!({ "event": Store::open(dir)?.event(need(args, "key")?)? }))
        }
        "calendar.event.create" => create(dir, args),
        "calendar.event.update" => update(dir, args),
        "calendar.event.send" => send(dir, args),
        "calendar.event.discard" => {
            let store = Store::open(dir)?;
            let k = need(args, "key")?;
            store.release(k)?;
            Ok(json!({ "event": store.event(k)? }))
        }
        "calendar.event.delete" => delete(dir, args),
        "calendar.event.reply" => reply(dir, args),
        "calendar.sync" => sync::run(dir).await,
        "calendar.busy" => {
            let (from, to) = (
                stamp(time(need(args, "from")?)?),
                stamp(time(need(args, "to")?)?),
            );
            Ok(json!({ "busy": busy(dir, &emails(args), &from, &to).await? }))
        }
        "calendar.team.publish" => team::publish(dir, team::need_folder(root)?),
        "calendar.team" => Ok(json!({ "members": team::read(team::need_folder(root)?)? })),
        "calendar.find_time" => find_time(dir, root, args).await,
        "calendar.block" => block(dir, args),
        "calendar.note" => notes::meeting_note(
            dir,
            team::need_folder(root)?,
            need(args, "key")?,
            text(args, "zone").unwrap_or_default(),
            args["shared"] == true,
        ),
        "calendar.briefing" => {
            notes::briefing(dir, text(args, "zone").unwrap_or("UTC"), text(args, "date"))
        }
        other => Err(CalError::new(
            "unknown_command",
            format!("no command called '{other}'"),
        )),
    }
}

/// The same commands as tools for the assistant: `calendar.event.create` is `calendar_event_create`.
pub fn tools() -> Vec<lokus_ai::tools::Tool> {
    COMMANDS
        .iter()
        .map(|spec| {
            let args = if spec.name == "calendar.event.update" {
                [spec.args, EVENT_ARGS].concat()
            } else {
                spec.args.to_vec()
            };
            let properties: serde_json::Map<String, Value> = args
                .iter()
                .map(|(name, kind, about)| {
                    let mut p = json!({ "type": kind, "description": about });
                    if *kind == "array" {
                        p["items"] = json!({});
                    }
                    (name.to_string(), p)
                })
                .collect();
            lokus_ai::tools::Tool {
                name: spec.name.replace('.', "_"),
                description: spec.about.to_string(),
                schema: json!({ "type": "object", "properties": properties }),
                writes: spec.writes,
            }
        })
        .collect()
}

/// The command a tool name stands for.
pub fn command_of(tool: &str) -> Option<&'static str> {
    COMMANDS
        .iter()
        .map(|s| s.name)
        .find(|n| n.replace('.', "_") == tool)
}

/// The calendar as the assistant is handed it: the tools, and each one run as its command.
/// The assistant's own rule then applies: a tool that `writes` asks the person first.
pub fn assistant(
    dir: std::path::PathBuf,
    root: Option<std::path::PathBuf>,
    open: fn(&str),
) -> lokus_ai::chat::Local {
    lokus_ai::chat::Local {
        tools: tools(),
        run: std::sync::Arc::new(move |tool: String, input: Value| {
            let (dir, root) = (dir.clone(), root.clone());
            Box::pin(async move {
                let name =
                    command_of(&tool).ok_or_else(|| format!("there is no tool called {tool}"))?;
                let done = run(&dir, root.as_deref(), name, &input, &|url: &str| open(url)).await;
                // Sent now, not at the next minute: the answer says what the provider did.
                let done = match done {
                    Ok(value) if COMMANDS.iter().any(|c| c.name == name && c.writes) => {
                        let synced = crate::sync::run(&dir).await.unwrap_or(Value::Null);
                        Ok(json!({ "result": value, "sync": synced }))
                    }
                    other => other,
                };
                done.map(|v| v.to_string()).map_err(|e| e.message)
            })
        }),
    }
}
