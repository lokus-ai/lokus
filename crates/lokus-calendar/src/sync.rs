//! @part-of calendar
//! Keeping the local copy and the providers in step: first what was changed here is sent, in
//! the order it was made, then what changed there is read. A provider that cannot be reached
//! leaves everything waiting; nothing is lost and nothing is sent twice.

use std::path::Path;

use chrono::{Duration, TimeZone, Utc};
use serde_json::{json, Value};

use crate::model::{differ, key, now, split, stamp, time, Event, Result};
use crate::provider::{self, Change};
use crate::store::{Queued, Store};

/// One at a time: the minute timer and a person pressing a button must not both send a change.
static RUNNING: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// How much of the calendar is kept here: a month back, four months ahead.
fn window() -> (String, String) {
    let day = Utc::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap_or_default()
        .and_utc();
    (
        stamp(day - Duration::days(30)),
        stamp(day + Duration::days(120)),
    )
}

/// After a refused delete the calendar is read afresh, so the event (or the whole series) is
/// back as the provider has it.
fn restore(dir: &Path, q: &Queued) -> bool {
    let Ok((account, calendar, _)) = split(&q.key) else {
        return false;
    };
    Store::open(dir).is_ok_and(|store| store.set_position(account, calendar, None, "").is_ok())
}

/// Whether the provider already has this change. Asked before a change is sent a second time:
/// its first answer was lost, so it may have been acted on, and sending it again would email
/// the guests again.
async fn applied(dir: &Path, q: &Queued) -> Result<bool> {
    let (_, calendar, id) = split(&q.key)?;
    if q.op == "create" {
        // A new event carries an id of ours: the provider cannot make it twice.
        return Ok(false);
    }
    let account = Store::open(dir)?.account(&q.account)?;
    let mut ours: Option<Event> = serde_json::from_value(q.body["event"].clone()).ok();
    let series = ours
        .as_ref()
        .and_then(|e| e.series.clone())
        .filter(|_| q.body["scope"] == "all");
    let theirs = match provider::get(&account, calendar, series.as_deref().unwrap_or(id)).await {
        Err(e) if matches!(e.code, "missing" | "gone") => return Ok(q.op == "delete"),
        other => other?,
    };
    let changed: Vec<String> =
        serde_json::from_value(q.body["changed"].clone()).unwrap_or_default();
    Ok(match (q.op.as_str(), ours.as_mut()) {
        ("reply", _) => theirs.reply == q.body["answer"].as_str().unwrap_or("accepted"),
        ("update", Some(ours)) if !changed.is_empty() => {
            if series.is_some() && changed.iter().any(|c| c == "time") {
                // The series itself is compared with where it was to be moved to.
                let (Some(start), Some(end)) =
                    (q.body["to"]["start"].as_str(), q.body["to"]["end"].as_str())
                else {
                    return Ok(false);
                };
                ours.start = start.to_string();
                ours.end = end.to_string();
            }
            // The same moment written in another zone is the same time.
            if time(&ours.start).ok() == time(&theirs.start).ok()
                && time(&ours.end).ok() == time(&theirs.end).ok()
            {
                ours.start.clone_from(&theirs.start);
                ours.end.clone_from(&theirs.end);
            }
            let still = differ(&theirs, ours);
            !changed.iter().any(|c| still.contains(c))
        }
        _ => false,
    })
}

