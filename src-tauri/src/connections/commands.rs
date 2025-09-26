use tauri::{State, Manager};
use crate::connections::manager::ConnectionManager;
use crate::connections::gmail::models::{
    GmailProfile, EmailMessage, EmailComposer, EmailLabel, 
    EmailSearchOptions, EmailListOptions, EmailAddress
};
use std::collections::HashMap;
use std::fs;

// Authentication commands
#[tauri::command]
pub async fn gmail_initiate_auth(
    app: tauri::AppHandle,
) -> Result<String, String> {
    println!("[GMAIL COMMAND] 🔥 gmail_initiate_auth command called from frontend!");
    
    // Get the connection manager - safely handle case where it's not initialized
    match app.try_state::<ConnectionManager>() {
        Some(connection_manager) => {
            let result = connection_manager
                .initiate_gmail_auth()
                .await
                .map_err(|e| e.to_string());
            println!("[GMAIL COMMAND] 🔥 gmail_initiate_auth command completed, result: {:?}", result);
            result
        }
        None => {
            eprintln!("[GMAIL] ❌ ConnectionManager not initialized");
            Err("Gmail ConnectionManager not initialized. Please check GOOGLE_CLIENT_ID environment variable.".to_string())
        }
    }
}

#[tauri::command]
pub async fn gmail_complete_auth(
    code: String,
    state: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<GmailProfile, String> {
    connection_manager
        .complete_gmail_auth(&code, &state)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_check_auth_callback() -> Result<Option<(String, String)>, String> {
    // Check for auth callback file from localhost server
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let temp_dir = home_dir.join(".lokus").join("temp");
    let auth_file = temp_dir.join("gmail_auth_callback.json");
    
    if auth_file.exists() {
        match fs::read_to_string(&auth_file) {
            Ok(content) => {
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let (Some(code), Some(state)) = (
                        data["code"].as_str(),
                        data["state"].as_str()
                    ) {
                        // Delete the file after reading
                        let _ = fs::remove_file(&auth_file);
                        println!("[GMAIL] 📥 Auth callback received: code={}, state={}", 
                                 &code[..20.min(code.len())], state);
                        
                        return Ok(Some((code.to_string(), state.to_string())));
                    }
                }
            }
            Err(e) => {
                println!("[GMAIL] ❌ Error reading auth callback file: {}", e);
            }
        }
    }
    
    Ok(None)
}

#[tauri::command]
pub async fn gmail_is_authenticated(
    connection_manager: State<'_, ConnectionManager>,
) -> Result<bool, String> {
    connection_manager
        .is_gmail_authenticated()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_logout(
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    connection_manager
        .gmail_logout()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_get_profile(
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Option<GmailProfile>, String> {
    connection_manager
        .get_gmail_profile()
        .await
        .map_err(|e| e.to_string())
}

// Email listing and searching commands
#[tauri::command]
pub async fn gmail_list_emails(
    max_results: Option<u32>,
    page_token: Option<String>,
    label_ids: Option<Vec<String>>,
    include_spam_trash: Option<bool>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Vec<EmailMessage>, String> {
    let options = EmailListOptions {
        max_results,
        page_token,
        label_ids,
        include_spam_trash: include_spam_trash.unwrap_or(false),
    };
    
    connection_manager
        .list_emails(options)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_search_emails(
    query: String,
    max_results: Option<u32>,
    page_token: Option<String>,
    include_spam_trash: Option<bool>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Vec<EmailMessage>, String> {
    let options = EmailSearchOptions {
        query,
        max_results,
        page_token,
        include_spam_trash: include_spam_trash.unwrap_or(false),
        label_ids: None,
    };
    
    connection_manager
        .search_emails(options)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_get_email(
    message_id: String,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<EmailMessage, String> {
    connection_manager
        .get_email_by_id(&message_id)
        .await
        .map_err(|e| e.to_string())
}

// Email composition commands
#[tauri::command]
pub async fn gmail_send_email(
    to: Vec<EmailAddress>,
    subject: String,
    bodyText: String,  // Changed from body_text to bodyText to match JS
    bodyHtml: Option<String>,  // Changed from body_html to bodyHtml to match JS
    cc: Option<Vec<EmailAddress>>,
    bcc: Option<Vec<EmailAddress>>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    println!("[GMAIL_CMD] 📧 Sending email to: {:?}, subject: {}, body: {} chars", 
        to.iter().map(|addr| &addr.email).collect::<Vec<_>>(),
        subject,
        bodyText.len()
    );

    let composer = EmailComposer {
        to,
        cc,
        bcc,
        subject,
        body_text: Some(bodyText),  // Convert String to Option<String> for EmailComposer
        body_html: bodyHtml,
        attachments: Vec::new(), // TODO: Add attachment support
        in_reply_to: None,
        references: None,
    };
    
    connection_manager
        .send_email(composer)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_reply_email(
    message_id: String,
    to: Vec<EmailAddress>,
    subject: String,
    bodyText: Option<String>,
    bodyHtml: Option<String>,
    cc: Option<Vec<EmailAddress>>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    let composer = EmailComposer {
        to,
        cc,
        bcc: None,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        attachments: Vec::new(),
        in_reply_to: None,
        references: None,
    };
    
    connection_manager
        .reply_to_email(&message_id, composer)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_forward_email(
    message_id: String,
    to: Vec<EmailAddress>,
    subject: String,
    bodyText: Option<String>,
    bodyHtml: Option<String>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<String, String> {
    let composer = EmailComposer {
        to,
        cc: None,
        bcc: None,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        attachments: Vec::new(),
        in_reply_to: None,
        references: None,
    };
    
    connection_manager
        .forward_email(&message_id, composer)
        .await
        .map_err(|e| e.to_string())
}

// Email management commands
#[tauri::command]
pub async fn gmail_mark_as_read(
    message_ids: Vec<String>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    connection_manager
        .mark_as_read(message_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_mark_as_unread(
    message_ids: Vec<String>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    connection_manager
        .mark_as_unread(message_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_star_emails(
    message_ids: Vec<String>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    connection_manager
        .star_emails(message_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_unstar_emails(
    message_ids: Vec<String>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    connection_manager
        .unstar_emails(message_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_archive_emails(
    message_ids: Vec<String>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    connection_manager
        .archive_emails(message_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_delete_emails(
    message_ids: Vec<String>,
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    connection_manager
        .delete_emails(message_ids)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn gmail_get_labels(
    connection_manager: State<'_, ConnectionManager>,
) -> Result<Vec<EmailLabel>, String> {
    connection_manager
        .get_labels()
        .await
        .map_err(|e| e.to_string())
}

// Queue management commands
#[tauri::command]
pub fn gmail_get_queue_stats(
    app: tauri::AppHandle,
) -> Result<HashMap<String, u32>, String> {
    match app.try_state::<ConnectionManager>() {
        Some(connection_manager) => Ok(connection_manager.get_queue_stats()),
        None => {
            eprintln!("[GMAIL] ⚠️ ConnectionManager not initialized, returning empty stats");
            // Return empty stats if ConnectionManager is not available
            let mut empty_stats = HashMap::new();
            empty_stats.insert("total".to_string(), 0);
            Ok(empty_stats)
        }
    }
}

#[tauri::command]
pub fn gmail_force_process_queue(
    connection_manager: State<'_, ConnectionManager>,
) -> Result<u32, String> {
    connection_manager
        .force_process_queue()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn gmail_clear_queue(
    connection_manager: State<'_, ConnectionManager>,
) -> Result<(), String> {
    connection_manager
        .clear_queue()
        .map_err(|e| e.to_string())
}