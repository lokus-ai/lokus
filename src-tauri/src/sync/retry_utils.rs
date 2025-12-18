// Retry utilities with exponential backoff for enterprise reliability

use std::time::Duration;
// Backoff is not used directly anymore due to type issues
// We implement our own exponential backoff
use futures::future::BoxFuture;
use tracing::{debug, warn, error};

pub struct RetryConfig {
    pub max_retries: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
    pub multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            base_delay_ms: 1000,  // 1 second
            max_delay_ms: 60000,  // 60 seconds
            multiplier: 2.0,      // Double each time
        }
    }
}

pub async fn retry_with_backoff<F, T>(
    operation_name: &str,
    config: &RetryConfig,
    mut operation: F,
) -> Result<T, String>
where
    F: FnMut() -> BoxFuture<'static, Result<T, String>>,
{
    
    let mut attempts = 0;
    let mut last_error;
    
    loop {
        attempts += 1;
        
        debug!(
            "Attempting {} (attempt {}/{})", 
            operation_name, 
            attempts, 
            config.max_retries + 1
        );
        
        match operation().await {
            Ok(result) => {
                if attempts > 1 {
                    debug!(
                        "{} succeeded on attempt {}", 
                        operation_name, 
                        attempts
                    );
                }
                return Ok(result);
            }
            Err(e) => {
                last_error = e;
                
                if attempts > config.max_retries {
                    error!(
                        "{} failed after {} attempts: {}", 
                        operation_name, 
                        attempts, 
                        last_error
                    );
                    return Err(last_error);
                }
                
                warn!(
                    "{} failed (attempt {}): {}, retrying...", 
                    operation_name, 
                    attempts, 
                    last_error
                );
                
                // Calculate backoff duration
                let delay_ms = std::cmp::min(
                    config.base_delay_ms * (config.multiplier.powi((attempts - 1) as i32)) as u64,
                    config.max_delay_ms
                );
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }
        }
    }
}

// Specific retry for network operations
pub async fn retry_network_operation<F, T>(
    operation_name: &str,
    operation: F,
) -> Result<T, String>
where
    F: FnMut() -> BoxFuture<'static, Result<T, String>>,
{
    let config = RetryConfig {
        max_retries: 5,      // More retries for network
        base_delay_ms: 2000, // 2 seconds
        max_delay_ms: 120000, // 2 minutes
        multiplier: 1.5,     // Slower growth
    };
    
    retry_with_backoff(operation_name, &config, operation).await
}