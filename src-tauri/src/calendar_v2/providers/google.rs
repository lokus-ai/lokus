//! Google Calendar connector (V2, multi-account).
//!
//! Sync strategy: `events.list` with `singleEvents=true` + `syncToken` — a
//! legal combination, so Google hands back pre-expanded instances and no
//! local RRULE work is needed. The initial request pins a ±12-month window;
//! the syncToken inherits that restriction, which is fine because the store
//! re-anchors monthly and a horizon re-anchor clears cursors (full window
//! refetch). `410 GONE` → CursorExpired → engine full-resyncs. Writes use
//! If-Match with the stored etag; 412 → Conflict.

use async_trait::async_trait;
use chrono::{Duration, SecondsFormat, TimeZone, Utc};
use serde_json::{json, Value};

use crate::calendar_v2::connector::*;
use crate::calendar_v2::creds;
use crate::calendar_v2::models::{now_ms, EventRow};

const API: &str = "https://www.googleapis.com/calendar/v3";

pub struct GoogleConnector {
    account_id: String,
    http: reqwest::Client,
}

impl GoogleConnector {
    pub fn new(account_id: String) -> Self {
        Self { account_id, http: reqwest::Client::new() }
    }

    /// Valid access token, refreshing (and persisting) when <5 min remain.
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
        let client_id = std::env::var("GOOGLE_CLIENT_ID")
            .map_err(|_| ConnectorError::Other("GOOGLE_CLIENT_ID not set".into()))?;
        let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").unwrap_or_default();

