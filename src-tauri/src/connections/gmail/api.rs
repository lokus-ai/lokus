use std::sync::Arc;
use reqwest::Client;
use crate::connections::gmail::models::{
    GmailToken, GmailProfile, EmailMessage, EmailComposer, 
    EmailLabel, EmailSearchOptions, EmailListOptions, EmailAddress,
    EmailAttachment, GmailError, OperationType
};
use crate::connections::gmail::auth::GmailAuth;
use crate::connections::gmail::queue::OfflineQueue;
use chrono::{DateTime, Utc};
use serde_json;
use base64::{Engine as _, engine::general_purpose};

pub struct GmailApi {
    auth: GmailAuth,
    client: Client,
    queue: Arc<OfflineQueue>,
}

impl GmailApi {
    pub fn new(queue: Arc<OfflineQueue>) -> Result<Self, GmailError> {
        let auth = GmailAuth::new()?;
        let client = Client::new();
        
        Ok(Self {
            auth,
            client,
            queue,
        })
    }

    pub async fn get_valid_token(&self) -> Result<GmailToken, GmailError> {
        self.auth.get_valid_token().await
    }

    pub async fn authenticate(&self, code: &str, code_verifier: &str) -> Result<GmailProfile, GmailError> {
        
        let token = self.auth.exchange_code_for_token(code, code_verifier).await?;
        let profile = self.auth.fetch_and_store_profile(&token).await?;
        
        Ok(profile)
    }

    pub async fn is_authenticated(&self) -> Result<bool, GmailError> {
        self.auth.is_authenticated()
    }

    pub async fn logout(&self) -> Result<(), GmailError> {
        
        if let Ok(Some(token)) = crate::connections::gmail::storage::GmailStorage::get_token() {
            let _ = self.auth.revoke_token(&token.access_token).await;
        }
        
        Ok(())
    }

    pub async fn get_profile(&self) -> Result<Option<GmailProfile>, GmailError> {
        crate::connections::gmail::storage::GmailStorage::get_profile()
    }

    // Email listing and searching
    pub async fn list_emails(&self, options: EmailListOptions) -> Result<Vec<EmailMessage>, GmailError> {
        
        let token = self.get_valid_token().await?;
        
        let mut url = "https://gmail.googleapis.com/gmail/v1/users/me/messages".to_string();
        let mut params = Vec::new();
        
        if let Some(max_results) = options.max_results {
            params.push(format!("maxResults={}", max_results));
        }
        
        if let Some(page_token) = &options.page_token {
            params.push(format!("pageToken={}", page_token));
        }
        
        if let Some(label_ids) = &options.label_ids {
            for label_id in label_ids {
                params.push(format!("labelIds={}", label_id));
            }
        }
        
        if options.include_spam_trash {
            params.push("includeSpamTrash=true".to_string());
        }
        
        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
        }

