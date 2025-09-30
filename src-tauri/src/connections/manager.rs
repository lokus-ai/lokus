use std::sync::Arc;
use std::collections::HashMap;
use crate::connections::gmail::{GmailApi, GmailAuth, OfflineQueue, QueueProcessor, PKCEData};
use crate::connections::gmail::models::{
    GmailProfile, EmailMessage, EmailComposer, EmailLabel, 
    EmailSearchOptions, EmailListOptions, GmailError
};
use tauri::AppHandle;

#[derive(Clone)]
pub struct ConnectionManager {
    gmail_api: Arc<GmailApi>,
    gmail_queue: Arc<OfflineQueue>,
    queue_processor: Arc<QueueProcessor>,
    pending_auth: Arc<std::sync::Mutex<Option<PKCEData>>>,
}

impl ConnectionManager {
    pub fn new(_app_handle: AppHandle) -> Result<Self, GmailError> {
        println!("[GMAIL] 🚀 Initializing Gmail Connection Manager");
        
        // Initialize offline queue
        let gmail_queue = Arc::new(OfflineQueue::new()?);
        
        // Initialize Gmail API
        let gmail_api = Arc::new(GmailApi::new(gmail_queue.clone())?);
        
        // Initialize queue processor
        let queue_processor = Arc::new(QueueProcessor::new(gmail_queue.clone()));
        
        let manager = Self {
            gmail_api,
            gmail_queue,
            queue_processor,
            pending_auth: Arc::new(std::sync::Mutex::new(None)),
        };
        
        // println!("[GMAIL] ✅ Gmail Connection Manager initialized successfully");
        Ok(manager)
    }

    pub fn new_fallback() -> Result<Self, GmailError> {
        // println!("[GMAIL] 🔧 Creating fallback Connection Manager");
        
        // Initialize minimal components for graceful error handling
        let gmail_queue = Arc::new(OfflineQueue::new()?);
        let gmail_api = Arc::new(GmailApi::new(gmail_queue.clone())?);
        let queue_processor = Arc::new(QueueProcessor::new(gmail_queue.clone()));
        
        let manager = Self {
            gmail_api,
            gmail_queue,
            queue_processor,
            pending_auth: Arc::new(std::sync::Mutex::new(None)),
        };
        
        // println!("[GMAIL] ✅ Fallback Connection Manager created");
        Ok(manager)
    }

    #[allow(dead_code)]
    pub async fn start_background_services(&self) {
        println!("[GMAIL] 🚀 Starting background services");
        self.queue_processor.start_background_processing().await;
    }

    // Authentication methods
    pub async fn initiate_gmail_auth(&self) -> Result<String, GmailError> {
        println!("[GMAIL] 🔐 Initiating Gmail authentication");
        
        let auth = GmailAuth::new()?;
        let (code_verifier, code_challenge) = GmailAuth::generate_pkce_pair();
        let state = GmailAuth::generate_state();
        
        let pkce_data = PKCEData {
            code_verifier,
            code_challenge,
            state,
        };
        
        let auth_url = auth.generate_auth_url(&pkce_data)?;
        
        // Store PKCE data for later use
        {
            let mut pending = self.pending_auth.lock().unwrap();
            *pending = Some(pkce_data);
        }
        
        println!("[GMAIL] 🔗 Gmail auth URL generated");
        Ok(auth_url)
    }

    pub async fn complete_gmail_auth(&self, code: &str, state: &str) -> Result<GmailProfile, GmailError> {
        println!("[GMAIL] 🔄 Completing Gmail authentication");
        
        let pkce_data = {
            let mut pending = self.pending_auth.lock().unwrap();
            pending.take().ok_or_else(|| GmailError::Auth("No pending authentication found".to_string()))?
        };
        
        // Validate state parameter for CSRF protection
        if state != pkce_data.state {
            return Err(GmailError::Auth("Invalid state parameter - possible CSRF attack".to_string()));
        }
        
        let profile = self.gmail_api.authenticate(code, &pkce_data.code_verifier).await?;
        
        println!("[GMAIL] ✅ Gmail authentication completed successfully");
        Ok(profile)
    }

    pub async fn is_gmail_authenticated(&self) -> Result<bool, GmailError> {
        self.gmail_api.is_authenticated().await
    }

    pub async fn gmail_logout(&self) -> Result<(), GmailError> {
        self.gmail_api.logout().await
    }

    pub async fn get_gmail_profile(&self) -> Result<Option<GmailProfile>, GmailError> {
        self.gmail_api.get_profile().await
    }

    // Email operations
    pub async fn list_emails(&self, options: EmailListOptions) -> Result<Vec<EmailMessage>, GmailError> {
        self.gmail_api.list_emails(options).await
    }

    pub async fn search_emails(&self, options: EmailSearchOptions) -> Result<Vec<EmailMessage>, GmailError> {
        self.gmail_api.search_emails(options).await
    }

    pub async fn get_email_by_id(&self, message_id: &str) -> Result<EmailMessage, GmailError> {
        self.gmail_api.get_email_by_id(message_id).await
    }

    pub async fn send_email(&self, composer: EmailComposer) -> Result<String, GmailError> {
        self.gmail_api.send_email(composer).await
    }

    pub async fn reply_to_email(&self, message_id: &str, composer: EmailComposer) -> Result<String, GmailError> {
        self.gmail_api.reply_to_email(message_id, composer).await
    }

    pub async fn forward_email(&self, message_id: &str, composer: EmailComposer) -> Result<String, GmailError> {
        self.gmail_api.forward_email(message_id, composer).await
    }

    // Email management
    pub async fn mark_as_read(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.gmail_api.mark_as_read(message_ids).await
    }

    pub async fn mark_as_unread(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.gmail_api.mark_as_unread(message_ids).await
    }

    pub async fn star_emails(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.gmail_api.star_emails(message_ids).await
    }

    pub async fn unstar_emails(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.gmail_api.unstar_emails(message_ids).await
    }

    pub async fn archive_emails(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.gmail_api.archive_emails(message_ids).await
    }

    pub async fn delete_emails(&self, message_ids: Vec<String>) -> Result<(), GmailError> {
        self.gmail_api.delete_emails(message_ids).await
    }

    pub async fn get_labels(&self) -> Result<Vec<EmailLabel>, GmailError> {
        self.gmail_api.get_labels().await
    }

    // Queue management
    pub fn get_queue_stats(&self) -> HashMap<String, u32> {
        self.gmail_queue.get_queue_stats()
    }

    pub fn force_process_queue(&self) -> Result<u32, GmailError> {
        self.queue_processor.force_process_all()
    }

    pub fn clear_queue(&self) -> Result<(), GmailError> {
        self.gmail_queue.clear_all_operations()
    }
}

// Helper function to convert GmailError to String for Tauri commands
#[allow(dead_code)]
pub fn gmail_error_to_string(error: GmailError) -> String {
    error.to_string()
}