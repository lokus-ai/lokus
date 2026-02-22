use crate::calendar::models::{
    Calendar, CalendarEvent, CalendarProvider, CalDAVAccount, CalendarError,
    CreateEventRequest, UpdateEventRequest,
};
use crate::calendar::ical;
use chrono::{DateTime, Utc};
use reqwest::{Client, Method, StatusCode};
use uuid::Uuid;

/// CalDAV client for interacting with CalDAV servers (iCloud, Fastmail, etc.)
pub struct CalDAVClient {
    client: Client,
    account: CalDAVAccount,
}

impl CalDAVClient {
    /// Create a new CalDAV client
    pub fn new(account: CalDAVAccount) -> Result<Self, CalendarError> {
        // Don't auto-follow redirects - we need to handle them manually to preserve auth headers
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        Ok(Self { client, account })
    }

    /// Send request with manual redirect handling to preserve auth headers
    async fn send_with_auth(&self, method: &[u8], url: &str, body: String) -> Result<reqwest::Response, CalendarError> {
        let mut current_url = url.to_string();
        let mut redirects = 0;
        const MAX_REDIRECTS: u32 = 10;

        loop {
            println!("[CalDAV] Requesting: {} {}", String::from_utf8_lossy(method), current_url);

            let response = self.client
                .request(Method::from_bytes(method).unwrap(), &current_url)
                .header("Authorization", self.auth_header())
                .header("Content-Type", "application/xml; charset=utf-8")
                .header("Depth", "0")
                .header("User-Agent", "Lokus/1.0 (CalDAV Client)")
                .body(body.clone())
                .send()
                .await
                .map_err(|e| CalendarError::Network(e.to_string()))?;

            let status = response.status();
            println!("[CalDAV] Response status: {}", status);

            // Handle redirects manually
            if status.is_redirection() {
                redirects += 1;
                if redirects > MAX_REDIRECTS {
                    return Err(CalendarError::Network("Too many redirects".to_string()));
                }

                if let Some(location) = response.headers().get("location") {
                    let location_str = location.to_str()
                        .map_err(|_| CalendarError::Network("Invalid redirect location".to_string()))?;

                    // Resolve relative URLs
                    current_url = if location_str.starts_with("http") {
                        location_str.to_string()
                    } else {
                        // Parse base URL and resolve relative path
                        let base = url::Url::parse(&current_url)
                            .map_err(|e| CalendarError::Network(e.to_string()))?;
                        base.join(location_str)
                            .map_err(|e| CalendarError::Network(e.to_string()))?
                            .to_string()
                    };
                    println!("[CalDAV] Following redirect to: {}", current_url);
                    continue;
                }
            }

            return Ok(response);
        }
    }

    /// Build authorization header
    fn auth_header(&self) -> String {
        use base64::Engine;
        let credentials = format!("{}:{}", self.account.username, self.account.password);
        let encoded = base64::engine::general_purpose::STANDARD.encode(credentials.as_bytes());
        format!("Basic {}", encoded)
    }

    /// Discover the principal URL for the user
    pub async fn discover_principal(&mut self) -> Result<String, CalendarError> {
        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:current-user-principal/>
  </D:prop>
</D:propfind>"#;

        // Try .well-known/caldav first (standard discovery method)
        let well_known_url = format!("{}/.well-known/caldav", self.account.server_url.trim_end_matches('/'));
        println!("[CalDAV] Connecting as user: {}", self.account.username);
        println!("[CalDAV] Password length: {} chars", self.account.password.len());
        println!("[CalDAV] Trying .well-known discovery at: {}", well_known_url);

        let well_known_response = self.send_with_auth(b"PROPFIND", &well_known_url, body.to_string()).await;

        // If .well-known works, use its response; otherwise fall back to base URL
        let response = match well_known_response {
            Ok(resp) if resp.status().is_success() || resp.status() == StatusCode::MULTI_STATUS => {
                println!("[CalDAV] .well-known discovery succeeded with status: {}", resp.status());
                resp
            }
            Ok(resp) => {
                println!("[CalDAV] .well-known returned {}, trying base URL", resp.status());
                self.send_with_auth(b"PROPFIND", &self.account.server_url, body.to_string()).await?
            }
            Err(e) => {
                println!("[CalDAV] .well-known failed: {}, trying base URL", e);
                self.send_with_auth(b"PROPFIND", &self.account.server_url, body.to_string()).await?
            }
        };

        if !response.status().is_success() && response.status() != StatusCode::MULTI_STATUS {
            return Err(CalendarError::Auth(format!(
                "Failed to discover principal: {} - Check your credentials",
                response.status()
            )));
        }

        let text = response.text().await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        println!("[CalDAV] Principal response length: {} bytes", text.len());
        println!("[CalDAV] Principal response preview: {}", &text[..text.len().min(800)]);

        // Parse the principal URL from XML response
        let principal_url = self.parse_principal_url(&text)?;
        println!("[CalDAV] Discovered principal URL: {}", principal_url);
        self.account.principal_url = Some(principal_url.clone());

        Ok(principal_url)
    }

