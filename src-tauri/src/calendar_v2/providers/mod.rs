pub mod caldav;
pub mod common;
pub mod google;
pub mod ical;
pub mod microsoft;
pub mod notion;

use std::sync::Arc;

use super::connector::CalendarConnector;
use super::models::Account;

/// Build the connector for an account row. Returns None for providers not
/// yet ported (they arrive in later phases).
pub fn connector_for(account: &Account) -> Option<Arc<dyn CalendarConnector>> {
    match account.provider.as_str() {
        "google" => Some(Arc::new(google::GoogleConnector::new(account.id.clone()))),
        "microsoft" => Some(Arc::new(microsoft::MicrosoftConnector::new(account.id.clone()))),
        "caldav" | "icloud" => Some(Arc::new(caldav::CalDavConnector::new(
            account.id.clone(),
            account.config.clone(),
        ))),
        "notion" => Some(Arc::new(notion::NotionConnector::new(account.id.clone()))),
        "ical" => Some(Arc::new(ical::IcalConnector {
            url: account.identity.clone(),
            name: account.label.clone(),
        })),
        _ => None,
    }
}

/// Minimum interval between syncs per provider (engine cadence control):
/// APIs with cheap deltas poll fast; feed/CTag providers poll slow.
pub fn min_sync_interval_ms(provider: &str) -> i64 {
    match provider {
        "google" | "microsoft" => 60_000,
        "notion" => 120_000,
        "caldav" | "icloud" => 5 * 60_000,
        "ical" => 15 * 60_000,
        _ => 5 * 60_000,
    }
}
