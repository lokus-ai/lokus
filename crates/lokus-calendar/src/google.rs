//! @part-of calendar
//! Google Calendar (API v3), as documented at developers.google.com/workspace/calendar: the
//! calendar list, events read incrementally with a sync token, changes sent with `sendUpdates`
//! saying whether guests are emailed, Meet links, and free/busy.

use reqwest::Method;
use serde_json::{json, Value};

use crate::auth::call;
use crate::model::{key, stamp, time, CalError, Calendar, Event, Guest, Meeting, Provider, Result};
use crate::provider::{enc, Busy, Change};

const P: Provider = Provider::Google;

fn base(account: &str) -> Result<String> {
    let _ = account;
    Ok(format!("{}/calendar/v3", crate::auth::need(P)?.api))
}

pub async fn calendars(account: &str) -> Result<Vec<Calendar>> {
    let url = format!("{}/users/me/calendarList", base(account)?);
    let (_, body) = call(P, account, Method::GET, &url, None).await?;
    Ok(body["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|c| matches!(c["accessRole"].as_str(), Some("owner" | "writer")))
        .map(|c| Calendar {
            account: account.to_string(),
            id: c["id"].as_str().unwrap_or_default().to_string(),
            name: c["summaryOverride"]
                .as_str()
                .or(c["summary"].as_str())
                .unwrap_or_default()
                .to_string(),
            color: c["backgroundColor"]
                .as_str()
                .unwrap_or("#4f7cff")
                .to_string(),
            hidden: false,
            primary: c["primary"] == true,
            default: false,
        })
        .collect())
}

fn when(v: &Value) -> Option<(String, bool)> {
    if let Some(day) = v["date"].as_str() {
        return Some((format!("{day}T00:00:00Z"), true));
    }
    Some((stamp(time(v["dateTime"].as_str()?).ok()?), false))
}

fn read(account: &str, calendar: &str, e: &Value) -> Option<Event> {
    let id = e["id"].as_str()?;
    let (start, all_day) = when(&e["start"])?;
    let (end, _) = when(&e["end"])?;
    let guests: Vec<Guest> = e["attendees"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|a| a["organizer"] != true || a["self"] != true)
        .map(|a| Guest {
            email: a["email"].as_str().unwrap_or_default().to_string(),
            name: a["displayName"].as_str().unwrap_or_default().to_string(),
            optional: a["optional"] == true,
            reply: a["responseStatus"]
                .as_str()
                .unwrap_or("needsAction")
                .to_string(),
        })
        .collect();
    let mine = e["organizer"]["self"] == true || e["organizer"].is_null();
    let reply = e["attendees"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|a| a["self"] == true)
        .and_then(|a| a["responseStatus"].as_str())
        .unwrap_or_default();
    let meet = e["hangoutLink"].as_str().or_else(|| {
        e["conferenceData"]["entryPoints"]
            .as_array()?
            .iter()
            .find(|p| p["entryPointType"] == "video")?["uri"]
            .as_str()
    });
    Some(Event {
        key: key(account, calendar, id),
        account: account.to_string(),
        calendar: calendar.to_string(),
        id: id.to_string(),
        title: e["summary"].as_str().unwrap_or_default().to_string(),
        start,
        end,
        all_day,
        zone: e["start"]["timeZone"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        location: e["location"].as_str().unwrap_or_default().to_string(),
        description: e["description"].as_str().unwrap_or_default().to_string(),
        guests,
        uid: e["iCalUID"].as_str().unwrap_or_default().to_string(),
        organizer: e["organizer"]["email"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        mine,
        reply: if mine {
            String::new()
        } else {
            reply.to_string()
        },
        meeting: meet.map(|url| Meeting {
            kind: "meet".into(),
            url: url.to_string(),
        }),
        repeat: e["recurrence"][0].as_str().map(str::to_string),
        series: e["recurringEventId"].as_str().map(str::to_string),
        link: e["htmlLink"].as_str().unwrap_or_default().to_string(),
        ..Event::default()
    })
}

/// What changed in a calendar since `position`; everything between the two days without one.
pub async fn changes(
    account: &str,
    calendar: &str,
    position: Option<&str>,
    from: &str,
    to: &str,
) -> Result<(Vec<Change>, String)> {
    let root = format!(
        "{}/calendars/{}/events?singleEvents=true&maxResults=250",
        base(account)?,
        enc(calendar)
    );
    let first = match position {
        // A sync token may not be sent with the dates: it already carries them.
        Some(token) => format!("{root}&syncToken={}", enc(token)),
        None => format!("{root}&timeMin={}&timeMax={}", enc(from), enc(to)),
    };
    let (mut url, mut out) = (first.clone(), Vec::new());
    loop {
        let (_, body) = call(P, account, Method::GET, &url, None).await?;
        for e in body["items"].as_array().into_iter().flatten() {
            match (e["status"].as_str(), read(account, calendar, e)) {
                (Some("cancelled"), _) | (_, None) => out.push(Change::Gone(
                    e["id"].as_str().unwrap_or_default().to_string(),
                )),
                (_, Some(event)) => out.push(Change::Put(Box::new(event))),
            }
        }
        if let Some(page) = body["nextPageToken"].as_str() {
            url = format!("{first}&pageToken={}", enc(page));
            continue;
        }
        let next = body["nextSyncToken"]
            .as_str()
            .unwrap_or_default()
            .to_string();
        return Ok((out, next));
    }
}

fn point(e: &Event, at: &str) -> Value {
    if e.all_day {
        json!({ "date": &at[..10.min(at.len())] })
    } else if e.zone.is_empty() {
        // Google wants a zone on a repeating event; the instant is in UTC already.
        json!({ "dateTime": at, "timeZone": "UTC" })
    } else {
        json!({ "dateTime": at, "timeZone": e.zone })
    }
}

/// The part of an event Google is sent: every field for a new one, only `changed` otherwise.
fn write(e: &Event, changed: Option<&[String]>) -> Value {
    let has = |name: &str| changed.is_none_or(|c| c.iter().any(|f| f == name));
    let mut out = json!({});
    if has("title") {
        out["summary"] = json!(e.title);
    }
    if has("time") {
        out["start"] = point(e, &e.start);
        out["end"] = point(e, &e.end);
    }
    if has("location") {
        out["location"] = json!(e.location);
    }
    if has("description") {
        out["description"] = json!(e.description);
    }
    if has("guests") {
        out["attendees"] = e
            .guests
            .iter()
            .map(|g| {
                // Google replaces the whole list: each guest's answer goes back with them.
                let mut a = json!({ "email": g.email, "optional": g.optional,
                    "responseStatus": if g.reply.is_empty() { "needsAction" } else { &g.reply } });
                if !g.name.is_empty() {
                    a["displayName"] = json!(g.name);
                }
                a
            })
            .collect();
    }
    if has("repeat") {
        out["recurrence"] = match &e.repeat {
            Some(rule) => json!([rule]),
            None => json!([]),
        };
    }
    if has("meeting") {
        if e.want_meeting && e.meeting.is_none() {
            out["conferenceData"] = json!({ "createRequest": {
                "requestId": uuid::Uuid::new_v4().simple().to_string(),
                "conferenceSolutionKey": { "type": "hangoutsMeet" } } });
        } else if e.meeting.is_none() && changed.is_some() {
            out["conferenceData"] = Value::Null;
        }
    }
    out
}

fn told(notify: bool) -> &'static str {
    if notify {
        "all"
    } else {
        "none"
    }
}

fn back(account: &str, calendar: &str, body: &Value) -> Result<Event> {
    read(account, calendar, body).ok_or_else(|| {
        CalError::new(
            "provider",
            "Google answered with something that is not an event",
        )
    })
}

pub async fn create(account: &str, calendar: &str, e: &Event, notify: bool) -> Result<Event> {
    let url = format!(
        "{}/calendars/{}/events?sendUpdates={}&conferenceDataVersion=1",
        base(account)?,
        enc(calendar),
        told(notify)
    );
    let mut new = write(e, None);
    // The id is ours (the local one, which is in the queue with the change), so sending the
    // same new event again is refused by Google instead of making a second one.
    let ours = e.id.strip_prefix("local-").map(str::to_string);
    if let Some(id) = &ours {
        new["id"] = json!(id);
    }
    match (call(P, account, Method::POST, &url, Some(&new)).await, ours) {
        (Err(e), Some(id)) if e.code == "conflict" => get(account, calendar, &id).await,
        (answer, _) => back(account, calendar, &answer?.1),
    }
}

pub async fn update(
    account: &str,
    calendar: &str,
    id: &str,
    e: &Event,
    changed: &[String],
    notify: bool,
) -> Result<Event> {
    let url = format!(
        "{}/calendars/{}/events/{}?sendUpdates={}&conferenceDataVersion=1",
        base(account)?,
        enc(calendar),
        enc(id),
        told(notify)
    );
    let (_, body) = call(
        P,
        account,
        Method::PATCH,
        &url,
        Some(&write(e, Some(changed))),
    )
    .await?;
    back(account, calendar, &body)
}

pub async fn get(account: &str, calendar: &str, id: &str) -> Result<Event> {
    let url = format!(
        "{}/calendars/{}/events/{}",
        base(account)?,
        enc(calendar),
        enc(id)
    );
    let (_, body) = call(P, account, Method::GET, &url, None).await?;
    if body["status"] == "cancelled" {
        // Google keeps a deleted event readable for a while, marked so.
        return Err(crate::CalError::new(
            "missing",
            "The provider no longer has this event.",
        ));
    }
    back(account, calendar, &body)
}

pub async fn delete(account: &str, calendar: &str, id: &str, notify: bool) -> Result<()> {
    let url = format!(
        "{}/calendars/{}/events/{}?sendUpdates={}",
        base(account)?,
        enc(calendar),
        enc(id),
        told(notify)
    );
    call(P, account, Method::DELETE, &url, None)
        .await
        .map(|_| ())
}

/// A guest's own answer: Google takes it as a change to that guest's entry.
pub async fn reply(
    account: &str,
    calendar: &str,
    id: &str,
    email: &str,
    answer: &str,
) -> Result<()> {
    let url = format!(
        "{}/calendars/{}/events/{}?sendUpdates=all",
        base(account)?,
        enc(calendar),
        enc(id)
    );
    // Google replaces the whole guest list, so everyone goes back as they are and only this
    // person's answer differs.
    let read = format!(
        "{}/calendars/{}/events/{}",
        base(account)?,
        enc(calendar),
        enc(id)
    );
    let (_, event) = call(P, account, Method::GET, &read, None).await?;
    let mut guests = event["attendees"].as_array().cloned().unwrap_or_default();
    let me = |a: &Value| {
        a["self"] == true
            || a["email"]
                .as_str()
                .is_some_and(|e| e.eq_ignore_ascii_case(email))
    };
    match guests.iter_mut().find(|a| me(a)) {
        Some(mine) => mine["responseStatus"] = json!(answer),
        None => guests.push(json!({ "email": email, "responseStatus": answer })),
    }
    let body = json!({ "attendees": guests });
    call(P, account, Method::PATCH, &url, Some(&body))
        .await
        .map(|_| ())
}

pub async fn busy(account: &str, emails: &[String], from: &str, to: &str) -> Result<Vec<Busy>> {
    let url = format!("{}/freeBusy", base(account)?);
    let body = json!({ "timeMin": from, "timeMax": to,
        "items": emails.iter().map(|e| json!({ "id": e })).collect::<Vec<_>>() });
    let (_, answer) = call(P, account, Method::POST, &url, Some(&body)).await?;
    Ok(emails
        .iter()
        .map(|email| {
            let found = &answer["calendars"][email];
            let known =
                found.is_object() && found["errors"].as_array().is_none_or(|e| e.is_empty());
            Busy {
                email: email.clone(),
                known,
                times: found["busy"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|b| {
                        Some((
                            stamp(time(b["start"].as_str()?).ok()?),
                            stamp(time(b["end"].as_str()?).ok()?),
                        ))
                    })
                    .collect(),
            }
        })
        .collect())
}
