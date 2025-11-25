use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use chrono::{Utc, Duration};
use crate::connections::gmail::models::{QueuedOperation, OperationType, GmailError};
use serde_json;
use uuid::Uuid;
use tokio::time::{sleep, Duration as TokioDuration};

pub struct OfflineQueue {
    operations: Arc<Mutex<HashMap<String, QueuedOperation>>>,
    queue_file_path: PathBuf,
}

impl OfflineQueue {
    pub fn new() -> Result<Self, GmailError> {
        let queue_file_path = Self::get_queue_file_path()?;
        let operations = Arc::new(Mutex::new(HashMap::new()));
        
        let queue = Self {
            operations,
            queue_file_path,
        };
        
        // Load existing operations from file
        queue.load_from_file()?;
        
        Ok(queue)
    }

    fn get_queue_file_path() -> Result<PathBuf, GmailError> {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| GmailError::Storage("Failed to get home directory".to_string()))?;
        let app_dir = home_dir.join(".lokus").join("gmail");
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir)
                .map_err(|e| GmailError::Storage(format!("Failed to create Gmail app directory: {}", e)))?;
        }
        Ok(app_dir.join("offline_queue.json"))
    }

    pub fn add_operation(&self, operation_type: OperationType, data: serde_json::Value) -> Result<String, GmailError> {
        let id = Uuid::new_v4().to_string();
        let operation_type_name = self.operation_type_name(&operation_type);
        let operation = QueuedOperation {
            id: id.clone(),
            operation_type,
            data,
            attempts: 0,
            max_attempts: 3,
            created_at: Utc::now(),
            next_retry_at: Some(Utc::now()),
            error: None,
        };

        {
            let mut operations = self.operations.lock().unwrap();
            operations.insert(id.clone(), operation);
        }

        self.save_to_file()?;
        
        Ok(id)
    }

    pub fn mark_operation_success(&self, operation_id: &str) -> Result<(), GmailError> {
        {
            let mut operations = self.operations.lock().unwrap();
            if operations.remove(operation_id).is_some() {
            }
        }
        
        self.save_to_file()?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn mark_operation_failed(&self, operation_id: &str, error: &str) -> Result<(), GmailError> {
        {
            let mut operations = self.operations.lock().unwrap();
            if let Some(operation) = operations.get_mut(operation_id) {
                operation.attempts += 1;
                operation.error = Some(error.to_string());
                
                if operation.attempts >= operation.max_attempts {
                    operations.remove(operation_id);
                } else {
                    // Exponential backoff: 2^attempts minutes
                    let delay_minutes = 2_i64.pow(operation.attempts as u32);
                    operation.next_retry_at = Some(Utc::now() + Duration::minutes(delay_minutes));
                }
            }
        }
        
        self.save_to_file()?;
        Ok(())
    }

    pub fn get_pending_operations(&self) -> Vec<QueuedOperation> {
        let operations = self.operations.lock().unwrap();
        let now = Utc::now();
        
        operations
            .values()
            .filter(|op| {
                op.next_retry_at
                    .map(|retry_time| retry_time <= now)
                    .unwrap_or(false)
            })
            .cloned()
            .collect()
    }

    #[allow(dead_code)]
    pub fn get_all_operations(&self) -> Vec<QueuedOperation> {
        let operations = self.operations.lock().unwrap();
        operations.values().cloned().collect()
    }

    pub fn clear_all_operations(&self) -> Result<(), GmailError> {
        {
            let mut operations = self.operations.lock().unwrap();
            operations.clear();
        }
        
        self.save_to_file()?;
        Ok(())
    }

    pub fn get_queue_stats(&self) -> HashMap<String, u32> {
        let operations = self.operations.lock().unwrap();
        let mut stats = HashMap::new();
        
        for operation in operations.values() {
            let type_name = self.operation_type_name(&operation.operation_type);
            *stats.entry(type_name).or_insert(0) += 1;
        }
        
        stats.insert("total".to_string(), operations.len() as u32);
        stats
    }

    fn operation_type_name(&self, op_type: &OperationType) -> String {
        match op_type {
            OperationType::SendEmail => "send_email".to_string(),
            OperationType::ReplyEmail => "reply_email".to_string(),
            OperationType::ForwardEmail => "forward_email".to_string(),
            OperationType::MarkAsRead => "mark_as_read".to_string(),
            OperationType::MarkAsUnread => "mark_as_unread".to_string(),
            OperationType::Star => "star".to_string(),
            OperationType::Unstar => "unstar".to_string(),
            OperationType::Archive => "archive".to_string(),
            OperationType::Delete => "delete".to_string(),
            OperationType::AddLabel => "add_label".to_string(),
            OperationType::RemoveLabel => "remove_label".to_string(),
        }
    }

    fn save_to_file(&self) -> Result<(), GmailError> {
        let operations = self.operations.lock().unwrap();
        let operations_vec: Vec<QueuedOperation> = operations.values().cloned().collect();
        
        let json_data = serde_json::to_string_pretty(&operations_vec)
            .map_err(|e| GmailError::Storage(format!("Failed to serialize queue: {}", e)))?;
        
        std::fs::write(&self.queue_file_path, json_data)
            .map_err(|e| GmailError::Storage(format!("Failed to write queue file: {}", e)))?;
        
        Ok(())
    }

    fn load_from_file(&self) -> Result<(), GmailError> {
        if !self.queue_file_path.exists() {
            return Ok(());
        }

        let json_data = std::fs::read_to_string(&self.queue_file_path)
            .map_err(|e| GmailError::Storage(format!("Failed to read queue file: {}", e)))?;
        
        let operations_vec: Vec<QueuedOperation> = serde_json::from_str(&json_data)
            .map_err(|e| GmailError::Storage(format!("Failed to deserialize queue: {}", e)))?;
        
        {
            let mut operations = self.operations.lock().unwrap();
            operations.clear();
            for operation in operations_vec {
                operations.insert(operation.id.clone(), operation);
            }
        }
        
        Ok(())
    }
}

