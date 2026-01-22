use crate::calendar::models::{
    Calendar, CalendarEvent, CalendarProvider, CalendarError,
    EventAttendee, AttendeeResponseStatus, EventStatus,
    CreateEventRequest, UpdateEventRequest,
};
use crate::calendar::google::auth::GoogleCalendarAuth;
use reqwest::Client;
use serde_json;
use chrono::{DateTime, Utc, TimeZone};

const CALENDAR_API_BASE: &str = "https://www.googleapis.com/calendar/v3";

pub struct GoogleCalendarApi {
    auth: GoogleCalendarAuth,
    client: Client,
}

impl GoogleCalendarApi {
    pub fn new() -> Result<Self, CalendarError> {
        let auth = GoogleCalendarAuth::new()?;
        let client = Client::new();
        Ok(Self { auth, client })
    }

    /// List all calendars for the authenticated user
    pub async fn list_calendars(&self) -> Result<Vec<Calendar>, CalendarError> {
        let token = self.auth.get_valid_token().await?;

        let response = self.client
            .get(&format!("{}/users/me/calendarList", CALENDAR_API_BASE))
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(CalendarError::Api(format!("Failed to list calendars: {}", error_text)));
        }

        let data: serde_json::Value = response.json().await?;
        let items = data["items"].as_array()
            .ok_or_else(|| CalendarError::Parse("No items in calendar list response".to_string()))?;

