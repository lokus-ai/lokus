//! Microsoft Graph (Outlook / 365 / personal) connector.
//!
//! Sync: `calendarView/delta` per calendar over the ±12-month window —
//! window-scoped like Google's pinned syncToken; pagination via `@odata.nextLink`
//! (carried as page_token), cursor via the final `@odata.deltaLink`; `410` →
//! CursorExpired → engine refetches. `Prefer: outlook.timezone="UTC"` forces
//! UTC datetimes; `@removed` entries become tombstones. Writes: If-Match on
//! `@odata.etag`, 412 → Conflict, 429 honors Retry-After. MSA refresh tokens
//! are single-use — every refresh persists the rotated token immediately.

use async_trait::async_trait;
use chrono::{Duration, NaiveDateTime, SecondsFormat, TimeZone, Utc};
use serde_json::{json, Value};

use crate::calendar_v2::connector::*;
use crate::calendar_v2::creds;
use crate::calendar_v2::models::{now_ms, EventRow};

const GRAPH: &str = "https://graph.microsoft.com/v1.0";
pub const TOKEN_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
pub const AUTH_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
pub const SCOPES: &str = "offline_access Calendars.ReadWrite User.Read";

pub struct MicrosoftConnector {
    account_id: String,
    http: reqwest::Client,
}

impl MicrosoftConnector {
    pub fn new(account_id: String) -> Self {
        Self { account_id, http: reqwest::Client::new() }
    }

    async fn token(&self) -> Result<String, ConnectorError> {
        let mut c = creds::load(&self.account_id)
            .map_err(ConnectorError::Other)?
            .ok_or(ConnectorError::AuthExpired)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        if c.expires_at.map(|e| e > now + 300).unwrap_or(false) {
            return Ok(c.access);
        }
        let refresh = c.refresh.clone().ok_or(ConnectorError::AuthExpired)?;
        let client_id = std::env::var("MS_CLIENT_ID")
            .map_err(|_| ConnectorError::Other("MS_CLIENT_ID not set".into()))?;
        let resp = self
            .http
            .post(TOKEN_URL)
            .form(&[
                ("client_id", client_id.as_str()),
                ("refresh_token", refresh.as_str()),
                ("grant_type", "refresh_token"),
                ("scope", SCOPES),
            ])
            .send()
            .await?;
        if resp.status() == 400 || resp.status() == 401 {
            return Err(ConnectorError::AuthExpired);
        }
        let body: Value = resp.json().await?;
        let access = body["access_token"].as_str().ok_or(ConnectorError::AuthExpired)?.to_string();
        c.access = access.clone();
        c.expires_at = Some(now + body["expires_in"].as_u64().unwrap_or(3600));
        // MSA rotates refresh tokens on every use — persist or lose the account.
        if let Some(rt) = body["refresh_token"].as_str() {
            c.refresh = Some(rt.to_string());
        }
        creds::store(&self.account_id, &c).map_err(ConnectorError::Other)?;
        Ok(access)
    }

    async fn get(&self, url: &str) -> Result<reqwest::Response, ConnectorError> {
        let tok = self.token().await?;
        let resp = self
            .http
            .get(url)
            .bearer_auth(tok)
            .header("Prefer", "odata.maxpagesize=100, outlook.timezone=\"UTC\"")
            .send()
            .await?;
        match resp.status().as_u16() {
            401 => Err(ConnectorError::AuthExpired),
            429 => {
                let retry = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(60);
                Err(ConnectorError::RateLimited(retry))
            }
            _ => Ok(resp),
        }
    }
}

#[async_trait]
impl CalendarConnector for MicrosoftConnector {
    fn capabilities(&self) -> Capabilities {
        Capabilities { expands_recurrence: true, writable: true, delta: true }
    }