    /// Discover the calendar home URL
    pub async fn discover_calendar_home(&mut self) -> Result<String, CalendarError> {
        let principal_url = self.account.principal_url.clone()
            .ok_or_else(|| CalendarError::InvalidRequest("Principal URL not discovered".to_string()))?;

        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>"#;

        let url = self.resolve_url(&principal_url);
        let response = self.client
            .request(Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/xml; charset=utf-8")
            .header("Depth", "0")
            .body(body)
            .send()
            .await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        if !response.status().is_success() && response.status() != StatusCode::MULTI_STATUS {
            return Err(CalendarError::Api(format!(
                "Failed to discover calendar home: {}",
                response.status()
            )));
        }

        let text = response.text().await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        println!("[CalDAV] Calendar home response length: {} bytes", text.len());

        let home_url = self.parse_calendar_home_url(&text)?;
        println!("[CalDAV] Discovered calendar home URL: {}", home_url);
        self.account.calendar_home_url = Some(home_url.clone());

        Ok(home_url)
    }

    /// List all calendars
    pub async fn list_calendars(&self) -> Result<Vec<Calendar>, CalendarError> {
        let home_url = self.account.calendar_home_url.clone()
            .ok_or_else(|| CalendarError::InvalidRequest("Calendar home URL not discovered".to_string()))?;

        println!("[CalDAV] Listing calendars from: {}", home_url);

        let body = r#"<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:CS="http://calendarserver.org/ns/" xmlns:IC="http://apple.com/ns/ical/">
  <D:prop>
    <D:displayname/>
    <D:resourcetype/>
    <CS:getctag/>
    <IC:calendar-color/>
    <C:supported-calendar-component-set/>
  </D:prop>
</D:propfind>"#;

        let url = self.resolve_url(&home_url);
        println!("[CalDAV] PROPFIND URL: {}", url);

        let response = self.client
            .request(Method::from_bytes(b"PROPFIND").unwrap(), &url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/xml; charset=utf-8")
            .header("Depth", "1")
            .header("User-Agent", "Lokus/1.0 (CalDAV Client)")
            .body(body)
            .send()
            .await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        println!("[CalDAV] list_calendars response status: {}", response.status());

        if !response.status().is_success() && response.status() != StatusCode::MULTI_STATUS {
            return Err(CalendarError::Api(format!(
                "Failed to list calendars: {}",
                response.status()
            )));
        }

        let text = response.text().await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        println!("[CalDAV] list_calendars response length: {} bytes", text.len());
        println!("[CalDAV] list_calendars response preview: {}", &text[..text.len().min(500)]);

        let calendars = self.parse_calendars(&text, &home_url)?;
        println!("[CalDAV] Parsed {} calendars", calendars.len());
        for cal in &calendars {
            println!("[CalDAV]   - {} ({})", cal.name, cal.id);
        }

        Ok(calendars)
    }

    /// Get events from a calendar within a time range
    pub async fn get_events(
        &self,
        calendar_url: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<CalendarEvent>, CalendarError> {
        println!("[CalDAV] get_events for {} from {} to {}", calendar_url, start, end);

        let body = format!(
            r#"<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag/>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="{}" end="{}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>"#,
            start.format("%Y%m%dT%H%M%SZ"),
            end.format("%Y%m%dT%H%M%SZ")
        );

        let url = self.resolve_url(calendar_url);
        println!("[CalDAV] REPORT URL: {}", url);

        let response = self.client
            .request(Method::from_bytes(b"REPORT").unwrap(), &url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "application/xml; charset=utf-8")
            .header("Depth", "1")
            .body(body)
            .send()
            .await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        println!("[CalDAV] REPORT response status: {}", response.status());

        if !response.status().is_success() && response.status() != StatusCode::MULTI_STATUS {
            return Err(CalendarError::Api(format!(
                "Failed to get events: {}",
                response.status()
            )));
        }

        let text = response.text().await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        println!("[CalDAV] REPORT response length: {} bytes", text.len());
        println!("[CalDAV] REPORT response preview: {}", &text[..text.len().min(1000)]);

        self.parse_events(&text, calendar_url)
    }

    /// Create a new event
    pub async fn create_event(
        &self,
        calendar_url: &str,
        event: &CreateEventRequest,
    ) -> Result<CalendarEvent, CalendarError> {
        let uid = Uuid::new_v4().to_string();
        let ics_content = self.create_ics_event(&uid, event);

        let event_url = format!("{}/{}.ics", calendar_url.trim_end_matches('/'), uid);
        let url = self.resolve_url(&event_url);

        let response = self.client
            .put(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "text/calendar; charset=utf-8")
            .header("If-None-Match", "*")
            .body(ics_content.clone())
            .send()
            .await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CalendarError::Api(format!(
                "Failed to create event: {}",
                response.status()
            )));
        }

        // Parse the created event from the ICS content
        let events = ical::parse_ics_content(&ics_content, calendar_url)
            .map_err(|e| CalendarError::Parse(e))?;

        events.into_iter().next()
            .ok_or_else(|| CalendarError::Parse("Failed to parse created event".to_string()))
    }

    /// Update an existing event
    pub async fn update_event(
        &self,
        calendar_url: &str,
        event_id: &str,
        updates: &UpdateEventRequest,
        etag: Option<&str>,
    ) -> Result<CalendarEvent, CalendarError> {
        // First, fetch the existing event to get current data
        let event_url = format!("{}/{}.ics", calendar_url.trim_end_matches('/'), event_id);
        let url = self.resolve_url(&event_url);

        // Fetch existing event
        let existing = self.client
            .get(&url)
            .header("Authorization", self.auth_header())
            .send()
            .await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        if !existing.status().is_success() {
            return Err(CalendarError::NotFound(format!("Event not found: {}", event_id)));
        }

        let existing_ics = existing.text().await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        // Update the ICS content
        let updated_ics = self.update_ics_event(&existing_ics, updates)?;

        // PUT the updated event
        let mut request = self.client
            .put(&url)
            .header("Authorization", self.auth_header())
            .header("Content-Type", "text/calendar; charset=utf-8");

        if let Some(etag) = etag {
            request = request.header("If-Match", etag);
        }

        let response = request
            .body(updated_ics.clone())
            .send()
            .await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(CalendarError::Api(format!(
                "Failed to update event: {}",
                response.status()
            )));
        }

        // Parse the updated event
        let events = ical::parse_ics_content(&updated_ics, calendar_url)
            .map_err(|e| CalendarError::Parse(e))?;

        events.into_iter().next()
            .ok_or_else(|| CalendarError::Parse("Failed to parse updated event".to_string()))
    }

