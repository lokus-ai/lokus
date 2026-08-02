pub mod google;

use std::sync::Arc;

use super::connector::CalendarConnector;
use super::models::Account;

/// Build the connector for an account row. Returns None for providers not
/// yet ported (they arrive in later phases).
pub fn connector_for(account: &Account) -> Option<Arc<dyn CalendarConnector>> {
    match account.provider.as_str() {
        "google" => Some(Arc::new(google::GoogleConnector::new(account.id.clone()))),
        _ => None,
    }
}
