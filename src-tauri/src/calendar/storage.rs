use std::path::PathBuf;
use keyring::Entry;
use crate::calendar::models::{CalendarToken, CalendarAccount, Calendar, CalendarError, ICalSubscription, CalendarEvent, CalDAVAccount};
use serde_json;

const GOOGLE_TOKEN_KEY: &str = "lokus_google_calendar_token";
const GOOGLE_ACCOUNT_KEY: &str = "lokus_google_calendar_account";
const CALENDARS_KEY: &str = "lokus_calendars";
const SERVICE_NAME: &str = "com.lokus.app.calendar";

pub struct CalendarStorage;

impl CalendarStorage {
    fn get_keyring_entry(key: &str) -> Result<Entry, CalendarError> {
        Entry::new(SERVICE_NAME, key)
            .map_err(|e| CalendarError::Storage(format!("Failed to create keyring entry: {}", e)))
    }

    // Token storage
    pub fn store_google_token(token: &CalendarToken) -> Result<(), CalendarError> {
        // In development mode, use file storage as fallback due to keychain issues
        if cfg!(debug_assertions) {
            return Self::store_token_to_file("google", token);
        }

        let entry = Self::get_keyring_entry(GOOGLE_TOKEN_KEY)?;
        let token_json = serde_json::to_string(token)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize token: {}", e)))?;

        entry.set_password(&token_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to store token: {}", e)))
    }

    pub fn get_google_token() -> Result<Option<CalendarToken>, CalendarError> {
        // In development mode, use file storage
        if cfg!(debug_assertions) {
            return Self::get_token_from_file("google");
        }

        let entry = Self::get_keyring_entry(GOOGLE_TOKEN_KEY)?;
        match entry.get_password() {
            Ok(token_json) => {
                let token: CalendarToken = serde_json::from_str(&token_json)
                    .map_err(|e| CalendarError::Storage(format!("Failed to deserialize token: {}", e)))?;
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(CalendarError::Storage(format!("Failed to retrieve token: {}", e))),
        }
    }

    pub fn delete_google_token() -> Result<(), CalendarError> {
        // In development mode, delete from file storage
        if cfg!(debug_assertions) {
            let token_path = Self::get_dev_token_path("google")?;
            if token_path.exists() {
                std::fs::remove_file(&token_path)
                    .map_err(|e| CalendarError::Storage(format!("Failed to delete token file: {}", e)))?;
            }
            return Ok(());
        }

        let entry = Self::get_keyring_entry(GOOGLE_TOKEN_KEY)?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
            Err(e) => Err(CalendarError::Storage(format!("Failed to delete token: {}", e))),
        }
    }

    // Account storage
    pub fn store_google_account(account: &CalendarAccount) -> Result<(), CalendarError> {
        if cfg!(debug_assertions) {
            return Self::store_account_to_file("google", account);
        }

        let entry = Self::get_keyring_entry(GOOGLE_ACCOUNT_KEY)?;
        let account_json = serde_json::to_string(account)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize account: {}", e)))?;

        entry.set_password(&account_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to store account: {}", e)))
    }

    pub fn get_google_account() -> Result<Option<CalendarAccount>, CalendarError> {
        if cfg!(debug_assertions) {
            return Self::get_account_from_file("google");
        }

        let entry = Self::get_keyring_entry(GOOGLE_ACCOUNT_KEY)?;
        match entry.get_password() {
            Ok(account_json) => {
                let account: CalendarAccount = serde_json::from_str(&account_json)
                    .map_err(|e| CalendarError::Storage(format!("Failed to deserialize account: {}", e)))?;
                Ok(Some(account))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(CalendarError::Storage(format!("Failed to retrieve account: {}", e))),
        }
    }

    pub fn delete_google_account() -> Result<(), CalendarError> {
        if cfg!(debug_assertions) {
            let account_path = Self::get_dev_account_path("google")?;
            if account_path.exists() {
                std::fs::remove_file(&account_path)
                    .map_err(|e| CalendarError::Storage(format!("Failed to delete account file: {}", e)))?;
            }
            return Ok(());
        }

        let entry = Self::get_keyring_entry(GOOGLE_ACCOUNT_KEY)?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(CalendarError::Storage(format!("Failed to delete account: {}", e))),
        }
    }

    // Calendars list storage (stored in file for both dev and prod - not sensitive)
    pub fn store_calendars(calendars: &[Calendar]) -> Result<(), CalendarError> {
        let calendars_path = Self::get_calendars_path()?;
        let calendars_json = serde_json::to_string_pretty(calendars)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize calendars: {}", e)))?;

        std::fs::write(&calendars_path, calendars_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write calendars file: {}", e)))?;

        Ok(())
    }

    pub fn get_calendars() -> Result<Vec<Calendar>, CalendarError> {
        let calendars_path = Self::get_calendars_path()?;

        if !calendars_path.exists() {
            return Ok(Vec::new());
        }

        let calendars_json = std::fs::read_to_string(&calendars_path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read calendars file: {}", e)))?;

        let calendars: Vec<Calendar> = serde_json::from_str(&calendars_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize calendars: {}", e)))?;

        Ok(calendars)
    }

    pub fn delete_calendars() -> Result<(), CalendarError> {
        let calendars_path = Self::get_calendars_path()?;
        if calendars_path.exists() {
            std::fs::remove_file(&calendars_path)
                .map_err(|e| CalendarError::Storage(format!("Failed to delete calendars file: {}", e)))?;
        }
        Ok(())
    }

    // Token expiration check
    pub fn is_token_expired(token: &CalendarToken) -> bool {
        if let Some(expires_at) = token.expires_at {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            // Consider expired if less than 5 minutes remaining
            expires_at <= now + 300
        } else {
            false
        }
    }

    // Clear all calendar storage
    pub fn clear_all() -> Result<(), CalendarError> {
        let _ = Self::delete_google_token();
        let _ = Self::delete_google_account();
        let _ = Self::delete_calendars();
        Ok(())
    }

    // File-based storage helpers for development mode
    fn get_dev_base_path() -> Result<PathBuf, CalendarError> {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| CalendarError::Storage("Failed to get home directory".to_string()))?;
        let app_dir = home_dir.join(".lokus").join("calendar");
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir)
                .map_err(|e| CalendarError::Storage(format!("Failed to create calendar directory: {}", e)))?;
        }
        Ok(app_dir)
    }

    fn get_dev_token_path(provider: &str) -> Result<PathBuf, CalendarError> {
        let base_path = Self::get_dev_base_path()?;
        Ok(base_path.join(format!("{}_token.json", provider)))
    }

    fn get_dev_account_path(provider: &str) -> Result<PathBuf, CalendarError> {
        let base_path = Self::get_dev_base_path()?;
        Ok(base_path.join(format!("{}_account.json", provider)))
    }

    fn get_calendars_path() -> Result<PathBuf, CalendarError> {
        let base_path = Self::get_dev_base_path()?;
        Ok(base_path.join("calendars.json"))
    }

    fn store_token_to_file(provider: &str, token: &CalendarToken) -> Result<(), CalendarError> {
        let token_path = Self::get_dev_token_path(provider)?;
        let token_json = serde_json::to_string(token)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize token: {}", e)))?;

        std::fs::write(&token_path, token_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write token file: {}", e)))?;

        Ok(())
    }

    fn get_token_from_file(provider: &str) -> Result<Option<CalendarToken>, CalendarError> {
        let token_path = Self::get_dev_token_path(provider)?;

        if !token_path.exists() {
            return Ok(None);
        }

        let token_json = std::fs::read_to_string(&token_path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read token file: {}", e)))?;

        let token: CalendarToken = serde_json::from_str(&token_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize token: {}", e)))?;

        Ok(Some(token))
    }

    fn store_account_to_file(provider: &str, account: &CalendarAccount) -> Result<(), CalendarError> {
        let account_path = Self::get_dev_account_path(provider)?;
        let account_json = serde_json::to_string(account)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize account: {}", e)))?;

        std::fs::write(&account_path, account_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write account file: {}", e)))?;

        Ok(())
    }

    fn get_account_from_file(provider: &str) -> Result<Option<CalendarAccount>, CalendarError> {
        let account_path = Self::get_dev_account_path(provider)?;

        if !account_path.exists() {
            return Ok(None);
        }

        let account_json = std::fs::read_to_string(&account_path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read account file: {}", e)))?;

        let account: CalendarAccount = serde_json::from_str(&account_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize account: {}", e)))?;

        Ok(Some(account))
    }

    // iCal subscription storage
    fn get_ical_subscriptions_path() -> Result<PathBuf, CalendarError> {
        let base_path = Self::get_dev_base_path()?;
        Ok(base_path.join("ical_subscriptions.json"))
    }

    fn get_ical_events_path(subscription_id: &str) -> Result<PathBuf, CalendarError> {
        let base_path = Self::get_dev_base_path()?;
        let ical_dir = base_path.join("ical_events");
        if !ical_dir.exists() {
            std::fs::create_dir_all(&ical_dir)
                .map_err(|e| CalendarError::Storage(format!("Failed to create ical events directory: {}", e)))?;
        }
        Ok(ical_dir.join(format!("{}.json", subscription_id)))
    }

    pub fn store_ical_subscriptions(subscriptions: &[ICalSubscription]) -> Result<(), CalendarError> {
        let path = Self::get_ical_subscriptions_path()?;
        let json = serde_json::to_string_pretty(subscriptions)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize subscriptions: {}", e)))?;

        std::fs::write(&path, json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write subscriptions file: {}", e)))?;

        Ok(())
    }

    pub fn get_ical_subscriptions() -> Result<Vec<ICalSubscription>, CalendarError> {
        let path = Self::get_ical_subscriptions_path()?;

        if !path.exists() {
            return Ok(Vec::new());
        }

        let json = std::fs::read_to_string(&path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read subscriptions file: {}", e)))?;

        let subscriptions: Vec<ICalSubscription> = serde_json::from_str(&json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize subscriptions: {}", e)))?;

        Ok(subscriptions)
    }

    pub fn store_ical_events(subscription_id: &str, events: &[CalendarEvent]) -> Result<(), CalendarError> {
        let path = Self::get_ical_events_path(subscription_id)?;
        let json = serde_json::to_string_pretty(events)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize events: {}", e)))?;

        std::fs::write(&path, json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write events file: {}", e)))?;

        Ok(())
    }

    pub fn get_ical_events(subscription_id: &str) -> Result<Vec<CalendarEvent>, CalendarError> {
        let path = Self::get_ical_events_path(subscription_id)?;

        if !path.exists() {
            return Ok(Vec::new());
        }

        let json = std::fs::read_to_string(&path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read events file: {}", e)))?;

        let events: Vec<CalendarEvent> = serde_json::from_str(&json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize events: {}", e)))?;

        Ok(events)
    }

    pub fn delete_ical_events(subscription_id: &str) -> Result<(), CalendarError> {
        let path = Self::get_ical_events_path(subscription_id)?;
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| CalendarError::Storage(format!("Failed to delete events file: {}", e)))?;
        }
        Ok(())
    }

    pub fn get_all_ical_events() -> Result<Vec<CalendarEvent>, CalendarError> {
        let subscriptions = Self::get_ical_subscriptions()?;
        let mut all_events = Vec::new();

        for sub in subscriptions {
            if sub.enabled {
                let events = Self::get_ical_events(&sub.id)?;
                all_events.extend(events);
            }
        }

        Ok(all_events)
    }

    // CalDAV account storage
    const CALDAV_ACCOUNT_KEY: &'static str = "lokus_caldav_account";
    const CALDAV_SERVICE_NAME: &'static str = "com.lokus.app.caldav";

    fn get_caldav_account_path() -> Result<PathBuf, CalendarError> {
        let base_path = Self::get_dev_base_path()?;
        Ok(base_path.join("caldav_account.json"))
    }

    fn get_caldav_password_path() -> Result<PathBuf, CalendarError> {
        let base_path = Self::get_dev_base_path()?;
        Ok(base_path.join("caldav_password.enc"))
    }

    pub fn store_caldav_account(account: &CalDAVAccount) -> Result<(), CalendarError> {
        // Store account info (without password)
        let account_path = Self::get_caldav_account_path()?;
        let account_json = serde_json::to_string_pretty(account)
            .map_err(|e| CalendarError::Storage(format!("Failed to serialize account: {}", e)))?;

        std::fs::write(&account_path, account_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to write account file: {}", e)))?;

        // Store password securely
        if cfg!(debug_assertions) {
            // Dev mode: store password in file (base64 encoded for minimal obfuscation)
            let password_path = Self::get_caldav_password_path()?;
            let encoded = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &account.password);
            std::fs::write(&password_path, encoded)
                .map_err(|e| CalendarError::Storage(format!("Failed to write password file: {}", e)))?;
        } else {
            // Production: use keyring
            let entry = Entry::new(Self::CALDAV_SERVICE_NAME, Self::CALDAV_ACCOUNT_KEY)
                .map_err(|e| CalendarError::Storage(format!("Failed to create keyring entry: {}", e)))?;
            entry.set_password(&account.password)
                .map_err(|e| CalendarError::Storage(format!("Failed to store password: {}", e)))?;
        }

        Ok(())
    }

    pub fn get_caldav_account() -> Result<Option<CalDAVAccount>, CalendarError> {
        let account_path = Self::get_caldav_account_path()?;

        if !account_path.exists() {
            return Ok(None);
        }

        let account_json = std::fs::read_to_string(&account_path)
            .map_err(|e| CalendarError::Storage(format!("Failed to read account file: {}", e)))?;

        let mut account: CalDAVAccount = serde_json::from_str(&account_json)
            .map_err(|e| CalendarError::Storage(format!("Failed to deserialize account: {}", e)))?;

        // Retrieve password
        if cfg!(debug_assertions) {
            let password_path = Self::get_caldav_password_path()?;
            if password_path.exists() {
                let encoded = std::fs::read_to_string(&password_path)
                    .map_err(|e| CalendarError::Storage(format!("Failed to read password file: {}", e)))?;
                let decoded = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &encoded)
                    .map_err(|e| CalendarError::Storage(format!("Failed to decode password: {}", e)))?;
                account.password = String::from_utf8(decoded)
                    .map_err(|e| CalendarError::Storage(format!("Invalid password encoding: {}", e)))?;
            }
        } else {
            let entry = Entry::new(Self::CALDAV_SERVICE_NAME, Self::CALDAV_ACCOUNT_KEY)
                .map_err(|e| CalendarError::Storage(format!("Failed to create keyring entry: {}", e)))?;
            match entry.get_password() {
                Ok(password) => account.password = password,
                Err(keyring::Error::NoEntry) => {},
                Err(e) => return Err(CalendarError::Storage(format!("Failed to retrieve password: {}", e))),
            }
        }

        Ok(Some(account))
    }

    pub fn delete_caldav_account() -> Result<(), CalendarError> {
        let account_path = Self::get_caldav_account_path()?;
        if account_path.exists() {
            std::fs::remove_file(&account_path)
                .map_err(|e| CalendarError::Storage(format!("Failed to delete account file: {}", e)))?;
        }

        if cfg!(debug_assertions) {
            let password_path = Self::get_caldav_password_path()?;
            if password_path.exists() {
                let _ = std::fs::remove_file(password_path);
            }
        } else {
            let entry = Entry::new(Self::CALDAV_SERVICE_NAME, Self::CALDAV_ACCOUNT_KEY)
                .map_err(|e| CalendarError::Storage(format!("Failed to create keyring entry: {}", e)))?;
            let _ = entry.delete_credential();
        }

        Ok(())
    }
}