    /// Delete an event
    pub async fn delete_event(
        &self,
        calendar_url: &str,
        event_id: &str,
        etag: Option<&str>,
    ) -> Result<(), CalendarError> {
        let event_url = format!("{}/{}.ics", calendar_url.trim_end_matches('/'), event_id);
        let url = self.resolve_url(&event_url);

        let mut request = self.client
            .delete(&url)
            .header("Authorization", self.auth_header());

        if let Some(etag) = etag {
            request = request.header("If-Match", etag);
        }

        let response = request
            .send()
            .await
            .map_err(|e| CalendarError::Network(e.to_string()))?;

        if !response.status().is_success() && response.status() != StatusCode::NO_CONTENT {
            return Err(CalendarError::Api(format!(
                "Failed to delete event: {}",
                response.status()
            )));
        }

        Ok(())
    }

    /// Get updated account with discovered URLs
    #[allow(dead_code)]
    pub fn get_account(&self) -> &CalDAVAccount {
        &self.account
    }

    // Helper: Resolve relative URLs
    fn resolve_url(&self, path: &str) -> String {
        if path.starts_with("http://") || path.starts_with("https://") {
            return path.to_string();
        }

        // Use calendar_home_url if available to get the correct server
        // (iCloud redirects to a different host like p123-caldav.icloud.com)
        if let Some(ref home_url) = self.account.calendar_home_url {
            if let Ok(parsed) = url::Url::parse(home_url) {
                // Extract scheme://host:port from calendar_home_url
                let base = format!("{}://{}", parsed.scheme(),
                    parsed.host_str().unwrap_or(""));
                let base_with_port = if let Some(port) = parsed.port() {
                    format!("{}:{}", base, port)
                } else {
                    base
                };
                return format!("{}{}", base_with_port, path);
            }
        }

        // Fallback to server_url
        let base = self.account.server_url.trim_end_matches('/');
        format!("{}{}", base, path)
    }

