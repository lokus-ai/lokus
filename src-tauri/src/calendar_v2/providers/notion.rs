//! Notion connector — read-only calendar over Notion databases.
//!
//! Auth is an internal-integration token pasted by the user (Notion's OAuth
//! token exchange requires a client_secret — impossible in a client-only
//! desktop app). Every shared database with a `date` property becomes a
//! calendar (hide unwanted ones with the normal visibility toggle).
//!
//! Sync: poll each database filtered on last_edited_time >= cursor − 5 min
//! (the property is minute-granular, so we overlap and rely on idempotent
//! upserts). Cursors self-expire hourly → a full unfiltered query whose
//! full-resync sweep catches deletions and archived pages. ~3 req/s budget;
//! engine cadence is 120 s.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::calendar_v2::connector::*;
use crate::calendar_v2::creds;
use crate::calendar_v2::models::{now_ms, EventRow};

const API: &str = "https://api.notion.com/v1";
const NOTION_VERSION: &str = "2022-06-28";
/// Full-reconcile interval: cursor older than this is discarded.
const CURSOR_TTL_MS: i64 = 3_600_000;

pub struct NotionConnector {
    account_id: String,
    http: reqwest::Client,
}

impl NotionConnector {
    pub fn new(account_id: String) -> Self {
        Self { account_id, http: reqwest::Client::new() }
    }

    fn token(&self) -> Result<String, ConnectorError> {
        Ok(creds::load(&self.account_id)
            .map_err(ConnectorError::Other)?
            .ok_or(ConnectorError::AuthExpired)?
            .access)
    }

    async fn post(&self, url: &str, body: Value) -> Result<Value, ConnectorError> {
        let resp = self
            .http
            .post(url)
            .bearer_auth(self.token()?)
            .header("Notion-Version", NOTION_VERSION)
            .json(&body)
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
                    .unwrap_or(5);
                Err(ConnectorError::RateLimited(retry))
            }
            s if (200..300).contains(&s) => Ok(resp.json().await?),
            s => Err(ConnectorError::Other(format!("notion {url}: {s}"))),
        }
    }
}

#[async_trait]
impl CalendarConnector for NotionConnector {
    fn capabilities(&self) -> Capabilities {
        Capabilities { expands_recurrence: true, writable: false, delta: true }
    }

