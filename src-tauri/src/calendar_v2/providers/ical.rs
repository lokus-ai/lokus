//! iCal subscription connector (read-only feeds; also `file://` imports).
//!
//! The feed is the whole state: every pull is a full replace (the engine's
//! full_resync sweep tombstones vanished events). RRULEs are stored raw and
//! expanded by the store — which fixes V1's silently-broken recurring iCal
//! events (V1 never expanded them). File imports are static: re-read only
//! when mtime changes (cursor = mtime).

use async_trait::async_trait;

use crate::calendar::ical::parser;
use crate::calendar_v2::connector::*;
use crate::calendar_v2::models::EventRow;

use super::common::v1_event_to_row;

pub struct IcalConnector {
    pub url: String,
    pub name: String,
}

#[async_trait]
impl CalendarConnector for IcalConnector {
    fn capabilities(&self) -> Capabilities {
        Capabilities { expands_recurrence: false, writable: false, delta: false }
    }

    async fn list_calendars(&self) -> Result<Vec<RemoteCalendar>, ConnectorError> {
        Ok(vec![RemoteCalendar {
            provider_calendar_id: self.url.clone(),
            name: self.name.clone(),
            description: None,
            color: None,
            is_primary: false,
            is_writable: false,
        }])
    }

    async fn pull(
        &self,
        provider_calendar_id: &str,
        local_calendar_id: &str,
        cursor: Option<&Cursor>,
        _page_token: Option<&str>,
    ) -> Result<PullPage, ConnectorError> {
        let is_file = provider_calendar_id.starts_with("file://");
        let content = if is_file {
            let path = provider_calendar_id.trim_start_matches("file://");
            // Static import: skip when unchanged (cursor carries the mtime).
            let mtime = std::fs::metadata(path)
                .and_then(|m| m.modified())
                .map(|t| {
                    t.duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                        .to_string()
                })
                .unwrap_or_default();
            if let Some(Cursor::Token(prev)) = cursor {
                if *prev == mtime && !mtime.is_empty() {
                    return Ok(PullPage {
                        events: vec![],
                        next_cursor: Some(Cursor::Token(mtime)),
                        page_token: None,
                        full_resync: false,
                    });
                }
            }
            let text = std::fs::read_to_string(path)
                .map_err(|e| ConnectorError::Other(format!("read {path}: {e}")))?;
            return self.finish(text, local_calendar_id, Some(mtime));
        } else {
            parser::fetch_ics_from_url(provider_calendar_id)
                .await
                .map_err(ConnectorError::Other)?
        };
        self.finish(content, local_calendar_id, None)
    }

    async fn push(
        &self,
        _provider_calendar_id: &str,
        _op: &str,
        _event: &EventRow,
        _base_etag: Option<&str>,
    ) -> Result<PushOutcome, ConnectorError> {
        Err(ConnectorError::Other("iCal subscriptions are read-only".into()))
    }
}

impl IcalConnector {
    fn finish(
        &self,
        content: String,
        local_calendar_id: &str,
        mtime_cursor: Option<String>,
    ) -> Result<PullPage, ConnectorError> {
        let parsed = parser::parse_ics_content(&content, &self.url)
            .map_err(ConnectorError::Other)?;
        let events = parsed
            .iter()
            .map(|e| v1_event_to_row(e, local_calendar_id))
            .collect();
        Ok(PullPage {
            events,
            next_cursor: mtime_cursor.map(Cursor::Token),
            page_token: None,
            full_resync: true,
        })
    }
}