    async fn list_calendars(&self) -> Result<Vec<RemoteCalendar>, ConnectorError> {
        let resp = self.get(&format!("{GRAPH}/me/calendars?$top=100")).await?;
        if !resp.status().is_success() {
            return Err(ConnectorError::Other(format!("calendars: {}", resp.status())));
        }
        let body: Value = resp.json().await?;
        Ok(body["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|c| RemoteCalendar {
                provider_calendar_id: c["id"].as_str().unwrap_or_default().to_string(),
                name: c["name"].as_str().unwrap_or("Calendar").to_string(),
                description: None,
                color: c["hexColor"].as_str().filter(|s| !s.is_empty()).map(String::from),
                is_primary: c["isDefaultCalendar"].as_bool().unwrap_or(false),
                is_writable: c["canEdit"].as_bool().unwrap_or(false),
            })
            .collect())
    }

    async fn pull(
        &self,
        provider_calendar_id: &str,
        local_calendar_id: &str,
        cursor: Option<&Cursor>,
        page_token: Option<&str>,
    ) -> Result<PullPage, ConnectorError> {
        let is_delta = cursor.is_some();
        let url = if let Some(next) = page_token {
            next.to_string() // nextLink is absolute
        } else if let Some(Cursor::Token(delta_link)) = cursor {
            delta_link.clone()
        } else {
            let now = Utc::now();
            format!(
                "{GRAPH}/me/calendars/{}/calendarView/delta?startDateTime={}&endDateTime={}",
                urlencoding::encode(provider_calendar_id),
                urlencoding::encode(&(now - Duration::days(365)).to_rfc3339_opts(SecondsFormat::Secs, true)),
                urlencoding::encode(&(now + Duration::days(365)).to_rfc3339_opts(SecondsFormat::Secs, true)),
            )
        };

        let resp = self.get(&url).await?;
        if resp.status().as_u16() == 410 {
            return Err(ConnectorError::CursorExpired);
        }
        if !resp.status().is_success() {
            return Err(ConnectorError::Other(format!("calendarView/delta: {}", resp.status())));
        }
        let body: Value = resp.json().await?;

        let events = body["value"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|item| map_event(item, local_calendar_id))
            .collect();

        Ok(PullPage {
            events,
            next_cursor: body["@odata.deltaLink"].as_str().map(|s| Cursor::Token(s.to_string())),
            page_token: body["@odata.nextLink"].as_str().map(String::from),
            full_resync: !is_delta,
        })
    }

    async fn push(
        &self,
        provider_calendar_id: &str,
        op: &str,
        event: &EventRow,
        base_etag: Option<&str>,
    ) -> Result<PushOutcome, ConnectorError> {
        let tok = self.token().await?;
        match op {
            "create" => {
                let resp = self
                    .http
                    .post(format!(
                        "{GRAPH}/me/calendars/{}/events",
                        urlencoding::encode(provider_calendar_id)
                    ))
                    .bearer_auth(&tok)
                    .json(&event_payload(event))
                    .send()
                    .await?;
                match resp.status().as_u16() {
                    401 => Err(ConnectorError::AuthExpired),
                    s if (200..300).contains(&s) => {
                        let body: Value = resp.json().await?;
                        Ok(PushOutcome::Applied {
                            provider_event_id: body["id"].as_str().unwrap_or_default().to_string(),
                            etag: body["@odata.etag"].as_str().map(String::from),
                        })
                    }
                    s => Err(ConnectorError::Other(format!("create: {s}"))),
                }
            }
            "update" | "delete" => {
                let pid = event
                    .provider_event_id
                    .as_deref()
                    .ok_or_else(|| ConnectorError::Other(format!("{op} without provider id")))?;
                let url = format!("{GRAPH}/me/events/{}", urlencoding::encode(pid));
                let mut req = if op == "update" {
                    self.http.patch(&url).json(&event_payload(event))
                } else {
                    self.http.delete(&url)
                };
                req = req.bearer_auth(&tok);
                if let Some(etag) = base_etag {
                    req = req.header("If-Match", etag);
                }
                let resp = req.send().await?;
                match resp.status().as_u16() {
                    412 => Ok(PushOutcome::Conflict),
                    401 => Err(ConnectorError::AuthExpired),
                    404 | 410 if op == "delete" => Ok(PushOutcome::Deleted),
                    s if (200..300).contains(&s) => {
                        if op == "delete" {
                            Ok(PushOutcome::Deleted)
                        } else {
                            let body: Value = resp.json().await.unwrap_or(Value::Null);
                            Ok(PushOutcome::Applied {
                                provider_event_id: pid.to_string(),
                                etag: body["@odata.etag"].as_str().map(String::from),
                            })
                        }
                    }
                    s => Err(ConnectorError::Other(format!("{op}: {s}"))),
                }
            }
            other => Err(ConnectorError::Other(format!("unknown op {other}"))),
        }
    }
}

/// Graph naive datetime ("2026-08-03T09:00:00.0000000") in UTC (forced by the
/// Prefer header) → unix ms.
fn parse_graph_dt(v: &Value) -> Option<i64> {
    let s = v["dateTime"].as_str()?;
    let s = s.split('.').next().unwrap_or(s);
    let naive = NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").ok()?;
    Some(Utc.from_utc_datetime(&naive).timestamp_millis())
}