    /// Every database with a date property is a calendar. The date property
    /// name rides inside provider_calendar_id ("<db_id>|<prop>").
    async fn list_calendars(&self) -> Result<Vec<RemoteCalendar>, ConnectorError> {
        let mut out = vec![];
        let mut cursor: Option<String> = None;
        loop {
            let mut body = json!({
                "filter": { "value": "database", "property": "object" },
                "page_size": 100
            });
            if let Some(c) = &cursor {
                body["start_cursor"] = json!(c);
            }
            let resp = self.post(&format!("{API}/search"), body).await?;
            for db in resp["results"].as_array().unwrap_or(&vec![]) {
                let id = db["id"].as_str().unwrap_or_default();
                let title = db["title"]
                    .as_array()
                    .and_then(|t| t.first())
                    .and_then(|t| t["plain_text"].as_str())
                    .unwrap_or("Untitled")
                    .to_string();
                let date_prop = db["properties"]
                    .as_object()
                    .and_then(|props| {
                        props
                            .iter()
                            .find(|(_, v)| v["type"].as_str() == Some("date"))
                            .map(|(k, _)| k.clone())
                    });
                if let Some(prop) = date_prop {
                    out.push(RemoteCalendar {
                        provider_calendar_id: format!("{id}|{prop}"),
                        name: title,
                        description: None,
                        color: None,
                        is_primary: false,
                        is_writable: false,
                    });
                }
            }
            if resp["has_more"].as_bool().unwrap_or(false) {
                cursor = resp["next_cursor"].as_str().map(String::from);
            } else {
                break;
            }
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
        let (db_id, date_prop) = provider_calendar_id
            .split_once('|')
            .ok_or_else(|| ConnectorError::Other("bad notion calendar id".into()))?;

        // Cursor: "iso|anchored_ms". Expired or absent → full reconcile.
        let since = cursor.and_then(|Cursor::Token(t)| {
            let (iso, anchored) = t.split_once('|')?;
            let anchored: i64 = anchored.parse().ok()?;
            if now_ms() - anchored > CURSOR_TTL_MS {
                None
            } else {
                Some(iso.to_string())
            }
        });
        let is_delta = since.is_some();

        let mut body = json!({ "page_size": 100 });
        if let Some(iso) = &since {
            // 5-minute overlap for the minute-granular property.
            let overlap = chrono::DateTime::parse_from_rfc3339(iso)
                .map(|d| (d - chrono::Duration::minutes(5)).to_rfc3339())
                .unwrap_or_else(|_| iso.clone());
            body["filter"] = json!({
                "timestamp": "last_edited_time",
                "last_edited_time": { "on_or_after": overlap }
            });
        }
        if let Some(pt) = page_token {
            body["start_cursor"] = json!(pt);
        }

        let resp = self
            .post(&format!("{API}/databases/{db_id}/query"), body)
            .await?;

        let events = resp["results"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|page| map_page(page, date_prop, local_calendar_id))
            .collect();

        let has_more = resp["has_more"].as_bool().unwrap_or(false);
        Ok(PullPage {
            events,
            next_cursor: if has_more {
                None
            } else {
                Some(Cursor::Token(format!(
                    "{}|{}",
                    chrono::Utc::now().to_rfc3339(),
                    now_ms()
                )))
            },
            page_token: if has_more {
                resp["next_cursor"].as_str().map(String::from)
            } else {
                None
            },
            full_resync: !is_delta,
        })
    }

    async fn push(
        &self,
        _provider_calendar_id: &str,
        _op: &str,
        _event: &EventRow,
        _base_etag: Option<&str>,
    ) -> Result<PushOutcome, ConnectorError> {
        Err(ConnectorError::Other("Notion calendars are read-only in Lokus".into()))
    }
}

/// Map a Notion page to an EventRow using the chosen date property.
/// Pages without a date value are skipped; archived pages become tombstones.
fn map_page(page: &Value, date_prop: &str, local_calendar_id: &str) -> Option<EventRow> {
    let pid = page["id"].as_str()?.to_string();
    let now = now_ms();

    if page["archived"].as_bool().unwrap_or(false) || page["in_trash"].as_bool().unwrap_or(false) {
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

    let props = page["properties"].as_object()?;
    let date = &props.get(date_prop)?["date"];
    let start_raw = date["start"].as_str()?;
    let end_raw = date["end"].as_str();

    // Title: the property whose type is "title".
    let title = props
        .values()
        .find(|v| v["type"].as_str() == Some("title"))
        .and_then(|v| v["title"].as_array())
        .map(|parts| {
            parts
                .iter()
                .filter_map(|p| p["plain_text"].as_str())
                .collect::<String>()
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Untitled".to_string());

    let mut row = EventRow {
        id: uuid::Uuid::new_v4().to_string(),
        calendar_id: local_calendar_id.to_string(),
        provider_event_id: Some(pid),
        title,
        status: "confirmed".into(),
        transparency: "opaque".into(),
        html_link: page["url"].as_str().map(String::from),
        provider_updated_at: page["last_edited_time"]
            .as_str()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.timestamp_millis()),
        created_at: now,
        updated_at: now,
        raw: Some(page.to_string()),
        ..Default::default()
    };

    if start_raw.len() == 10 {
        // Date-only → all-day. Notion's end date is inclusive → exclusive +1.
        row.all_day = true;
        row.start_date = Some(start_raw.to_string());
        let end_incl = end_raw.unwrap_or(start_raw);
        let end_excl = chrono::NaiveDate::parse_from_str(end_incl, "%Y-%m-%d")
            .ok()
            .and_then(|d| d.succ_opt())
            .map(|d| d.format("%Y-%m-%d").to_string());
        row.end_date = end_excl;
    } else {
        let start = chrono::DateTime::parse_from_rfc3339(start_raw).ok()?;
        row.start_ts = Some(start.timestamp_millis());
        let end = end_raw
            .and_then(|e| chrono::DateTime::parse_from_rfc3339(e).ok())
            .map(|d| d.timestamp_millis())
            .unwrap_or(start.timestamp_millis() + 3_600_000); // default 1h
        row.end_ts = Some(end);
    }
    Some(row)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_dated_page_all_day_inclusive_end() {
        let page = serde_json::json!({
            "id": "p1",
            "url": "https://notion.so/p1",
            "last_edited_time": "2026-08-01T10:00:00.000Z",
            "properties": {
                "Name": { "type": "title", "title": [{ "plain_text": "Launch" }] },
                "When": { "type": "date", "date": { "start": "2026-08-10", "end": "2026-08-11" } }
            }
        });
        let row = map_page(&page, "When", "cal-l").unwrap();
        assert!(row.all_day);
        assert_eq!(row.start_date.as_deref(), Some("2026-08-10"));
        assert_eq!(row.end_date.as_deref(), Some("2026-08-12")); // inclusive → exclusive
        assert_eq!(row.title, "Launch");
    }

    #[test]
    fn maps_datetime_page_with_default_duration() {
        let page = serde_json::json!({
            "id": "p2",
            "properties": {
                "Title": { "type": "title", "title": [{ "plain_text": "Call" }] },
                "Date": { "type": "date", "date": { "start": "2026-08-03T15:00:00.000+00:00", "end": null } }
            }
        });
        let row = map_page(&page, "Date", "cal-l").unwrap();
        assert!(!row.all_day);
        assert_eq!(row.end_ts.unwrap() - row.start_ts.unwrap(), 3_600_000);
    }

    #[test]
    fn archived_page_is_tombstone() {
        let page = serde_json::json!({ "id": "p3", "archived": true, "properties": {} });
        let row = map_page(&page, "Date", "cal-l").unwrap();
        assert!(row.deleted);
    }

    #[test]
    fn dateless_page_skipped() {
        let page = serde_json::json!({
            "id": "p4",
            "properties": { "Name": { "type": "title", "title": [] }, "Date": { "type": "date", "date": null } }
        });
        assert!(map_page(&page, "Date", "cal-l").is_none());
    }
}
