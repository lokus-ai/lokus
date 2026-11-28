//! @part-of calendar
//! Microsoft 365 through Microsoft Graph v1.0, as documented at learn.microsoft.com/graph:
//! calendars, a calendar's events read incrementally (`calendarView/delta`), changes, replies,
//! Teams links and `getSchedule` for free/busy. Graph has no switch for "do not email": it
//! tells the guests a change concerns, always.

use chrono::{NaiveDateTime, TimeZone, Utc};
use reqwest::Method;
use serde_json::{json, Value};

use crate::auth::call;
use crate::model::{key, stamp, time, CalError, Calendar, Event, Guest, Meeting, Provider, Result};
use crate::provider::{enc, Busy, Change};

const P: Provider = Provider::Microsoft;

fn base() -> Result<String> {
    Ok(crate::auth::need(P)?.api)
}

pub async fn me(account: &str) -> Result<(String, String)> {
    let (_, body) = call(P, account, Method::GET, &format!("{}/me", base()?), None).await?;
    let email = body["mail"]
        .as_str()
        .or(body["userPrincipalName"].as_str())
        .unwrap_or_default()
        .to_lowercase();
    Ok((
        email.clone(),
        body["displayName"].as_str().unwrap_or(&email).to_string(),
    ))
}

pub async fn calendars(account: &str) -> Result<Vec<Calendar>> {
    let (_, body) = call(
        P,
        account,
        Method::GET,
        &format!("{}/me/calendars", base()?),
        None,
    )
    .await?;
    Ok(body["value"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|c| c["canEdit"] != false)
        .map(|c| Calendar {
            account: account.to_string(),
            id: c["id"].as_str().unwrap_or_default().to_string(),
            name: c["name"].as_str().unwrap_or_default().to_string(),
            color: c["hexColor"]
                .as_str()
                .filter(|h| !h.is_empty())
                .unwrap_or("#3aa675")
                .to_string(),
            hidden: false,
            primary: c["isDefaultCalendar"] == true,
            default: false,
        })
        .collect())
}

/// Graph's `{dateTime, timeZone}`; the app always asks for UTC.
fn when(v: &Value) -> Option<String> {
    let text = v["dateTime"].as_str()?;
    let text = text.split('.').next().unwrap_or(text);
    let naive = NaiveDateTime::parse_from_str(text, "%Y-%m-%dT%H:%M:%S").ok()?;
    Some(stamp(Utc.from_utc_datetime(&naive)))
}

fn point(e: &Event, at: &str) -> Value {
    let utc = time(at).unwrap_or_else(|_| Utc::now());
    match e.zone.parse::<chrono_tz::Tz>() {
        // In the event's own zone, so a repeating event keeps its hour across clock changes.
        Ok(zone) if !e.all_day => json!({
            "dateTime": utc.with_timezone(&zone).format("%Y-%m-%dT%H:%M:%S").to_string(),
            "timeZone": e.zone }),
        _ => json!({ "dateTime": utc.format("%Y-%m-%dT%H:%M:%S").to_string(), "timeZone": "UTC" }),
    }
}

/// Graph names zones as Windows does ("Pacific Standard Time"); Lokus keeps the IANA name.
/// One it does not know is left out, and the event's times stand as the instants they are.
fn zone_name(name: &str) -> String {
    if name.parse::<chrono_tz::Tz>().is_ok() {
        return name.to_string();
    }
    WINDOWS_ZONES
        .iter()
        .find(|(windows, _)| *windows == name)
        .map(|(_, iana)| iana.to_string())
        .unwrap_or_default()
}

