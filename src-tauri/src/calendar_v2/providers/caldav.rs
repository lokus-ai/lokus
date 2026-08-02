//! CalDAV / iCloud connector — wraps the proven V1 `CalDAVClient` (WebDAV
//! discovery, calendar-query REPORT, ics parsing) behind the V2 trait.
//!
//! Change detection: each calendar's CTag (returned by list_calendars as
//! `sync_token`) is the cursor; when it's unchanged the pull is a no-op, when
//! it changed we refetch the ±12-month window and let the engine's
//! full-resync sweep tombstone what vanished. RFC 6578 sync-collection is a
//! future bandwidth optimization — CTag-gated refetch has the same
//! correctness with simpler failure modes (no 507/403 token dance).

use async_trait::async_trait;
use chrono::{Duration, Utc};

use crate::calendar::caldav::CalDAVClient;
use crate::calendar::models::{CalDAVAccount, CreateEventRequest, UpdateEventRequest};
use crate::calendar_v2::connector::*;
use crate::calendar_v2::creds;
use crate::calendar_v2::models::EventRow;

use super::common::v1_event_to_row;

pub struct CalDavConnector {
    account_id: String,
    config: serde_json::Value,
}

impl CalDavConnector {
    pub fn new(account_id: String, config: serde_json::Value) -> Self {
        Self { account_id, config }
    }

    fn client(&self) -> Result<CalDAVClient, ConnectorError> {
        let password = creds::load(&self.account_id)
            .map_err(ConnectorError::Other)?
            .ok_or(ConnectorError::AuthExpired)?
            .access;
        let account = CalDAVAccount {
            id: self.account_id.clone(),
            server_url: self.config["server_url"].as_str().unwrap_or_default().to_string(),
            username: self.config["username"].as_str().unwrap_or_default().to_string(),
            password,
            display_name: None,
            principal_url: self.config["principal_url"].as_str().map(String::from),
            calendar_home_url: self.config["calendar_home_url"].as_str().map(String::from),
            is_connected: true,
            connected_at: None,
            last_synced: None,
        };
        CalDAVClient::new(account).map_err(|e| ConnectorError::Other(e.to_string()))
    }
}

#[async_trait]
impl CalendarConnector for CalDavConnector {
    fn capabilities(&self) -> Capabilities {
        Capabilities { expands_recurrence: false, writable: true, delta: true }
    }

    async fn list_calendars(&self) -> Result<Vec<RemoteCalendar>, ConnectorError> {
        let client = self.client()?;
        let cals = client
            .list_calendars()
            .await
            .map_err(|e| map_v1_err(e))?;
        Ok(cals
            .into_iter()
            .map(|c| RemoteCalendar {
                provider_calendar_id: c.id,
                name: c.name,
                description: c.description,
                color: c.color,
                is_primary: c.is_primary,
                is_writable: c.is_writable,
            })
            .collect())
    }

    async fn pull(
        &self,
        provider_calendar_id: &str,
        local_calendar_id: &str,
        cursor: Option<&Cursor>,
        _page_token: Option<&str>,
    ) -> Result<PullPage, ConnectorError> {
        let client = self.client()?;

        // CTag gate: unchanged collection → nothing to do.
        let current_ctag = client
            .list_calendars()
            .await
            .map_err(map_v1_err)?
            .into_iter()
            .find(|c| c.id == provider_calendar_id)
            .and_then(|c| c.sync_token);
        if let (Some(Cursor::Token(prev)), Some(cur)) = (cursor, current_ctag.as_ref()) {
            if prev == cur {
                return Ok(PullPage {
                    events: vec![],
                    next_cursor: Some(Cursor::Token(cur.clone())),
                    page_token: None,
                    full_resync: false,
                });
            }
        }

        let now = Utc::now();
        let events = client
            .get_events(provider_calendar_id, now - Duration::days(365), now + Duration::days(365))
            .await
            .map_err(map_v1_err)?;

        Ok(PullPage {
            events: events
                .iter()
                .map(|e| v1_event_to_row(e, local_calendar_id))
                .collect(),
            next_cursor: current_ctag.map(Cursor::Token),
            page_token: None,
            full_resync: true,
        })
    }

    async fn push(
        &self,
        provider_calendar_id: &str,
        op: &str,
        event: &EventRow,
        base_etag: Option<&str>,
    ) -> Result<PushOutcome, ConnectorError> {
        let client = self.client()?;
        let to_utc = |ms: Option<i64>| {
            chrono::TimeZone::timestamp_millis_opt(&Utc, ms.unwrap_or(0)).single().unwrap_or_else(Utc::now)
        };
        // All-day rows carry civil dates; V1's client writes DATE values from
        // the all_day flag using these instants at UTC midnight.
        let (start, end) = if event.all_day {
            let parse = |d: &Option<String>| {
                d.as_deref()
                    .and_then(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").ok())
                    .and_then(|d| d.and_hms_opt(0, 0, 0))
                    .map(|n| chrono::TimeZone::from_utc_datetime(&Utc, &n))
                    .unwrap_or_else(Utc::now)
            };
            (parse(&event.start_date), parse(&event.end_date))
        } else {
            (to_utc(event.start_ts), to_utc(event.end_ts))
        };

        match op {
            "create" => {
                let req = CreateEventRequest {
                    title: event.title.clone(),
                    description: event.description.clone(),
                    start,
                    end,
                    all_day: event.all_day,
                    location: event.location.clone(),
                    attendees: None,
                    recurrence_rule: event.rrule.clone(),
                };
                let created = client
                    .create_event(provider_calendar_id, &req)
                    .await
                    .map_err(map_v1_err)?;
                Ok(PushOutcome::Applied { provider_event_id: created.id, etag: created.etag })
            }
            "update" => {
                let pid = event
                    .provider_event_id
                    .as_deref()
                    .ok_or_else(|| ConnectorError::Other("update without provider id".into()))?;
                let req = UpdateEventRequest {
                    title: Some(event.title.clone()),
                    description: event.description.clone(),
                    start: Some(start),
                    end: Some(end),
                    all_day: Some(event.all_day),
                    location: event.location.clone(),
                    attendees: None,
                    recurrence_rule: event.rrule.clone(),
                    status: None,
                };
                let updated = client
                    .update_event(provider_calendar_id, pid, &req, base_etag)
                    .await
                    .map_err(map_v1_err)?;
                Ok(PushOutcome::Applied { provider_event_id: updated.id, etag: updated.etag })
            }
            "delete" => {
                let pid = event
                    .provider_event_id
                    .as_deref()
                    .ok_or_else(|| ConnectorError::Other("delete without provider id".into()))?;
                client
                    .delete_event(provider_calendar_id, pid, base_etag)
                    .await
                    .map_err(map_v1_err)?;
                Ok(PushOutcome::Deleted)
            }
            other => Err(ConnectorError::Other(format!("unknown op {other}"))),
        }
    }
}

fn map_v1_err(e: crate::calendar::models::CalendarError) -> ConnectorError {
    use crate::calendar::models::CalendarError as E;
    match e {
        E::Auth(_) | E::TokenExpired | E::NotConnected => ConnectorError::AuthExpired,
        E::RateLimit => ConnectorError::RateLimited(120),
        // 412 surfaces as Api("...412...") from the V1 client.
        E::Api(msg) if msg.contains("412") => ConnectorError::Other("conflict:412".into()),
        other => ConnectorError::Other(other.to_string()),
    }
}