pub struct QueueProcessor {
    queue: Arc<OfflineQueue>,
    #[allow(dead_code)]
    processing: Arc<Mutex<bool>>,
}

impl QueueProcessor {
    pub fn new(queue: Arc<OfflineQueue>) -> Self {
        Self {
            queue,
            processing: Arc::new(Mutex::new(false)),
        }
    }

    #[allow(dead_code)]
    pub async fn start_background_processing(&self) {
        let queue = self.queue.clone();
        let processing = self.processing.clone();
        
        tokio::spawn(async move {
            loop {
                // Wait 30 seconds between processing cycles
                sleep(TokioDuration::from_secs(30)).await;
                
                // Skip if already processing
                {
                    let is_processing = processing.lock().unwrap();
                    if *is_processing {
                        continue;
                    }
                }
                
                // Process pending operations
                let pending = queue.get_pending_operations();
                if !pending.is_empty() {
                    {
                        let mut is_processing = processing.lock().unwrap();
                        *is_processing = true;
                    }
                    
                    
                    for operation in pending {
                        // TODO: Implement actual operation processing here
                        // This would call the appropriate Gmail API methods
                        match Self::process_operation(&operation).await {
                            Ok(_) => {
                                let _ = queue.mark_operation_success(&operation.id);
                            }
                            Err(e) => {
                                let _ = queue.mark_operation_failed(&operation.id, &e.to_string());
                            }
                        }
                        
                        // Small delay between operations to avoid rate limits
                        sleep(TokioDuration::from_millis(100)).await;
                    }
                    
                    {
                        let mut is_processing = processing.lock().unwrap();
                        *is_processing = false;
                    }
                }
            }
        });
        
    }

    #[allow(dead_code)]
    async fn process_operation(operation: &QueuedOperation) -> Result<(), GmailError> {
        
        // TODO: Implement actual operation processing based on operation_type
        // This would interface with the Gmail API to execute the queued operations
        
        match operation.operation_type {
            OperationType::SendEmail => {
                // Process send email operation
            }
            OperationType::ReplyEmail => {
                // Process reply email operation
            }
            OperationType::ForwardEmail => {
                // Process forward email operation
            }
            OperationType::MarkAsRead => {
                // Process mark as read operation
            }
            OperationType::MarkAsUnread => {
                // Process mark as unread operation
            }
            OperationType::Star => {
                // Process star operation
            }
            OperationType::Unstar => {
                // Process unstar operation
            }
            OperationType::Archive => {
                // Process archive operation
            }
            OperationType::Delete => {
                // Process delete operation
            }
            OperationType::AddLabel => {
                // Process add label operation
            }
            OperationType::RemoveLabel => {
                // Process remove label operation
            }
        }
        
        // Simulate processing time
        sleep(TokioDuration::from_millis(100)).await;
        
        Ok(())
    }

    pub fn force_process_all(&self) -> Result<u32, GmailError> {
        let pending = self.queue.get_pending_operations();
        let count = pending.len() as u32;
        
        
        // For now, just mark all as successful
        // TODO: Implement actual processing
        for operation in pending {
            self.queue.mark_operation_success(&operation.id)?;
        }
        
        Ok(count)
    }
}