    // Helper: Parse principal URL from XML
    fn parse_principal_url(&self, xml: &str) -> Result<String, CalendarError> {
        // Make case-insensitive search
        let xml_lower = xml.to_lowercase();

        // Look for current-user-principal with any namespace prefix
        let principal_patterns = [
            "current-user-principal>",
            "current-user-principal />", // self-closing with unauthenticated
        ];

        for pattern in principal_patterns {
            if let Some(idx) = xml_lower.find(pattern) {
                // Find the start of the tag
                let tag_start = xml_lower[..idx].rfind('<').unwrap_or(0);
                let remaining = &xml[tag_start..];

                // Look for href in this section
                if let Some(href) = self.find_href_in_section(remaining) {
                    if !href.is_empty() {
                        return Ok(href);
                    }
                }
            }
        }

        // Try regex-like pattern for href after principal
        if let Some(href) = self.extract_href_after_pattern(&xml_lower, xml, "current-user-principal") {
            return Ok(href);
        }

        Err(CalendarError::Parse(format!(
            "Could not find principal URL. Response preview: {}...",
            &xml[..xml.len().min(500)]
        )))
    }

    // Helper: Find href value in a section of XML
    fn find_href_in_section(&self, section: &str) -> Option<String> {
        let section_lower = section.to_lowercase();

        // Find <href or <*:href (with possible attributes like xmlns)
        let href_patterns = ["<href>", "<href ", "<d:href>", "<d:href "];

        for pattern in href_patterns {
            if let Some(tag_start) = section_lower.find(pattern) {
                // Find the end of the opening tag (the >)
                let after_tag_name = tag_start + pattern.len() - 1; // -1 because pattern ends with > or space
                let remaining = &section_lower[after_tag_name..];

                // Find the closing > of the opening tag
                let content_start = if pattern.ends_with('>') {
                    after_tag_name + 1
                } else {
                    // Has attributes, find the >
                    if let Some(close_bracket) = remaining.find('>') {
                        after_tag_name + close_bracket + 1
                    } else {
                        continue;
                    }
                };

                // Find the closing </href> or </d:href>
                let after_content = &section_lower[content_start..];
                if let Some(close_idx) = after_content.find("</").or_else(|| after_content.find("</")) {
                    let content = section[content_start..content_start + close_idx].trim();
                    if !content.is_empty() && !content.starts_with('<') {
                        return Some(content.to_string());
                    }
                }
            }
        }
        None
    }

    // Helper: Extract href after a pattern
    fn extract_href_after_pattern(&self, xml_lower: &str, xml: &str, pattern: &str) -> Option<String> {
        let start = xml_lower.find(pattern)?;
        let after_pattern = &xml[start..];
        let after_pattern_lower = &xml_lower[start..];

        // Look for href within the next 500 chars
        let search_range = after_pattern_lower.len().min(500);
        let search_section = &after_pattern_lower[..search_range];

        // Try to find <href> or <href with attributes
        let href_patterns = ["<href>", "<href "];
        for href_pattern in href_patterns {
            if let Some(href_start) = search_section.find(href_pattern) {
                // Find the > that closes the opening tag
                let after_href = &search_section[href_start + href_pattern.len() - 1..];
                let content_start = if href_pattern.ends_with('>') {
                    href_start + href_pattern.len()
                } else {
                    // Has attributes, find the >
                    if let Some(close_bracket) = after_href.find('>') {
                        href_start + href_pattern.len() - 1 + close_bracket + 1
                    } else {
                        continue;
                    }
                };

                if content_start < search_range {
                    // Find end of content (before next <)
                    if let Some(end) = after_pattern[content_start..].find('<') {
                        let content = after_pattern[content_start..content_start + end].trim();
                        if !content.is_empty() {
                            return Some(content.to_string());
                        }
                    }
                }
            }
        }
        None
    }

