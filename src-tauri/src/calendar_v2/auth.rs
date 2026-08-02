//! Multi-account OAuth flows for V2.
//!
//! Fixes the V1 flaw where one shared PKCE file + one callback file made
//! concurrent logins collide: every flow gets a uuid `flow_id` carried in
//! the OAuth `state`; the loopback callback resolves the matching in-memory
//! waiter directly (no temp files, no polling).

use std::collections::HashMap;
use std::sync::Mutex;

use once_cell::sync::Lazy;
use tokio::sync::oneshot;

/// flow_id → sender resolved by the HTTP callback with the auth `code`.
static FLOWS: Lazy<Mutex<HashMap<String, oneshot::Sender<String>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub fn register_flow(flow_id: &str) -> oneshot::Receiver<String> {
    let (tx, rx) = oneshot::channel();
    FLOWS.lock().unwrap().insert(flow_id.to_string(), tx);
    rx
}

pub fn cancel_flow(flow_id: &str) {
    FLOWS.lock().unwrap().remove(flow_id);
}

/// Called by oauth_server's /cal2-callback route. Returns true if a waiting
/// flow consumed the code.
pub fn complete_flow(state: &str, code: &str) -> bool {
    if let Some(tx) = FLOWS.lock().unwrap().remove(state) {
        return tx.send(code.to_string()).is_ok();
    }
    false
}

pub struct PkcePair {
    pub verifier: String,
    pub challenge: String,
}

pub fn pkce_pair() -> PkcePair {
    let verifier = pkce::code_verifier(64);
    let challenge = pkce::code_challenge(&verifier);
    PkcePair {
        verifier: String::from_utf8_lossy(&verifier).to_string(),
        challenge,
    }
}

pub fn redirect_uri() -> String {
    let port = std::env::var("OAUTH_PORT").ok().and_then(|p| p.parse::<u16>().ok()).unwrap_or(9080);
    format!("http://localhost:{port}/cal2-callback")
}