        let mut form = vec![
            ("client_id", client_id),
            ("refresh_token", refresh.clone()),
            ("grant_type", "refresh_token".to_string()),
        ];
        if !client_secret.is_empty() {
            form.push(("client_secret", client_secret));
        }
        let resp = self
            .http
            .post("https://oauth2.googleapis.com/token")
            .form(&form)
            .send()
            .await?;
        if resp.status() == 400 || resp.status() == 401 {
            return Err(ConnectorError::AuthExpired);
        }
        let body: Value = resp.json().await?;
        let access = body["access_token"]
            .as_str()
            .ok_or(ConnectorError::AuthExpired)?
            .to_string();
        let ttl = body["expires_in"].as_u64().unwrap_or(3600);
        c.access = access.clone();
        c.expires_at = Some(now + ttl);
        // Google may rotate the refresh token.
        if let Some(rt) = body["refresh_token"].as_str() {
            c.refresh = Some(rt.to_string());
        }
        creds::store(&self.account_id, &c).map_err(ConnectorError::Other)?;
        Ok(access)
    }

    async fn get(&self, url: &str) -> Result<reqwest::Response, ConnectorError> {
        let tok = self.token().await?;
        let resp = self.http.get(url).bearer_auth(tok).send().await?;
        match resp.status().as_u16() {
            401 => Err(ConnectorError::AuthExpired),
            403 | 429 => {
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
impl CalendarConnector for GoogleConnector {
    fn capabilities(&self) -> Capabilities {
        Capabilities { expands_recurrence: true, writable: true, delta: true }
    }

    async fn list_calendars(&self) -> Result<Vec<RemoteCalendar>, ConnectorError> {
        let resp = self
            .get(&format!("{API}/users/me/calendarList?maxResults=250"))
            .await?;
        if !resp.status().is_success() {
            return Err(ConnectorError::Other(format!("calendarList: {}", resp.status())));
        }
        let body: Value = resp.json().await?;
        let mut out = vec![];
        for item in body["items"].as_array().unwrap_or(&vec![]) {
            let access = item["accessRole"].as_str().unwrap_or("reader");
            out.push(RemoteCalendar {
                provider_calendar_id: item["id"].as_str().unwrap_or_default().to_string(),
                name: item["summaryOverride"]
                    .as_str()
                    .or(item["summary"].as_str())
                    .unwrap_or("Calendar")
                    .to_string(),
                description: item["description"].as_str().map(String::from),
                color: item["backgroundColor"].as_str().map(String::from),
                is_primary: item["primary"].as_bool().unwrap_or(false),
                is_writable: matches!(access, "owner" | "writer"),
            });
        }
        Ok(out)
    }

    async fn pull(
        &self,
        provider_calendar_id: &str,
        local_calendar_id: &str,
        cursor: Option<&Cursor>,
        page_token: Option<&str>,
    ) -> Result<PullPage, ConnectorError> {
        let cal = urlencoding::encode(provider_calendar_id);
        let mut url = format!("{API}/calendars/{cal}/events?maxResults=250&singleEvents=true");
        let is_delta = cursor.is_some();
        match (cursor, page_token) {
            (_, Some(pt)) => {
                // Pagination continues whatever request began it; syncToken or
                // window params must NOT be repeated alongside pageToken's
                // original params — Google encodes them into the token flow.
                url.push_str(&format!("&pageToken={}", urlencoding::encode(pt)));
                if let Some(Cursor::Token(t)) = cursor {
                    url.push_str(&format!("&syncToken={}", urlencoding::encode(t)));
                } else {
                    url.push_str(&window_params());
                }
            }
            (Some(Cursor::Token(t)), None) => {
                url.push_str(&format!("&syncToken={}", urlencoding::encode(t)));
            }
            (None, None) => {
                url.push_str(&window_params());
            }
        }

        let resp = self.get(&url).await?;
        if resp.status().as_u16() == 410 {
            return Err(ConnectorError::CursorExpired);
        }
        if !resp.status().is_success() {
            return Err(ConnectorError::Other(format!("events.list: {}", resp.status())));
        }
        let body: Value = resp.json().await?;

        let events = body["items"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|item| map_event(item, local_calendar_id))
            .collect();

        Ok(PullPage {
            events,
            next_cursor: body["nextSyncToken"].as_str().map(|t| Cursor::Token(t.to_string())),
            page_token: body["nextPageToken"].as_str().map(String::from),
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
        let cal = urlencoding::encode(provider_calendar_id);

        let send = |req: reqwest::RequestBuilder| async {
            let resp = req.bearer_auth(&tok).send().await?;
            Ok::<_, ConnectorError>(resp)
        };

        match op {
            "delete" => {
                let pid = event
                    .provider_event_id
                    .as_deref()
                    .ok_or_else(|| ConnectorError::Other("delete without provider id".into()))?;
                let mut req = self
                    .http
                    .delete(format!("{API}/calendars/{cal}/events/{}", urlencoding::encode(pid)));
                if let Some(etag) = base_etag {
                    req = req.header("If-Match", etag);
                }
                let resp = send(req).await?;
                match resp.status().as_u16() {
                    200 | 204 | 404 | 410 => Ok(PushOutcome::Deleted),
                    412 => Ok(PushOutcome::Conflict),
                    401 => Err(ConnectorError::AuthExpired),
                    s => Err(ConnectorError::Other(format!("delete: {s}"))),
                }
            }
            "create" => {
                let payload = event_payload(event);
                let resp = send(
                    self.http
                        .post(format!("{API}/calendars/{cal}/events"))
                        .json(&payload),
                )
                .await?;
                if resp.status().as_u16() == 401 {
                    return Err(ConnectorError::AuthExpired);
                }
                if !resp.status().is_success() {
                    return Err(ConnectorError::Other(format!("insert: {}", resp.status())));
                }
                let body: Value = resp.json().await?;
                Ok(PushOutcome::Applied {
                    provider_event_id: body["id"].as_str().unwrap_or_default().to_string(),
                    etag: body["etag"].as_str().map(clean_etag),
                })
            }
            "update" => {
                let pid = event
                    .provider_event_id
                    .as_deref()
                    .ok_or_else(|| ConnectorError::Other("update without provider id".into()))?;
                let payload = event_payload(event);
                let mut req = self
                    .http
                    .patch(format!("{API}/calendars/{cal}/events/{}", urlencoding::encode(pid)))
                    .json(&payload);
                if let Some(etag) = base_etag {
                    req = req.header("If-Match", etag);
                }
                let resp = send(req).await?;
                match resp.status().as_u16() {
                    412 => Ok(PushOutcome::Conflict),
                    401 => Err(ConnectorError::AuthExpired),
                    s if (200..300).contains(&s) => {
                        let body: Value = resp.json().await?;
                        Ok(PushOutcome::Applied {
                            provider_event_id: pid.to_string(),
                            etag: body["etag"].as_str().map(clean_etag),
                        })
                    }
                    s => Err(ConnectorError::Other(format!("patch: {s}"))),
                }
            }
            other => Err(ConnectorError::Other(format!("unknown op {other}"))),
        }
    }
}

fn window_params() -> String {
    let now = Utc::now();
    format!(
        "&timeMin={}&timeMax={}",
        urlencoding::encode(&(now - Duration::days(365)).to_rfc3339_opts(SecondsFormat::Secs, true)),
        urlencoding::encode(&(now + Duration::days(365)).to_rfc3339_opts(SecondsFormat::Secs, true)),
    )
}

/// Google etags arrive quoted (`"p33c..."`); If-Match wants them verbatim, so
/// keep the quotes — this just normalizes whitespace.
fn clean_etag(s: &str) -> String {
    s.trim().to_string()
}

/// Map one Google event resource to an EventRow. Cancelled instances become
/// tombstones. With singleEvents=true every item is a concrete instance;
/// recurring instances carry `recurringEventId` + `originalStartTime`.
fn map_event(item: &Value, local_calendar_id: &str) -> Option<EventRow> {
    let pid = item["id"].as_str()?.to_string();
    let status = item["status"].as_str().unwrap_or("confirmed");
    let now = now_ms();

    let mut row = EventRow {
        id: uuid::Uuid::new_v4().to_string(),
        calendar_id: local_calendar_id.to_string(),
        provider_event_id: Some(pid),
        ical_uid: item["iCalUID"].as_str().map(String::from),
        recurrence_id: item["originalStartTime"]["dateTime"]
            .as_str()
            .or(item["originalStartTime"]["date"].as_str())
            .map(String::from),
        title: item["summary"].as_str().unwrap_or("").to_string(),
        description: item["description"].as_str().map(String::from),
        location: item["location"].as_str().map(String::from),
        status: match status {
            "tentative" => "tentative".into(),
            "cancelled" => "cancelled".into(),
            _ => "confirmed".into(),
        },
        transparency: item["transparency"].as_str().unwrap_or("opaque").to_string(),
        organizer_email: item["organizer"]["email"].as_str().map(String::from),
        organizer_is_self: item["organizer"]["self"].as_bool().unwrap_or(false),
        attendees: item["attendees"].as_array().map(|a| Value::Array(a.clone()).to_string()),
        html_link: item["htmlLink"].as_str().map(String::from),
        etag: item["etag"].as_str().map(clean_etag),
        provider_updated_at: item["updated"]
            .as_str()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.timestamp_millis()),
        deleted: status == "cancelled",
        created_at: now,
        updated_at: now,
        raw: Some(item.to_string()),
        ..Default::default()
    };

    // Times: dateTime (timed) or date (all-day).
    if let Some(date) = item["start"]["date"].as_str() {
        row.all_day = true;
        row.start_date = Some(date.to_string());
        row.end_date = item["end"]["date"].as_str().map(String::from);
    } else if let Some(dt) = item["start"]["dateTime"].as_str() {
        let start = chrono::DateTime::parse_from_rfc3339(dt).ok()?;
        row.start_ts = Some(start.timestamp_millis());
        row.start_tz = item["start"]["timeZone"].as_str().map(String::from);
        let end = item["end"]["dateTime"]
            .as_str()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.timestamp_millis())
            .unwrap_or(start.timestamp_millis() + 3_600_000);
        row.end_ts = Some(end);
    } else if status == "cancelled" {
        // Cancelled delta stubs may omit times entirely — tombstone by id.
        row.start_ts = Some(0);
        row.end_ts = Some(0);
    } else {
        return None;
    }

    Some(row)
}

/// Payload for insert/patch from a local row.
fn event_payload(ev: &EventRow) -> Value {
    let mut v = json!({
        "summary": ev.title,
        "description": ev.description,
        "location": ev.location,
    });
    if ev.all_day {
        v["start"] = json!({ "date": ev.start_date });
        v["end"] = json!({ "date": ev.end_date.clone().or_else(|| ev.start_date.clone()) });
    } else {
        let to_rfc = |ms: Option<i64>| {
            ms.and_then(|m| Utc.timestamp_millis_opt(m).single())
                .map(|d| d.to_rfc3339_opts(SecondsFormat::Secs, true))
        };
        v["start"] = json!({ "dateTime": to_rfc(ev.start_ts) });
        v["end"] = json!({ "dateTime": to_rfc(ev.end_ts) });
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_timed_event() {
        let item = serde_json::json!({
            "id": "abc123",
            "status": "confirmed",
            "summary": "Standup",
            "iCalUID": "abc123@google.com",
            "etag": "\"333\"",
            "htmlLink": "https://cal",
            "start": { "dateTime": "2026-08-03T09:00:00-04:00", "timeZone": "America/New_York" },
            "end": { "dateTime": "2026-08-03T09:30:00-04:00" },
            "updated": "2026-08-01T00:00:00Z"
        });
        let row = map_event(&item, "cal-local").unwrap();
        assert_eq!(row.provider_event_id.as_deref(), Some("abc123"));
        assert_eq!(row.ical_uid.as_deref(), Some("abc123@google.com"));
        assert!(!row.all_day);
        assert_eq!(row.end_ts.unwrap() - row.start_ts.unwrap(), 1_800_000);
        assert_eq!(row.start_tz.as_deref(), Some("America/New_York"));
        assert!(!row.deleted);
    }

    #[test]
    fn maps_all_day_event() {
        let item = serde_json::json!({
            "id": "d1",
            "status": "confirmed",
            "summary": "Vacation",
            "start": { "date": "2026-08-10" },
            "end": { "date": "2026-08-12" }
        });
        let row = map_event(&item, "cal-local").unwrap();
        assert!(row.all_day);
        assert_eq!(row.start_date.as_deref(), Some("2026-08-10"));
        assert_eq!(row.end_date.as_deref(), Some("2026-08-12"));
    }

    #[test]
    fn cancelled_stub_becomes_tombstone() {
        let item = serde_json::json!({ "id": "gone1", "status": "cancelled" });
        let row = map_event(&item, "cal-local").unwrap();
        assert!(row.deleted);
        assert_eq!(row.provider_event_id.as_deref(), Some("gone1"));
    }

    #[test]
    fn all_day_payload_uses_dates() {
        let ev = EventRow {
            all_day: true,
            start_date: Some("2026-08-10".into()),
            end_date: Some("2026-08-11".into()),
            title: "x".into(),
            ..Default::default()
        };
        let p = event_payload(&ev);
        assert_eq!(p["start"]["date"].as_str(), Some("2026-08-10"));
        assert!(p["start"]["dateTime"].is_null());
    }
}