    // Helper: Find element content by tag name (more flexible)
    fn find_element_content(&self, xml: &str, tag: &str) -> Option<String> {
        let xml_lower = xml.to_lowercase();
        let tag_lower = tag.to_lowercase();

        // Try patterns like <displayname>, <d:displayname>, etc.
        let patterns = [
            format!("<{}>", tag_lower),
            format!("<d:{}>", tag_lower),
            format!("<{}:{}>" , "d", tag_lower),
        ];

        for pattern in &patterns {
            if let Some(start_idx) = xml_lower.find(pattern.as_str()) {
                let content_start = start_idx + pattern.len();
                // Find the closing tag
                if let Some(end_offset) = xml_lower[content_start..].find("</") {
                    let content = xml[content_start..content_start + end_offset].trim();
                    if !content.is_empty() && !content.starts_with('<') {
                        return Some(content.to_string());
                    }
                }
            }
        }

        // Also try with xmlns attribute like <displayname xmlns="DAV:">
        let pattern_with_xmlns = format!("<{} ", tag_lower);
        if let Some(start_idx) = xml_lower.find(&pattern_with_xmlns) {
            // Find the > that closes the opening tag
            if let Some(close_bracket) = xml_lower[start_idx..].find('>') {
                let content_start = start_idx + close_bracket + 1;
                if let Some(end_offset) = xml_lower[content_start..].find("</") {
                    let content = xml[content_start..content_start + end_offset].trim();
                    if !content.is_empty() && !content.starts_with('<') {
                        return Some(content.to_string());
                    }
                }
            }
        }

        None
    }

    // Helper: Parse calendar home URL from XML
    fn parse_calendar_home_url(&self, xml: &str) -> Result<String, CalendarError> {
        let xml_lower = xml.to_lowercase();

        // Look for calendar-home-set with any namespace
        if let Some(idx) = xml_lower.find("calendar-home-set") {
            let remaining = &xml[idx..];

            // Look for href in this section
            if let Some(href) = self.find_href_in_section(remaining) {
                if !href.is_empty() {
                    return Ok(href);
                }
            }

            // Try alternative extraction
            if let Some(href) = self.extract_href_after_pattern(&xml_lower, xml, "calendar-home-set") {
                return Ok(href);
            }
        }

        Err(CalendarError::Parse(format!(
            "Could not find calendar home URL. Response preview: {}...",
            &xml[..xml.len().min(500)]
        )))
    }