        let calendars: Vec<Calendar> = items
            .iter()
            .map(|item| self.parse_calendar(item))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(calendars)
    }

    /// Get events from a calendar within a time range
    pub async fn get_events(
        &self,
        calendar_id: &str,
        time_min: DateTime<Utc>,
        time_max: DateTime<Utc>,
        max_results: Option<u32>,
    ) -> Result<Vec<CalendarEvent>, CalendarError> {
        let token = self.auth.get_valid_token().await?;

        let mut url = format!(
            "{}/calendars/{}/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime",
            CALENDAR_API_BASE,
            urlencoding::encode(calendar_id),
            urlencoding::encode(&time_min.to_rfc3339()),
            urlencoding::encode(&time_max.to_rfc3339())
        );

        if let Some(max) = max_results {
            url.push_str(&format!("&maxResults={}", max));
        }

        println!("[Calendar API] GET {}", url);

        let response = self.client
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        println!("[Calendar API] Response status: {}", response.status());

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            println!("[Calendar API] Error response: {}", error_text);
            return Err(CalendarError::Api(format!("Failed to get events: {}", error_text)));
        }

        let data: serde_json::Value = response.json().await?;
        let empty_vec = vec![];
        let items = data["items"].as_array()
            .unwrap_or(&empty_vec);

        let events: Vec<CalendarEvent> = items
            .iter()
            .filter_map(|item| self.parse_event(item, calendar_id).ok())
            .collect();

        Ok(events)
    }

    /// Get a single event by ID
    pub async fn get_event(
        &self,
        calendar_id: &str,
        event_id: &str,
    ) -> Result<CalendarEvent, CalendarError> {
        let token = self.auth.get_valid_token().await?;

        let url = format!(
            "{}/calendars/{}/events/{}",
            CALENDAR_API_BASE,
            urlencoding::encode(calendar_id),
            urlencoding::encode(event_id)
        );

        let response = self.client
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(CalendarError::NotFound(format!("Event {} not found", event_id)));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(CalendarError::Api(format!("Failed to get event: {}", error_text)));
        }

        let data: serde_json::Value = response.json().await?;
        self.parse_event(&data, calendar_id)
    }

    /// Create a new event
    pub async fn create_event(
        &self,
        calendar_id: &str,
        request: &CreateEventRequest,
    ) -> Result<CalendarEvent, CalendarError> {
        let token = self.auth.get_valid_token().await?;

        let url = format!(
            "{}/calendars/{}/events",
            CALENDAR_API_BASE,
            urlencoding::encode(calendar_id)
        );

        let event_body = self.build_event_body(request);

        let response = self.client
            .post(&url)
            .bearer_auth(&token.access_token)
            .json(&event_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(CalendarError::Api(format!("Failed to create event: {}", error_text)));
        }

        let data: serde_json::Value = response.json().await?;
        self.parse_event(&data, calendar_id)
    }

    /// Update an existing event
    pub async fn update_event(
        &self,
        calendar_id: &str,
        event_id: &str,
        request: &UpdateEventRequest,
    ) -> Result<CalendarEvent, CalendarError> {
        let token = self.auth.get_valid_token().await?;

        // First, get the existing event
        let existing = self.get_event(calendar_id, event_id).await?;

        let url = format!(
            "{}/calendars/{}/events/{}",
            CALENDAR_API_BASE,
            urlencoding::encode(calendar_id),
            urlencoding::encode(event_id)
        );

        let event_body = self.build_update_body(&existing, request);

        let response = self.client
            .put(&url)
            .bearer_auth(&token.access_token)
            .json(&event_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(CalendarError::Api(format!("Failed to update event: {}", error_text)));
        }

        let data: serde_json::Value = response.json().await?;
        self.parse_event(&data, calendar_id)
    }

    /// Delete an event
    pub async fn delete_event(
        &self,
        calendar_id: &str,
        event_id: &str,
    ) -> Result<(), CalendarError> {
        let token = self.auth.get_valid_token().await?;

        let url = format!(
            "{}/calendars/{}/events/{}",
            CALENDAR_API_BASE,
            urlencoding::encode(calendar_id),
            urlencoding::encode(event_id)
        );

        let response = self.client
            .delete(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(CalendarError::NotFound(format!("Event {} not found", event_id)));
        }

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(CalendarError::Api(format!("Failed to delete event: {}", error_text)));
        }

        Ok(())
    }

    // Helper methods for parsing responses

    fn parse_calendar(&self, data: &serde_json::Value) -> Result<Calendar, CalendarError> {
        Ok(Calendar {
            id: data["id"]
                .as_str()
                .ok_or_else(|| CalendarError::Parse("Missing calendar id".to_string()))?
                .to_string(),
            provider: CalendarProvider::Google,
            name: data["summary"]
                .as_str()
                .unwrap_or("Unnamed Calendar")
                .to_string(),
            description: data["description"].as_str().map(String::from),
            color: data["backgroundColor"].as_str().map(String::from),
            is_primary: data["primary"].as_bool().unwrap_or(false),
            is_writable: data["accessRole"].as_str()
                .map(|role| role == "owner" || role == "writer")
                .unwrap_or(false),
            sync_token: None,
            last_synced: None,
            visible: !data["hidden"].as_bool().unwrap_or(false),
        })
    }

    fn parse_event(&self, data: &serde_json::Value, calendar_id: &str) -> Result<CalendarEvent, CalendarError> {
        let id = data["id"]
            .as_str()
            .ok_or_else(|| CalendarError::Parse("Missing event id".to_string()))?
            .to_string();

        let title = data["summary"]
            .as_str()
            .unwrap_or("(No title)")
            .to_string();

        // Parse start/end times
        let (start, all_day) = self.parse_event_time(&data["start"])?;
        let (end, _) = self.parse_event_time(&data["end"])?;

        // Parse attendees
        let attendees = data["attendees"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| self.parse_attendee(a).ok())
                    .collect()
            })
            .unwrap_or_default();

        // Parse status
        let status = match data["status"].as_str() {
            Some("confirmed") => EventStatus::Confirmed,
            Some("tentative") => EventStatus::Tentative,
            Some("cancelled") => EventStatus::Cancelled,
            _ => EventStatus::Confirmed,
        };

        Ok(CalendarEvent {
            id,
            calendar_id: calendar_id.to_string(),
            provider: CalendarProvider::Google,
            title,
            description: data["description"].as_str().map(String::from),
            start,
            end,
            all_day,
            location: data["location"].as_str().map(String::from),
            attendees,
            recurrence_rule: data["recurrence"]
                .as_array()
                .and_then(|arr| arr.first())
                .and_then(|v| v.as_str())
                .map(String::from),
            status,
            created_at: data["created"]
                .as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            updated_at: data["updated"]
                .as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc)),
            etag: data["etag"].as_str().map(String::from),
            html_link: data["htmlLink"].as_str().map(String::from),
            color_id: data["colorId"].as_str().map(String::from),
        })
    }

    fn parse_event_time(&self, data: &serde_json::Value) -> Result<(DateTime<Utc>, bool), CalendarError> {
        // Check for all-day event (date only, no dateTime)
        if let Some(date_str) = data["date"].as_str() {
            // Parse date-only format (YYYY-MM-DD)
            let naive_date = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
                .map_err(|e| CalendarError::Parse(format!("Invalid date format: {}", e)))?;
            let datetime = Utc.from_utc_datetime(&naive_date.and_hms_opt(0, 0, 0).unwrap());
            return Ok((datetime, true));
        }

        // Parse dateTime format
        if let Some(datetime_str) = data["dateTime"].as_str() {
            let datetime = DateTime::parse_from_rfc3339(datetime_str)
                .map_err(|e| CalendarError::Parse(format!("Invalid dateTime format: {}", e)))?
                .with_timezone(&Utc);
            return Ok((datetime, false));
        }

        Err(CalendarError::Parse("Missing date or dateTime in event".to_string()))
    }

    fn parse_attendee(&self, data: &serde_json::Value) -> Result<EventAttendee, CalendarError> {
        Ok(EventAttendee {
            email: data["email"]
                .as_str()
                .ok_or_else(|| CalendarError::Parse("Missing attendee email".to_string()))?
                .to_string(),
            name: data["displayName"].as_str().map(String::from),
            response_status: match data["responseStatus"].as_str() {
                Some("needsAction") => AttendeeResponseStatus::NeedsAction,
                Some("declined") => AttendeeResponseStatus::Declined,
                Some("tentative") => AttendeeResponseStatus::Tentative,
                Some("accepted") => AttendeeResponseStatus::Accepted,
                _ => AttendeeResponseStatus::NeedsAction,
            },
            is_organizer: data["organizer"].as_bool().unwrap_or(false),
        })
    }

    fn build_event_body(&self, request: &CreateEventRequest) -> serde_json::Value {
        let mut body = serde_json::json!({
            "summary": request.title,
        });

        if let Some(ref desc) = request.description {
            body["description"] = serde_json::json!(desc);
        }

        if let Some(ref loc) = request.location {
            body["location"] = serde_json::json!(loc);
        }

        // Set start/end times
        if request.all_day {
            body["start"] = serde_json::json!({
                "date": request.start.format("%Y-%m-%d").to_string()
            });
            body["end"] = serde_json::json!({
                "date": request.end.format("%Y-%m-%d").to_string()
            });
        } else {
            body["start"] = serde_json::json!({
                "dateTime": request.start.to_rfc3339()
            });
            body["end"] = serde_json::json!({
                "dateTime": request.end.to_rfc3339()
            });
        }

        // Add attendees
        if let Some(ref attendees) = request.attendees {
            body["attendees"] = serde_json::json!(
                attendees.iter().map(|email| {
                    serde_json::json!({ "email": email })
                }).collect::<Vec<_>>()
            );
        }

        // Add recurrence
        if let Some(ref rrule) = request.recurrence_rule {
            body["recurrence"] = serde_json::json!([rrule]);
        }

        body
    }

    fn build_update_body(&self, existing: &CalendarEvent, request: &UpdateEventRequest) -> serde_json::Value {
        let title = request.title.as_ref().unwrap_or(&existing.title);
        let description = request.description.as_ref().or(existing.description.as_ref());
        let location = request.location.as_ref().or(existing.location.as_ref());
        let start = request.start.unwrap_or(existing.start);
        let end = request.end.unwrap_or(existing.end);
        let all_day = request.all_day.unwrap_or(existing.all_day);

        let mut body = serde_json::json!({
            "summary": title,
        });

        if let Some(desc) = description {
            body["description"] = serde_json::json!(desc);
        }

        if let Some(loc) = location {
            body["location"] = serde_json::json!(loc);
        }

        // Set start/end times
        if all_day {
            body["start"] = serde_json::json!({
                "date": start.format("%Y-%m-%d").to_string()
            });
            body["end"] = serde_json::json!({
                "date": end.format("%Y-%m-%d").to_string()
            });
        } else {
            body["start"] = serde_json::json!({
                "dateTime": start.to_rfc3339()
            });
            body["end"] = serde_json::json!({
                "dateTime": end.to_rfc3339()
            });
        }

        // Update status if provided
        if let Some(ref status) = request.status {
            body["status"] = serde_json::json!(match status {
                EventStatus::Confirmed => "confirmed",
                EventStatus::Tentative => "tentative",
                EventStatus::Cancelled => "cancelled",
            });
        }

        // Update attendees if provided
        if let Some(ref attendees) = request.attendees {
            body["attendees"] = serde_json::json!(
                attendees.iter().map(|email| {
                    serde_json::json!({ "email": email })
                }).collect::<Vec<_>>()
            );
        }

        // Update recurrence if provided
        if let Some(ref rrule) = request.recurrence_rule {
            body["recurrence"] = serde_json::json!([rrule]);
        }

        body
    }
}