const WINDOWS_ZONES: [(&str, &str); 48] = [
    ("Hawaiian Standard Time", "Pacific/Honolulu"),
    ("Alaskan Standard Time", "America/Anchorage"),
    ("Pacific Standard Time", "America/Los_Angeles"),
    ("US Mountain Standard Time", "America/Phoenix"),
    ("Mountain Standard Time", "America/Denver"),
    ("Central Standard Time", "America/Chicago"),
    ("Central Standard Time (Mexico)", "America/Mexico_City"),
    ("Canada Central Standard Time", "America/Regina"),
    ("Eastern Standard Time", "America/New_York"),
    ("SA Pacific Standard Time", "America/Bogota"),
    ("Atlantic Standard Time", "America/Halifax"),
    ("Venezuela Standard Time", "America/Caracas"),
    ("Pacific SA Standard Time", "America/Santiago"),
    ("Newfoundland Standard Time", "America/St_Johns"),
    ("E. South America Standard Time", "America/Sao_Paulo"),
    ("Argentina Standard Time", "America/Argentina/Buenos_Aires"),
    ("UTC", "UTC"),
    ("GMT Standard Time", "Europe/London"),
    ("Greenwich Standard Time", "Atlantic/Reykjavik"),
    ("W. Europe Standard Time", "Europe/Berlin"),
    ("Central Europe Standard Time", "Europe/Budapest"),
    ("Central European Standard Time", "Europe/Warsaw"),
    ("Romance Standard Time", "Europe/Paris"),
    ("W. Central Africa Standard Time", "Africa/Lagos"),
    ("GTB Standard Time", "Europe/Bucharest"),
    ("FLE Standard Time", "Europe/Kyiv"),
    ("E. Europe Standard Time", "Europe/Chisinau"),
    ("South Africa Standard Time", "Africa/Johannesburg"),
    ("Egypt Standard Time", "Africa/Cairo"),
    ("Israel Standard Time", "Asia/Jerusalem"),
    ("Turkey Standard Time", "Europe/Istanbul"),
    ("Russian Standard Time", "Europe/Moscow"),
    ("Arab Standard Time", "Asia/Riyadh"),
    ("E. Africa Standard Time", "Africa/Nairobi"),
    ("Iran Standard Time", "Asia/Tehran"),
    ("Arabian Standard Time", "Asia/Dubai"),
    ("Pakistan Standard Time", "Asia/Karachi"),
    ("India Standard Time", "Asia/Kolkata"),
    ("Bangladesh Standard Time", "Asia/Dhaka"),
    ("SE Asia Standard Time", "Asia/Bangkok"),
    ("China Standard Time", "Asia/Shanghai"),
    ("Singapore Standard Time", "Asia/Singapore"),
    ("W. Australia Standard Time", "Australia/Perth"),
    ("Tokyo Standard Time", "Asia/Tokyo"),
    ("Korea Standard Time", "Asia/Seoul"),
    ("Cen. Australia Standard Time", "Australia/Adelaide"),
    ("AUS Eastern Standard Time", "Australia/Sydney"),
    ("New Zealand Standard Time", "Pacific/Auckland"),
];

const DAYS: [(&str, &str); 7] = [
    ("MO", "monday"),
    ("TU", "tuesday"),
    ("WE", "wednesday"),
    ("TH", "thursday"),
    ("FR", "friday"),
    ("SA", "saturday"),
    ("SU", "sunday"),
];