    // Helper: Parse calendars from XML
    fn parse_calendars(&self, xml: &str, home_url: &str) -> Result<Vec<Calendar>, CalendarError> {
        let mut calendars = Vec::new();
        let xml_lower = xml.to_lowercase();

        // Debug: print part of the response to understand format
        println!("[CalDAV] parse_calendars XML sample (1500 chars): {}", &xml[..xml.len().min(1500)]);

        // Split by response elements (case-insensitive search)
        // Find all <response> or <d:response> or <D:response> tags
        let mut response_starts: Vec<usize> = Vec::new();
        let patterns = ["<response>", "<response ", "<d:response>", "<d:response "];
        for pattern in patterns {
            let mut start = 0;
            while let Some(pos) = xml_lower[start..].find(pattern) {
                response_starts.push(start + pos);
                start = start + pos + pattern.len();
            }
        }
        response_starts.sort();
        response_starts.dedup();

        println!("[CalDAV] Found {} response elements", response_starts.len());

        for (i, &start) in response_starts.iter().enumerate() {
            // Find the end of this response (next response or end)
            let end = response_starts.get(i + 1).copied().unwrap_or(xml.len());
            let response = &xml[start..end];
            let response_lower = response.to_lowercase();

            // Extract href first to check if it's the home URL
            let href = self.extract_xml_text(response, "href").unwrap_or_default();
            let href_normalized = href.trim_end_matches('/');
            let home_normalized = home_url.trim_end_matches('/');

            // Skip if it's the home URL itself or empty
            if href.is_empty() || href_normalized == home_normalized {
                println!("[CalDAV] Response {}: skipping home collection", i);
                continue;
            }

            // Check if it's a calendar (resourcetype contains <calendar.../>)
            // Extract the resourcetype section and check for calendar within it
            let resourcetype_start = response_lower.find("<resourcetype");
            let resourcetype_end = response_lower.find("</resourcetype>");

            let is_calendar = match (resourcetype_start, resourcetype_end) {
                (Some(start), Some(end)) => {
                    let resourcetype_section = &response_lower[start..end];
                    // Must contain <calendar (with or without namespace)
                    resourcetype_section.contains("<calendar") || resourcetype_section.contains(":calendar")
                }
                _ => false
            };

            println!("[CalDAV] Response {}: href='{}', is_calendar={}, len={}", i, href, is_calendar, response.len());

            if !is_calendar {
                continue;
            }

            // Skip system folders (inbox, outbox, notification)
            let href_lower = href.to_lowercase();
            if href_lower.contains("/inbox") || href_lower.contains("/outbox") || href_lower.contains("/notification") {
                println!("[CalDAV] Skipping system folder: {}", href);
                continue;
            }

            // Extract displayname - try multiple approaches
            let name = self.extract_xml_text(response, "displayname")
                .or_else(|| {
                    // Try finding displayname with different patterns
                    self.find_element_content(response, "displayname")
                })
                .unwrap_or_else(|| {
                    // Fall back to extracting name from URL
                    href.split('/').filter(|s| !s.is_empty()).last()
                        .unwrap_or("Calendar").to_string()
                });

            println!("[CalDAV] Found calendar: name='{}', href='{}'", name, href);

            // Extract color
            let color = self.extract_xml_text(response, "calendar-color")
                .map(|c| {
                    // iCloud returns colors like #FFCC00FF (with alpha), normalize to #RRGGBB
                    if c.len() == 9 && c.starts_with('#') {
                        format!("#{}", &c[1..7])
                    } else {
                        c
                    }
                });

            // Extract ctag for sync
            let sync_token = self.extract_xml_text(response, "getctag");

            calendars.push(Calendar {
                id: href.clone(),
                provider: CalendarProvider::CalDAV,
                name,
                description: None,
                color,
                is_primary: calendars.is_empty(), // First calendar is primary
                is_writable: true, // CalDAV calendars are writable
                sync_token,
                last_synced: None,
                visible: true,
            });
        }

        Ok(calendars)
    }

    // Helper: Parse events from XML REPORT response
    fn parse_events(&self, xml: &str, calendar_id: &str) -> Result<Vec<CalendarEvent>, CalendarError> {
        let mut events = Vec::new();
        let xml_lower = xml.to_lowercase();

        println!("[CalDAV] parse_events: looking for calendar-data in response");

        // Find all calendar-data elements (case-insensitive)
        // iCloud may use various formats: <calendar-data>, <C:calendar-data>, <cal:calendar-data>, etc.
        let calendar_data_patterns = [
            "calendar-data>",
            "calendar-data ",  // with attributes
        ];

        // Find start positions of calendar-data content
        let mut positions: Vec<usize> = Vec::new();
        for pattern in &calendar_data_patterns {
            let mut start = 0;
            while let Some(pos) = xml_lower[start..].find(pattern) {
                let abs_pos = start + pos;
                // Make sure this is an opening tag, not closing
                if abs_pos > 0 {
                    let before = &xml_lower[..abs_pos];
                    // Find the < that starts this tag
                    if let Some(tag_start) = before.rfind('<') {
                        let tag_content = &xml_lower[tag_start..abs_pos + pattern.len()];
                        // Skip closing tags
                        if !tag_content.starts_with("</") {
                            positions.push(abs_pos);
                        }
                    }
                }
                start = abs_pos + pattern.len();
            }
        }
        positions.sort();
        positions.dedup();

        println!("[CalDAV] Found {} calendar-data elements", positions.len());

        for &pos in &positions {
            // Find the > that closes the opening tag (handles attributes)
            let remaining = &xml[pos..];
            let content_start = match remaining.find('>') {
                Some(idx) => pos + idx + 1,
                None => continue,
            };

            // Find the closing tag (case-insensitive)
            let content_remaining = &xml_lower[content_start..];
            let content_end = match content_remaining.find("</") {
                Some(idx) => {
                    // Verify it's calendar-data closing tag
                    let close_tag = &content_remaining[idx..];
                    if close_tag.contains("calendar-data>") {
                        content_start + idx
                    } else {
                        // Find the actual calendar-data closing tag
                        match content_remaining.find("calendar-data>") {
                            Some(end_idx) => {
                                // Find the </ before it
                                let search_section = &content_remaining[..end_idx];
                                match search_section.rfind("</") {
                                    Some(close_idx) => content_start + close_idx,
                                    None => continue,
                                }
                            }
                            None => continue,
                        }
                    }
                }
                None => continue,
            };

            let ics_content = &xml[content_start..content_end];

            // Strip CDATA wrapper if present
            // iCloud returns: <![CDATA[BEGIN:VCALENDAR...END:VCALENDAR\r\n]]>
            let ics_content = ics_content.trim();
            let ics_content = if ics_content.starts_with("<![CDATA[") {
                let without_prefix = &ics_content[9..];
                // Strip ]]> suffix if present
                if without_prefix.ends_with("]]>") {
                    &without_prefix[..without_prefix.len()-3]
                } else if let Some(cdata_end) = without_prefix.rfind("]]>") {
                    &without_prefix[..cdata_end]
                } else {
                    without_prefix
                }
            } else {
                ics_content
            };

            println!("[CalDAV] Found ICS content ({} bytes): {}", ics_content.len(), &ics_content[..ics_content.len().min(200)]);

            // Decode XML entities
            let ics_decoded = ics_content
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&amp;", "&")
                .replace("&quot;", "\"")
                .replace("&#13;", "\r")
                .replace("&#10;", "\n");

            // Parse the ICS content
            match ical::parse_ics_content(&ics_decoded, calendar_id) {
                Ok(parsed_events) => {
                    println!("[CalDAV] Parsed {} events from ICS", parsed_events.len());
                    events.extend(parsed_events);
                }
                Err(e) => {
                    println!("[CalDAV] Failed to parse ICS: {}", e);
                }
            }
        }

        println!("[CalDAV] Total events parsed: {}", events.len());
        Ok(events)
    }