async fn send(dir: &Path, q: &Queued) -> Result<()> {
    let account = Store::open(dir)?.account(&q.account)?;
    let (_, calendar, id) = split(&q.key)?;
    let event: Option<Event> = serde_json::from_value(q.body["event"].clone()).ok();
    let all = q.body["scope"] == "all";
    match q.op.as_str() {
        "create" => {
            let event = event.ok_or_else(|| crate::model::bad("nothing to create"))?;
            let made = provider::create(&account, calendar, &event, q.notify).await?;
            let store = Store::open(dir)?;
            store.rename(&q.key, &made.key)?;
            // A repeating event comes back as the series itself; its occurrences are read next,
            // and keeping both would show the first one twice, one of them standing for all.
            if made.repeat.is_some() && made.series.is_none() {
                return Ok(());
            }
            store.put(&made)
        }
        "update" => {
            let mut event = event.ok_or_else(|| crate::model::bad("nothing to change"))?;
            let changed: Vec<String> =
                serde_json::from_value(q.body["changed"].clone()).unwrap_or_default();
            let series = event.series.clone().filter(|_| all);
            let target = series.clone().unwrap_or_else(|| id.to_string());
            if series.is_some() && changed.iter().any(|c| c == "time") {
                // "All events": the whole series moves by as much as this occurrence did.
                // Worked out once and kept with the change: sent again, it is not moved twice.
                if let (Some(start), Some(end)) =
                    (q.body["to"]["start"].as_str(), q.body["to"]["end"].as_str())
                {
                    event.start = start.to_string();
                    event.end = end.to_string();
                } else {
                    let whole = provider::get(&account, calendar, &target).await?;
                    let was = time(q.body["was"]["start"].as_str().unwrap_or(&event.start))?;
                    let moved = time(&event.start)? - was;
                    let length = time(&event.end)? - time(&event.start)?;
                    let mut start = time(&whole.start)? + moved;
                    if event.all_day && !whole.all_day {
                        // Made all-day: the series' first day as its own zone has it, since the
                        // clock there may stand differently than on the date that was opened.
                        let zone: chrono_tz::Tz = whole.zone.parse().unwrap_or(chrono_tz::UTC);
                        let day = time(&whole.start)?.with_timezone(&zone).date_naive();
                        start = Utc.from_utc_datetime(&day.and_time(chrono::NaiveTime::MIN));
                    }
                    event.start = stamp(start);
                    event.end = stamp(start + length);
                    let mut body = q.body.clone();
                    body["to"] = json!({ "start": event.start, "end": event.end });
                    Store::open(dir)?.set_body(q.n, &body)?;
                }
            }
            if series.is_some() {
                event.repeat = event
                    .repeat
                    .or(q.body["was"]["repeat"].as_str().map(str::to_string));
            }
            if changed.iter().any(|c| c == "guests") {
                // The provider replaces the whole guest list, so each guest goes back with the
                // answer the provider holds this moment (for "all events", the series' own).
                let now = provider::get(&account, calendar, &target).await?;
                for g in &mut event.guests {
                    if let Some(n) = now.guests.iter().find(|n| n.email == g.email) {
                        g.reply.clone_from(&n.reply);
                    }
                }
            }
            let made =
                provider::update(&account, calendar, &target, &event, &changed, q.notify).await?;
            let store = Store::open(dir)?;
            if series.is_none() {
                store.put(&made)?;
            }
            Ok(())
        }
        "delete" => {
            let series = event.and_then(|e| e.series).filter(|_| all);
            match provider::delete(
                &account,
                calendar,
                series.as_deref().unwrap_or(id),
                q.notify,
            )
            .await
            {
                // Already gone there: a delete sent twice, or deleted elsewhere first.
                Err(e) if matches!(e.code, "missing" | "gone") => {}
                other => other?,
            }
            let store = Store::open(dir)?;
            match series {
                Some(series) => store.drop_series(&account.id, calendar, &series),
                None => store.drop_event(&q.key),
            }
        }
        "reply" => {
            let answer = q.body["answer"].as_str().unwrap_or("accepted");
            let series = event.and_then(|e| e.series).filter(|_| all);
            provider::reply(&account, calendar, series.as_deref().unwrap_or(id), answer).await
        }
        other => Err(crate::model::bad(format!("unknown change '{other}'"))),
    }
}

async fn pull(dir: &Path, account: &crate::model::Account) -> Result<usize> {
    let listed = provider::calendars(account).await?;
    Store::open(dir)?.keep_calendars(&account.id, &listed)?;
    let (from, to) = window();
    let mut read = 0;
    for calendar in listed {
        let (mut position, since) = Store::open(dir)?.position(&account.id, &calendar.id)?;
        // The window moves with the days: every few weeks it is read afresh.
        let old = since
            .and_then(|s| time(&s).ok())
            .is_none_or(|s| time(&from).is_ok_and(|f| f - s > Duration::days(21)));
        if old {
            position = None;
        }
        let (changes, next) =
            match provider::changes(account, &calendar.id, position.as_deref(), &from, &to).await {
                Err(e) if e.code == "gone" => {
                    position = None;
                    provider::changes(account, &calendar.id, None, &from, &to).await?
                }
                other => other?,
            };
        let store = Store::open(dir)?;
        if position.is_none() {
            store.clear_calendar(&account.id, &calendar.id)?;
        }
        let waiting: Vec<String> = store.waiting()?.into_iter().map(|q| q.key).collect();
        for change in changes {
            read += 1;
            match change {
                // What is still on its way out is not overwritten by what the provider had before.
                Change::Put(event) if !waiting.contains(&event.key) => store.put(&event)?,
                Change::Put(_) => {}
                Change::Gone(id) => store.drop_event(&key(&account.id, &calendar.id, &id))?,
            }
        }
        let since = if position.is_none() {
            from.clone()
        } else {
            since_of(&store, account, &calendar.id, &from)
        };
        store.set_position(
            &account.id,
            &calendar.id,
            Some(&next).filter(|n| !n.is_empty()).map(String::as_str),
            &since,
        )?;
    }
    Ok(read)
}