/// `RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5` as Graph's pattern and range.
fn to_recurrence(rule: &str, start: &str, zone: &str) -> Option<Value> {
    let rule = rule.trim_start_matches("RRULE:");
    let part = |name: &str| {
        rule.split(';')
            .find_map(|p| p.strip_prefix(name)?.strip_prefix('='))
    };
    // Only what is understood in full is turned into Graph's words: "the second Tuesday" and
    // the like are left alone rather than sent as something simpler.
    let known = |p: &str| {
        let name = p.split('=').next().unwrap_or_default();
        matches!(name, "FREQ" | "INTERVAL" | "COUNT" | "UNTIL" | "WKST")
            || (name == "BYDAY" && rule.contains("FREQ=WEEKLY"))
    };
    if !rule.split(';').filter(|p| !p.is_empty()).all(known) {
        return None;
    }
    let kind = match part("FREQ")? {
        "DAILY" => "daily",
        "WEEKLY" => "weekly",
        "MONTHLY" => "absoluteMonthly",
        "YEARLY" => "absoluteYearly",
        _ => return None,
    };
    // The day is the one in the event's own zone, which is how the event itself is sent.
    let at = time(start)
        .ok()?
        .with_timezone(&zone.parse::<chrono_tz::Tz>().unwrap_or(chrono_tz::UTC))
        .naive_local();
    let mut pattern = json!({ "type": kind, "interval": part("INTERVAL").and_then(|i| i.parse::<u32>().ok()).unwrap_or(1) });
    match kind {
        "weekly" => {
            let named: Vec<&str> = match part("BYDAY") {
                Some(days) => days
                    .split(',')
                    .filter_map(|d| {
                        DAYS.iter()
                            .find(|(short, _)| d.ends_with(short))
                            .map(|(_, long)| *long)
                    })
                    .collect(),
                None => {
                    vec![DAYS[chrono::Datelike::weekday(&at).num_days_from_monday() as usize].1]
                }
            };
            pattern["daysOfWeek"] = json!(named);
        }
        "absoluteMonthly" => pattern["dayOfMonth"] = json!(chrono::Datelike::day(&at)),
        "absoluteYearly" => {
            pattern["dayOfMonth"] = json!(chrono::Datelike::day(&at));
            pattern["month"] = json!(chrono::Datelike::month(&at));
        }
        _ => {}
    }
    let mut range = json!({ "type": "noEnd", "startDate": at.date().to_string() });
    if let Some(count) = part("COUNT").and_then(|c| c.parse::<u32>().ok()) {
        range["type"] = json!("numbered");
        range["numberOfOccurrences"] = json!(count);
    } else if let Some(until) = part("UNTIL").filter(|u| u.len() >= 8) {
        range["type"] = json!("endDate");
        range["endDate"] = json!(format!("{}-{}-{}", &until[..4], &until[4..6], &until[6..8]));
    }
    Some(json!({ "pattern": pattern, "range": range }))
}

fn from_recurrence(r: &Value) -> Option<String> {
    let freq = match r["pattern"]["type"].as_str()? {
        "daily" => "DAILY",
        "weekly" => "WEEKLY",
        "absoluteMonthly" => "MONTHLY",
        "absoluteYearly" => "YEARLY",
        _ => return None,
    };
    let mut parts = vec![format!("FREQ={freq}")];
    if let Some(every) = r["pattern"]["interval"].as_u64().filter(|i| *i > 1) {
        parts.push(format!("INTERVAL={every}"));
    }
    if freq == "WEEKLY" {
        let days: Vec<&str> = r["pattern"]["daysOfWeek"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|d| {
                DAYS.iter()
                    .find(|(_, long)| d == long)
                    .map(|(short, _)| *short)
            })
            .collect();
        if !days.is_empty() {
            parts.push(format!("BYDAY={}", days.join(",")));
        }
    }
    match r["range"]["type"].as_str() {
        Some("numbered") => parts.push(format!("COUNT={}", r["range"]["numberOfOccurrences"])),
        Some("endDate") => parts.push(format!(
            "UNTIL={}T235959Z",
            r["range"]["endDate"]
                .as_str()
                .unwrap_or_default()
                .replace('-', "")
        )),
        _ => {}
    }
    Some(format!("RRULE:{}", parts.join(";")))
}