    // Helper: Extract text content from XML element
    fn extract_xml_text(&self, xml: &str, tag_name: &str) -> Option<String> {
        // Try with namespace prefix
        let patterns = [
            (format!("<D:{}>", tag_name), format!("</D:{}>", tag_name)),
            (format!("<C:{}>", tag_name), format!("</C:{}>", tag_name)),
            (format!("<IC:{}>", tag_name), format!("</IC:{}>", tag_name)),
            (format!("<CS:{}>", tag_name), format!("</CS:{}>", tag_name)),
            (format!("<{}>", tag_name), format!("</{}>", tag_name)),
        ];

        for (open_tag, close_tag) in patterns {
            if let Some(start) = xml.find(&open_tag) {
                let content_start = start + open_tag.len();
                if let Some(end) = xml[content_start..].find(&close_tag) {
                    let content = xml[content_start..content_start + end].trim();
                    if !content.is_empty() {
                        return Some(content.to_string());
                    }
                }
            }
        }
        None
    }

    // Helper: Create ICS content for new event
    fn create_ics_event(&self, uid: &str, event: &CreateEventRequest) -> String {
        let now = Utc::now().format("%Y%m%dT%H%M%SZ");
        let dtstart = if event.all_day {
            format!("DTSTART;VALUE=DATE:{}", event.start.format("%Y%m%d"))
        } else {
            format!("DTSTART:{}", event.start.format("%Y%m%dT%H%M%SZ"))
        };
        let dtend = if event.all_day {
            format!("DTEND;VALUE=DATE:{}", event.end.format("%Y%m%d"))
        } else {
            format!("DTEND:{}", event.end.format("%Y%m%dT%H%M%SZ"))
        };

        let mut ics = format!(
            "BEGIN:VCALENDAR\r\n\
             VERSION:2.0\r\n\
             PRODID:-//Lokus//Calendar//EN\r\n\
             BEGIN:VEVENT\r\n\
             UID:{}\r\n\
             DTSTAMP:{}\r\n\
             {}\r\n\
             {}\r\n\
             SUMMARY:{}\r\n",
            uid, now, dtstart, dtend,
            event.title.replace('\n', "\\n")
        );

        if let Some(ref desc) = event.description {
            ics.push_str(&format!("DESCRIPTION:{}\r\n", desc.replace('\n', "\\n")));
        }
        if let Some(ref loc) = event.location {
            ics.push_str(&format!("LOCATION:{}\r\n", loc.replace('\n', "\\n")));
        }
        if let Some(ref rrule) = event.recurrence_rule {
            ics.push_str(&format!("RRULE:{}\r\n", rrule));
        }

        ics.push_str("END:VEVENT\r\nEND:VCALENDAR\r\n");
        ics
    }