fn map_event(item: &Value, local_calendar_id: &str) -> Option<EventRow> {
    let pid = item["id"].as_str()?.to_string();
    let now = now_ms();

    // Delta tombstone
    if item.get("@removed").is_some() {
        return Some(EventRow {
            id: uuid::Uuid::new_v4().to_string(),
            calendar_id: local_calendar_id.to_string(),
            provider_event_id: Some(pid),
            status: "cancelled".into(),
            transparency: "opaque".into(),
            start_ts: Some(0),
            end_ts: Some(0),
            deleted: true,
            created_at: now,
            updated_at: now,
            ..Default::default()
        });
    }

    let all_day = item["isAllDay"].as_bool().unwrap_or(false);
    let mut row = EventRow {
        id: uuid::Uuid::new_v4().to_string(),
        calendar_id: local_calendar_id.to_string(),
        provider_event_id: Some(pid),
        ical_uid: item["iCalUId"].as_str().map(String::from),
        recurrence_id: item["seriesMasterId"].as_str().map(String::from),
        title: item["subject"].as_str().unwrap_or("").to_string(),
        description: item["bodyPreview"].as_str().filter(|s| !s.is_empty()).map(String::from),
        location: item["location"]["displayName"]
            .as_str()
            .filter(|s| !s.is_empty())
            .map(String::from),
        all_day,
        status: if item["isCancelled"].as_bool().unwrap_or(false) {
            "cancelled".into()
        } else if item["responseStatus"]["response"].as_str() == Some("tentativelyAccepted") {
            "tentative".into()
        } else {
            "confirmed".into()
        },
        transparency: if item["showAs"].as_str() == Some("free") { "transparent".into() } else { "opaque".into() },
        organizer_email: item["organizer"]["emailAddress"]["address"].as_str().map(String::from),
        organizer_is_self: item["isOrganizer"].as_bool().unwrap_or(false),
        attendees: item["attendees"].as_array().filter(|a| !a.is_empty()).map(|a| Value::Array(a.clone()).to_string()),
        html_link: item["webLink"].as_str().map(String::from),
        etag: item["@odata.etag"].as_str().map(String::from),
        provider_updated_at: item["lastModifiedDateTime"]
            .as_str()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.timestamp_millis()),
        deleted: item["isCancelled"].as_bool().unwrap_or(false),
        created_at: now,
        updated_at: now,
        raw: Some(item.to_string()),
        ..Default::default()
    };

    if all_day {
        // Graph all-day: start/end are 00:00 UTC datetimes; end is exclusive.
        let start = item["start"]["dateTime"].as_str()?;
        let end = item["end"]["dateTime"].as_str().unwrap_or(start);
        row.start_date = Some(start.chars().take(10).collect());
        row.end_date = Some(end.chars().take(10).collect());
    } else {
        row.start_ts = parse_graph_dt(&item["start"]);
        row.end_ts = parse_graph_dt(&item["end"]).or(row.start_ts.map(|s| s + 3_600_000));
        row.start_ts?;
    }
    Some(row)
}

fn event_payload(ev: &EventRow) -> Value {
    let mut v = json!({
        "subject": ev.title,
        "isAllDay": ev.all_day,
    });
    if let Some(loc) = &ev.location {
        v["location"] = json!({ "displayName": loc });
    }
    if let Some(desc) = &ev.description {
        v["body"] = json!({ "contentType": "text", "content": desc });
    }
    if ev.all_day {
        v["start"] = json!({ "dateTime": format!("{}T00:00:00", ev.start_date.as_deref().unwrap_or_default()), "timeZone": "UTC" });
        v["end"] = json!({ "dateTime": format!("{}T00:00:00", ev.end_date.as_deref().or(ev.start_date.as_deref()).unwrap_or_default()), "timeZone": "UTC" });
    } else {
        let fmt = |ms: Option<i64>| {
            ms.and_then(|m| Utc.timestamp_millis_opt(m).single())
                .map(|d| d.format("%Y-%m-%dT%H:%M:%S").to_string())
                .unwrap_or_default()
        };
        v["start"] = json!({ "dateTime": fmt(ev.start_ts), "timeZone": "UTC" });
        v["end"] = json!({ "dateTime": fmt(ev.end_ts), "timeZone": "UTC" });
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_timed_graph_event() {
        let item = serde_json::json!({
            "id": "AAMk1",
            "@odata.etag": "W/\"x\"",
            "subject": "Sync",
            "iCalUId": "040000008200E00074C5B7101A82E008",
            "isAllDay": false,
            "start": { "dateTime": "2026-08-03T13:00:00.0000000", "timeZone": "UTC" },
            "end": { "dateTime": "2026-08-03T13:30:00.0000000", "timeZone": "UTC" },
            "isOrganizer": true,
            "showAs": "busy"
        });
        let row = map_event(&item, "cal-l").unwrap();
        assert_eq!(row.end_ts.unwrap() - row.start_ts.unwrap(), 1_800_000);
        assert_eq!(row.etag.as_deref(), Some("W/\"x\""));
        assert!(!row.all_day);
    }

    #[test]
    fn maps_removed_as_tombstone() {
        let item = serde_json::json!({ "id": "gone", "@removed": { "reason": "deleted" } });
        let row = map_event(&item, "cal-l").unwrap();
        assert!(row.deleted);
    }

    #[test]
    fn maps_all_day_exclusive_end() {
        let item = serde_json::json!({
            "id": "ad1",
            "subject": "Trip",
            "isAllDay": true,
            "start": { "dateTime": "2026-08-10T00:00:00.0000000", "timeZone": "UTC" },
            "end": { "dateTime": "2026-08-12T00:00:00.0000000", "timeZone": "UTC" }
        });
        let row = map_event(&item, "cal-l").unwrap();
        assert!(row.all_day);
        assert_eq!(row.start_date.as_deref(), Some("2026-08-10"));
        assert_eq!(row.end_date.as_deref(), Some("2026-08-12"));
    }
}