fn read(account: &str, calendar: &str, e: &Value) -> Option<Event> {
    let id = e["id"].as_str()?;
    let reply_of = |r: &Value| match r.as_str() {
        Some("accepted" | "organizer") => "accepted",
        Some("declined") => "declined",
        Some("tentativelyAccepted") => "tentative",
        _ => "needsAction",
    };
    let mine = e["isOrganizer"] != false;
    Some(Event {
        key: key(account, calendar, id),
        account: account.to_string(),
        calendar: calendar.to_string(),
        id: id.to_string(),
        title: e["subject"].as_str().unwrap_or_default().to_string(),
        start: when(&e["start"])?,
        end: when(&e["end"])?,
        all_day: e["isAllDay"] == true,
        zone: zone_name(e["originalStartTimeZone"].as_str().unwrap_or_default()),
        location: e["location"]["displayName"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        description: if e["body"]["contentType"] == "text" {
            e["body"]["content"]
                .as_str()
                .unwrap_or_default()
                .to_string()
        } else {
            e["bodyPreview"].as_str().unwrap_or_default().to_string()
        },
        guests: e["attendees"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|a| Guest {
                email: a["emailAddress"]["address"]
                    .as_str()
                    .unwrap_or_default()
                    .to_lowercase(),
                name: a["emailAddress"]["name"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
                optional: a["type"] == "optional",
                reply: reply_of(&a["status"]["response"]).to_string(),
            })
            .collect(),
        uid: e["iCalUId"].as_str().unwrap_or_default().to_string(),
        organizer: e["organizer"]["emailAddress"]["address"]
            .as_str()
            .unwrap_or_default()
            .to_lowercase(),
        mine,
        reply: if mine {
            String::new()
        } else {
            reply_of(&e["responseStatus"]["response"]).to_string()
        },
        meeting: e["onlineMeeting"]["joinUrl"]
            .as_str()
            .or(e["onlineMeetingUrl"].as_str())
            .map(|url| Meeting {
                kind: "teams".into(),
                url: url.to_string(),
            }),
        repeat: from_recurrence(&e["recurrence"]),
        series: e["seriesMasterId"].as_str().map(str::to_string),
        link: e["webLink"].as_str().unwrap_or_default().to_string(),
        ..Event::default()
    })
}

pub async fn changes(
    account: &str,
    calendar: &str,
    position: Option<&str>,
    from: &str,
    to: &str,
) -> Result<(Vec<Change>, String)> {
    let api = base()?;
    let mut url = match position {
        // Graph hands back a whole address to ask next; it is only followed back to Graph.
        Some(link) if link.starts_with(&api) => link.to_string(),
        _ => format!(
            "{api}/me/calendars/{}/calendarView/delta?startDateTime={}&endDateTime={}",
            enc(calendar),
            enc(from),
            enc(to)
        ),
    };
    let mut out = Vec::new();
    loop {
        let (_, body) = call(P, account, Method::GET, &url, None).await?;
        for e in body["value"].as_array().into_iter().flatten() {
            match read(account, calendar, e) {
                Some(event) if e["@removed"].is_null() && e["isCancelled"] != true => {
                    // The repeating event itself is not shown: its occurrences are.
                    if e["type"] != "seriesMaster" {
                        out.push(Change::Put(Box::new(event)));
                    }
                }
                _ => out.push(Change::Gone(
                    e["id"].as_str().unwrap_or_default().to_string(),
                )),
            }
        }
        match body["@odata.nextLink"]
            .as_str()
            .filter(|l| l.starts_with(&api))
        {
            Some(next) => url = next.to_string(),
            None => {
                return Ok((
                    out,
                    body["@odata.deltaLink"]
                        .as_str()
                        .unwrap_or_default()
                        .to_string(),
                ))
            }
        }
    }
}

fn write(e: &Event, changed: Option<&[String]>) -> Value {
    let has = |name: &str| changed.is_none_or(|c| c.iter().any(|f| f == name));
    let mut out = json!({});
    if has("title") {
        out["subject"] = json!(e.title);
    }
    if has("time") {
        out["start"] = point(e, &e.start);
        out["end"] = point(e, &e.end);
        out["isAllDay"] = json!(e.all_day);
    }
    if has("location") {
        out["location"] = json!({ "displayName": e.location });
    }
    if has("description") {
        out["body"] = json!({ "contentType": "text", "content": e.description });
    }
    if has("guests") {
        out["attendees"] = e
            .guests
            .iter()
            .map(|g| {
                json!({ "type": if g.optional { "optional" } else { "required" },
                "emailAddress": { "address": g.email, "name": g.name } })
            })
            .collect();
    }
    if has("repeat") {
        match e.repeat.as_deref() {
            None => out["recurrence"] = Value::Null,
            // A rule Lokus cannot put in Graph's words is not sent at all: sending nothing
            // would turn the series into one event.
            Some(rule) => {
                if let Some(pattern) = to_recurrence(rule, &e.start, &e.zone) {
                    out["recurrence"] = pattern;
                }
            }
        }
    }
    if has("meeting") {
        let wanted = e.want_meeting || e.meeting.is_some();
        if wanted || changed.is_some() {
            out["isOnlineMeeting"] = json!(wanted);
        }
        if wanted {
            out["onlineMeetingProvider"] = json!("teamsForBusiness");
        }
    }
    out
}

fn back(account: &str, calendar: &str, body: &Value) -> Result<Event> {
    read(account, calendar, body).ok_or_else(|| {
        CalError::new(
            "provider",
            "Microsoft answered with something that is not an event",
        )
    })
}

pub async fn create(account: &str, calendar: &str, e: &Event) -> Result<Event> {
    let url = format!("{}/me/calendars/{}/events", base()?, enc(calendar));
    let mut new = write(e, None);
    // Graph's own guard against a retry making a second event: the id is the local one.
    if let Some(id) = e.id.strip_prefix("local-") {
        new["transactionId"] = json!(id);
    }
    let (_, body) = call(P, account, Method::POST, &url, Some(&new)).await?;
    back(account, calendar, &body)
}

pub async fn update(
    account: &str,
    calendar: &str,
    id: &str,
    e: &Event,
    changed: &[String],
) -> Result<Event> {
    let url = format!("{}/me/events/{}", base()?, enc(id));
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
    let url = format!("{}/me/events/{}", base()?, enc(id));
    let (_, body) = call(P, account, Method::GET, &url, None).await?;
    back(account, calendar, &body)
}

pub async fn delete(account: &str, id: &str) -> Result<()> {
    let url = format!("{}/me/events/{}", base()?, enc(id));
    call(P, account, Method::DELETE, &url, None)
        .await
        .map(|_| ())
}

pub async fn reply(account: &str, id: &str, answer: &str) -> Result<()> {
    let action = match answer {
        "accepted" => "accept",
        "declined" => "decline",
        _ => "tentativelyAccept",
    };
    let url = format!("{}/me/events/{}/{action}", base()?, enc(id));
    call(
        P,
        account,
        Method::POST,
        &url,
        Some(&json!({ "sendResponse": true })),
    )
    .await
    .map(|_| ())
}

pub async fn busy(account: &str, emails: &[String], from: &str, to: &str) -> Result<Vec<Busy>> {
    let url = format!("{}/me/calendar/getSchedule", base()?);
    let at = |t: &str| json!({ "dateTime": t.trim_end_matches('Z'), "timeZone": "UTC" });
    let body = json!({ "schedules": emails, "startTime": at(from), "endTime": at(to), "availabilityViewInterval": 30 });
    let (_, answer) = call(P, account, Method::POST, &url, Some(&body)).await?;
    Ok(emails
        .iter()
        .map(|email| {
            let found = answer["value"].as_array().into_iter().flatten().find(|s| {
                s["scheduleId"]
                    .as_str()
                    .is_some_and(|i| i.eq_ignore_ascii_case(email))
            });
            Busy {
                email: email.clone(),
                known: found.is_some_and(|s| s["error"].is_null()),
                times: found
                    .and_then(|s| s["scheduleItems"].as_array())
                    .into_iter()
                    .flatten()
                    .filter(|i| i["status"] != "free")
                    .filter_map(|i| Some((when(&i["start"])?, when(&i["end"])?)))
                    .collect(),
            }
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_rule_graph_cannot_say_is_not_sent_and_windows_zones_are_named() {
        let at = "2026-12-08T15:00:00Z";
        assert!(to_recurrence("RRULE:FREQ=WEEKLY;BYDAY=TU", at, "UTC").is_some());
        assert!(to_recurrence("RRULE:FREQ=MONTHLY;BYDAY=2TU", at, "UTC").is_none());
        assert!(to_recurrence("RRULE:FREQ=HOURLY", at, "UTC").is_none());
        assert_eq!(zone_name("Pacific Standard Time"), "America/Los_Angeles");
        assert_eq!(zone_name("Europe/Berlin"), "Europe/Berlin");
        assert_eq!(zone_name("Somewhere Else Time"), "");
    }
}