        let response = self.client
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GmailError::Api(format!("Failed to list emails: {}", error_text)));
        }

        let data: serde_json::Value = response.json().await?;
        let empty_vec = Vec::new();
        let messages = data["messages"].as_array().unwrap_or(&empty_vec);
        
        let mut email_messages = Vec::new();
        
        // Fetch full details for each message
        for message in messages.iter().take(options.max_results.unwrap_or(50) as usize) {
            if let Some(id) = message["id"].as_str() {
                match self.get_email_by_id(id).await {
                    Ok(email) => email_messages.push(email),
                    Err(_e) => {
                        continue;
                    }
                }
            }
        }
        
        // println!("[GMAIL] ✅ Retrieved {} emails", email_messages.len());
        Ok(email_messages)
    }

    pub async fn search_emails(&self, options: EmailSearchOptions) -> Result<Vec<EmailMessage>, GmailError> {
        // println!("[GMAIL] 🔍 Searching emails with query: {}", options.query);
        
        let token = self.get_valid_token().await?;
        
        let mut url = "https://gmail.googleapis.com/gmail/v1/users/me/messages".to_string();
        let mut params = vec![format!("q={}", urlencoding::encode(&options.query))];
        
        if let Some(max_results) = options.max_results {
            params.push(format!("maxResults={}", max_results));
        }
        
        if let Some(page_token) = &options.page_token {
            params.push(format!("pageToken={}", page_token));
        }
        
        if options.include_spam_trash {
            params.push("includeSpamTrash=true".to_string());
        }
        
        url.push('?');
        url.push_str(&params.join("&"));

        let response = self.client
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GmailError::Api(format!("Failed to search emails: {}", error_text)));
        }

        let data: serde_json::Value = response.json().await?;
        let empty_vec = Vec::new();
        let messages = data["messages"].as_array().unwrap_or(&empty_vec);
        
        let mut email_messages = Vec::new();
        
        // Fetch full details for each message
        for message in messages.iter().take(options.max_results.unwrap_or(50) as usize) {
            if let Some(id) = message["id"].as_str() {
                match self.get_email_by_id(id).await {
                    Ok(email) => email_messages.push(email),
                    Err(_e) => {
                        continue;
                    }
                }
            }
        }
        
        Ok(email_messages)
    }

    pub async fn get_email_by_id(&self, message_id: &str) -> Result<EmailMessage, GmailError> {
        let token = self.get_valid_token().await?;
        
        let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}", message_id);
        
        let response = self.client
            .get(&url)
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GmailError::Api(format!("Failed to get email: {}", error_text)));
        }

        let message_data: serde_json::Value = response.json().await?;
        Self::parse_email_message(&message_data)
    }

    // Email composition and sending
    pub async fn send_email(&self, composer: EmailComposer) -> Result<String, GmailError> {
        
        match self.send_email_internal(&composer).await {
            Ok(message_id) => {
                Ok(message_id)
            }
            Err(e) => {
                
                // Add to offline queue for retry
                let operation_data = serde_json::to_value(&composer)?;
                let _queue_id = self.queue.add_operation(OperationType::SendEmail, operation_data)?;
                
                Err(e)
            }
        }
    }

    async fn send_email_internal(&self, composer: &EmailComposer) -> Result<String, GmailError> {
        let token = self.get_valid_token().await?;
        
        // Build the email message
        let email_content = self.build_email_content(composer)?;
        let encoded_message = general_purpose::URL_SAFE_NO_PAD.encode(email_content);
        
        let request_body = serde_json::json!({
            "raw": encoded_message
        });
        
        let response = self.client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
            .bearer_auth(&token.access_token)
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GmailError::Api(format!("Failed to send email: {}", error_text)));
        }

        let response_data: serde_json::Value = response.json().await?;
        let message_id = response_data["id"]
            .as_str()
            .ok_or_else(|| GmailError::Api("No message ID in send response".to_string()))?;
        
        Ok(message_id.to_string())
    }

    pub async fn reply_to_email(&self, message_id: &str, composer: EmailComposer) -> Result<String, GmailError> {
        
        // Get the original message to set up reply headers
        let original = self.get_email_by_id(message_id).await?;
        
        let mut reply_composer = composer;
        reply_composer.in_reply_to = Some(original.id.clone());
        
        // TODO: Set up proper References header for threading
        
        self.send_email(reply_composer).await
    }

    pub async fn forward_email(&self, message_id: &str, composer: EmailComposer) -> Result<String, GmailError> {
        
        // Get the original message
        let original = self.get_email_by_id(message_id).await?;
        
        // Build forwarded content
        let mut forward_composer = composer;
        let forward_content = format!(
            "\n\n---------- Forwarded message ----------\nFrom: {}\nDate: {}\nSubject: {}\n\n{}",
            original.from.first().map(|f| f.email.as_str()).unwrap_or("Unknown"),
            original.date.format("%Y-%m-%d %H:%M:%S"),
            original.subject,
            original.body_text.unwrap_or_default()
        );
        
        forward_composer.body_text = Some(forward_content);
        
        self.send_email(forward_composer).await
    }

    // Email operations
    pub async fn mark_as_read(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.modify_labels(message_ids, vec![], vec!["UNREAD".to_string()]).await
    }

    pub async fn mark_as_unread(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.modify_labels(message_ids, vec!["UNREAD".to_string()], vec![]).await
    }

    pub async fn star_emails(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.modify_labels(message_ids, vec!["STARRED".to_string()], vec![]).await
    }

    pub async fn unstar_emails(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.modify_labels(message_ids, vec![], vec!["STARRED".to_string()]).await
    }

    pub async fn archive_emails(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.modify_labels(message_ids, vec![], vec!["INBOX".to_string()]).await
    }

    pub async fn delete_emails(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.modify_labels(message_ids, vec!["TRASH".to_string()], vec!["INBOX".to_string()]).await
    }

    async fn modify_labels(&self, message_ids: Vec<String>, add_labels: Vec<String>, remove_labels: Vec<String>) -> Result<(), GmailError> {
        let token = self.get_valid_token().await?;
        
        let request_body = serde_json::json!({
            "ids": message_ids,
            "addLabelIds": add_labels,
            "removeLabelIds": remove_labels
        });
        
        let response = self.client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify")
            .bearer_auth(&token.access_token)
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GmailError::Api(format!("Failed to modify labels: {}", error_text)));
        }

        Ok(())
    }

    // Labels management
    pub async fn get_labels(&self) -> Result<Vec<EmailLabel>, GmailError> {
        
        let token = self.get_valid_token().await?;
        
        let response = self.client
            .get("https://gmail.googleapis.com/gmail/v1/users/me/labels")
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(GmailError::Api(format!("Failed to get labels: {}", error_text)));
        }

        let data: serde_json::Value = response.json().await?;
        let empty_vec = Vec::new();
        let labels = data["labels"].as_array().unwrap_or(&empty_vec);
        
        let mut email_labels = Vec::new();
        for label in labels {
            let email_label = EmailLabel {
                id: label["id"].as_str().unwrap_or("").to_string(),
                name: label["name"].as_str().unwrap_or("").to_string(),
                type_: label["type"].as_str().unwrap_or("user").to_string(),
                messages_total: label["messagesTotal"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0),
                messages_unread: label["messagesUnread"].as_str().and_then(|s| s.parse().ok()).unwrap_or(0),
                color: label["color"]["backgroundColor"].as_str().map(|s| s.to_string()),
            };
            email_labels.push(email_label);
        }
        
        Ok(email_labels)
    }

    // Helper methods
    fn build_email_content(&self, composer: &EmailComposer) -> Result<String, GmailError> {
        let mut message = String::new();
        
        // Headers
        let to_addresses: Vec<String> = composer.to.iter()
            .map(|addr| if let Some(name) = &addr.name {
                format!("{} <{}>", name, addr.email)
            } else {
                addr.email.clone()
            })
            .collect();
        message.push_str(&format!("To: {}\r\n", to_addresses.join(", ")));
        
        if let Some(cc) = &composer.cc {
            let cc_addresses: Vec<String> = cc.iter()
                .map(|addr| if let Some(name) = &addr.name {
                    format!("{} <{}>", name, addr.email)
                } else {
                    addr.email.clone()
                })
                .collect();
            message.push_str(&format!("Cc: {}\r\n", cc_addresses.join(", ")));
        }
        
        message.push_str(&format!("Subject: {}\r\n", composer.subject));
        message.push_str("Content-Type: text/plain; charset=utf-8\r\n");
        
        if let Some(in_reply_to) = &composer.in_reply_to {
            message.push_str(&format!("In-Reply-To: <{}>\r\n", in_reply_to));
        }
        
        if let Some(references) = &composer.references {
            message.push_str(&format!("References: {}\r\n", references));
        }
        
        message.push_str("\r\n");
        
        // Body
        if let Some(body) = &composer.body_text {
            message.push_str(body);
        } else {
        }
        
        
        Ok(message)
    }

    fn parse_email_message(data: &serde_json::Value) -> Result<EmailMessage, GmailError> {
        let id = data["id"].as_str().unwrap_or("").to_string();
        let thread_id = data["threadId"].as_str().unwrap_or("").to_string();
        let snippet = data["snippet"].as_str().unwrap_or("").to_string();
        let size_estimate = data["sizeEstimate"].as_u64().unwrap_or(0);
        
        
        let label_ids: Vec<String> = data["labelIds"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect())
            .unwrap_or_default();
        
        let payload = &data["payload"];
        // println!("[GMAIL] 📦 Payload structure exists: {}", !payload.is_null());
        
        // Parse headers
        let empty_vec = Vec::new();
        let headers = payload["headers"].as_array().unwrap_or(&empty_vec);
        // println!("[GMAIL] 📧 Found {} headers", headers.len());
        
        let mut subject = String::new();
        let mut from = Vec::new();
        let mut to = Vec::new();
        let mut cc = None;
        let mut date_str = String::new();
        
        for header in headers {
            let name = header["name"].as_str().unwrap_or("");
            let value = header["value"].as_str().unwrap_or("");
            
            match name.to_lowercase().as_str() {
                "subject" => {
                    subject = value.to_string();
                    // println!("[GMAIL] 📋 Subject: {}", subject);
                }
                "from" => {
                    from = Self::parse_email_addresses(value);
                    // println!("[GMAIL] 👤 From: {}", value);
                }
                "to" => {
                    to = Self::parse_email_addresses(value);
                    // println!("[GMAIL] 👥 To: {}", value);
                }
                "cc" => cc = Some(Self::parse_email_addresses(value)),
                "date" => date_str = value.to_string(),
                _ => {}
            }
        }
        
        // Parse date
        let date = DateTime::parse_from_rfc2822(&date_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        
        // Determine read status
        let is_read = !label_ids.contains(&"UNREAD".to_string());
        let is_starred = label_ids.contains(&"STARRED".to_string());
        
        // Parse body
        let (body_text, body_html) = Self::parse_email_body(payload);
        
        // Parse attachments
        let attachments = Self::parse_email_attachments(payload);
        
        Ok(EmailMessage {
            id,
            thread_id,
            subject,
            from,
            to,
            cc,
            bcc: None,
            body_text,
            body_html,
            attachments,
            labels: label_ids,
            snippet,
            date,
            is_read,
            is_starred,
            size_estimate,
        })
    }

    fn parse_email_addresses(value: &str) -> Vec<EmailAddress> {
        // Simple email parsing - in production, use a proper email parser
        value.split(',')
            .map(|addr| {
                let addr = addr.trim();
                if addr.contains('<') && addr.contains('>') {
                    let parts: Vec<&str> = addr.splitn(2, '<').collect();
                    if parts.len() == 2 {
                        let name = parts[0].trim().trim_matches('"');
                        let email = parts[1].trim_end_matches('>');
                        EmailAddress {
                            name: if name.is_empty() { None } else { Some(name.to_string()) },
                            email: email.to_string(),
                        }
                    } else {
                        EmailAddress {
                            name: None,
                            email: addr.to_string(),
                        }
                    }
                } else {
                    EmailAddress {
                        name: None,
                        email: addr.to_string(),
                    }
                }
            })
            .collect()
    }

    fn parse_email_body(payload: &serde_json::Value) -> (Option<String>, Option<String>) {
        // TODO: Implement proper MIME parsing for multi-part messages
        let body = &payload["body"];
        
        if let Some(data) = body["data"].as_str() {
            // Decode base64 body
            if let Ok(decoded) = general_purpose::URL_SAFE_NO_PAD.decode(data) {
                if let Ok(text) = String::from_utf8(decoded) {
                    return (Some(text), None);
                }
            }
        }
        
        // Check parts for multi-part messages
        if let Some(parts) = payload["parts"].as_array() {
            for part in parts {
                let mime_type = part["mimeType"].as_str().unwrap_or("");
                if mime_type == "text/plain" {
                    if let Some(data) = part["body"]["data"].as_str() {
                        if let Ok(decoded) = general_purpose::URL_SAFE_NO_PAD.decode(data) {
                            if let Ok(text) = String::from_utf8(decoded) {
                                return (Some(text), None);
                            }
                        }
                    }
                }
            }
        }
        
        (None, None)
    }

    fn parse_email_attachments(payload: &serde_json::Value) -> Vec<EmailAttachment> {
        let mut attachments = Vec::new();
        
        if let Some(parts) = payload["parts"].as_array() {
            for part in parts {
                if let Some(filename) = part["filename"].as_str() {
                    if !filename.is_empty() {
                        let attachment = EmailAttachment {
                            id: part["body"]["attachmentId"].as_str().unwrap_or("").to_string(),
                            filename: filename.to_string(),
                            mime_type: part["mimeType"].as_str().unwrap_or("").to_string(),
                            size: part["body"]["size"].as_u64().unwrap_or(0),
                            data: None, // Data is loaded separately when needed
                        };
                        attachments.push(attachment);
                    }
                }
            }
        }
        
        attachments
    }
}