    // Helper: Update ICS content with new values
    fn update_ics_event(&self, existing_ics: &str, updates: &UpdateEventRequest) -> Result<String, CalendarError> {
        let mut ics = existing_ics.to_string();

        // Update SUMMARY
        if let Some(ref title) = updates.title {
            ics = self.replace_ics_property(&ics, "SUMMARY", title);
        }

        // Update DESCRIPTION
        if let Some(ref desc) = updates.description {
            if ics.contains("DESCRIPTION:") {
                ics = self.replace_ics_property(&ics, "DESCRIPTION", desc);
            } else {
                // Insert before END:VEVENT
                ics = ics.replace(
                    "END:VEVENT",
                    &format!("DESCRIPTION:{}\r\nEND:VEVENT", desc.replace('\n', "\\n"))
                );
            }
        }

        // Update LOCATION
        if let Some(ref loc) = updates.location {
            if ics.contains("LOCATION:") {
                ics = self.replace_ics_property(&ics, "LOCATION", loc);
            } else {
                ics = ics.replace(
                    "END:VEVENT",
                    &format!("LOCATION:{}\r\nEND:VEVENT", loc.replace('\n', "\\n"))
                );
            }
        }

        // Update DTSTART/DTEND
        if let Some(start) = updates.start {
            let all_day = updates.all_day.unwrap_or(false);
            let dtstart = if all_day {
                format!("DTSTART;VALUE=DATE:{}", start.format("%Y%m%d"))
            } else {
                format!("DTSTART:{}", start.format("%Y%m%dT%H%M%SZ"))
            };
            ics = self.replace_ics_datetime(&ics, "DTSTART", &dtstart);
        }

        if let Some(end) = updates.end {
            let all_day = updates.all_day.unwrap_or(false);
            let dtend = if all_day {
                format!("DTEND;VALUE=DATE:{}", end.format("%Y%m%d"))
            } else {
                format!("DTEND:{}", end.format("%Y%m%dT%H%M%SZ"))
            };
            ics = self.replace_ics_datetime(&ics, "DTEND", &dtend);
        }

        // Update DTSTAMP
        let now = Utc::now().format("%Y%m%dT%H%M%SZ").to_string();
        ics = self.replace_ics_property(&ics, "DTSTAMP", &now);

        Ok(ics)
    }

    fn replace_ics_property(&self, ics: &str, property: &str, value: &str) -> String {
        let mut result = String::new();
        for line in ics.lines() {
            if line.starts_with(&format!("{}:", property)) {
                result.push_str(&format!("{}:{}\r\n", property, value.replace('\n', "\\n")));
            } else {
                result.push_str(line);
                result.push_str("\r\n");
            }
        }
        result
    }

    fn replace_ics_datetime(&self, ics: &str, property: &str, full_line: &str) -> String {
        let mut result = String::new();
        for line in ics.lines() {
            if line.starts_with(&format!("{}:", property)) || line.starts_with(&format!("{};", property)) {
                result.push_str(full_line);
                result.push_str("\r\n");
            } else {
                result.push_str(line);
                result.push_str("\r\n");
            }
        }
        result
    }
}

/// Test connection to CalDAV server
pub async fn test_connection(server_url: &str, username: &str, password: &str) -> Result<CalDAVAccount, CalendarError> {
    let account = CalDAVAccount {
        id: Uuid::new_v4().to_string(),
        server_url: server_url.to_string(),
        username: username.to_string(),
        password: password.to_string(),
        display_name: None,
        principal_url: None,
        calendar_home_url: None,
        is_connected: false,
        connected_at: None,
        last_synced: None,
    };

    let mut client = CalDAVClient::new(account)?;

    // Try to discover principal (this validates credentials)
    client.discover_principal().await?;
    client.discover_calendar_home().await?;

    // Update account with discovered info
    let mut account = client.account.clone();
    account.is_connected = true;
    account.connected_at = Some(Utc::now());

    Ok(account)
}