fn since_of(store: &Store, account: &crate::model::Account, calendar: &str, from: &str) -> String {
    store
        .position(&account.id, calendar)
        .ok()
        .and_then(|(_, since)| since)
        .unwrap_or_else(|| from.to_string())
}

/// Send what is waiting, then read what changed. Safe to call at any time, from anywhere.
pub async fn run(dir: &Path) -> Result<Value> {
    if !Store::exists(dir) {
        return Ok(
            json!({ "sent": 0, "refused": 0, "waiting": 0, "read": 0, "offline": false, "problems": [] }),
        );
    }
    let _one = RUNNING.lock().await;
    let (mut sent, mut refused, mut read, mut offline) = (0, 0, 0, false);
    let mut problems: Vec<Value> = Vec::new();
    let mut stuck: Vec<String> = Vec::new();
    // One at a time, read afresh each time: sending a new event gives it the provider's id, and
    // the changes waiting behind it are renamed to follow.
    let mut seen: Vec<i64> = Vec::new();
    while let Some(q) = Store::open(dir)?
        .waiting()?
        .into_iter()
        .find(|q| !seen.contains(&q.n))
    {
        seen.push(q.n);
        // A change the provider refused stays, with why; later changes to that event wait behind it.
        if q.error.is_some() || stuck.contains(&q.key) {
            stuck.push(q.key.clone());
            continue;
        }
        if !Store::open(dir)?.take(q.n)? {
            stuck.push(q.key.clone());
            continue;
        }
        // Handed over before with no answer (too slow, cut off, or the app was closed): the
        // provider is asked what it has before the change goes a second time.
        let mut again = Store::open(dir)?.tried(q.n)?;
        Store::open(dir)?.set_tried(q.n)?;
        let mut q = q;
        let done = loop {
            if again {
                match applied(dir, &q).await {
                    Ok(true) => break Ok(()),
                    Ok(false) => {}
                    Err(e) => break Err(e),
                }
            }
            match send(dir, &q).await {
                // Tried once more straight away, having looked first.
                Err(e) if matches!(e.code, "slow" | "lost") && !again => {
                    again = true;
                    if let Some(now) = Store::open(dir)?
                        .waiting()?
                        .into_iter()
                        .find(|w| w.n == q.n)
                    {
                        q = now;
                    }
                }
                other => break other,
            }
        };
        match done {
            Ok(()) => {
                Store::open(dir)?.sent(q.n)?;
                sent += 1;
            }
            Err(e) if e.offline() => {
                Store::open(dir)?.untake(q.n)?;
                offline = true;
                break;
            }
            Err(e) if e.waits() => {
                // No answer in time. It waits and is sent again next round: a new event carries
                // an id of ours, so the provider cannot make it twice.
                Store::open(dir)?.untake(q.n)?;
                stuck.push(q.key.clone());
            }
            Err(e) => {
                refused += 1;
                // A refused delete has no event left to show Retry on: the event comes back as
                // the provider has it, and can be deleted again from there.
                // Signed out, the delete stays and is sent after signing in again.
                if q.op == "delete" && e.code != "signed_out" && restore(dir, &q) {
                    Store::open(dir)?.sent(q.n)?;
                    problems.push(
                        json!({ "account": q.account, "code": e.code, "message": e.message }),
                    );
                    continue;
                }
                Store::open(dir)?.refused(q.n, &e.message)?;
                stuck.push(q.key.clone());
            }
        }
    }
    if !offline {
        for account in Store::open(dir)?.accounts()? {
            match pull(dir, &account).await {
                Ok(n) => read += n,
                Err(e) if e.offline() => {
                    offline = true;
                    break;
                }
                Err(e) => problems
                    .push(json!({ "account": account.id, "code": e.code, "message": e.message })),
            }
        }
    }
    let store = Store::open(dir)?;
    if !offline {
        store.set_setting("synced", &now())?;
    }
    Ok(
        json!({ "sent": sent, "refused": refused, "waiting": store.waiting()?.len(), "read": read,
        "offline": offline, "problems": problems }),
    )
}
