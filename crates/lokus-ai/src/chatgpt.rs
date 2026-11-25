//! @part-of ai
//! Sign in with ChatGPT: use the person's own ChatGPT plan instead of an API
//! key. OpenAI offers this to open-source apps that run on the person's
//! machine. The flow is OAuth with PKCE and a redirect to a local port; the
//! first sign-in also registers this installation and gets its client id.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::config::{answered, forget, keep, kept, kept_now};
use crate::error::{AiError, Result};

const ACCOUNT: &str = "chatgpt";
const AUTH: &str = "https://auth.openai.com";
const RESOURCE: &str = "https://api.openai.com/v1";
const FIRST_CLIENT: &str = "dynamic_agent_client";
const PLAN_SCOPE: &str = "chatgpt.tokens.use.direct";
const SCOPES: &str =
    "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const WAIT: Duration = Duration::from_secs(300);
const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>Lokus</title>\
<body style=\"font:16px -apple-system,sans-serif;text-align:center;padding-top:20vh\">\
<h2>Signed in</h2><p>You can close this tab and go back to Lokus.</p>";

#[derive(Default, Serialize, Deserialize)]
struct Session {
    /// Identifies this installation; made once and kept.
    host_id: String,
    /// Issued by OpenAI on the first sign-in and reused after that.
    client_id: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
    /// Seconds since 1970.
    expires_at: u64,
}

fn load() -> Session {
    kept(ACCOUNT)
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

/// What the keychain holds at this moment, not what this process last read from it.
fn reload() -> Session {
    kept_now(ACCOUNT)
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

fn save(session: &Session) {
    keep(ACCOUNT, &serde_json::to_string(session).unwrap_or_default());
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// The sign-in service; replaceable so the flow can be exercised against a stand-in.
fn auth_url() -> String {
    std::env::var("LOKUS_CHATGPT_AUTH_URL").unwrap_or_else(|_| AUTH.to_string())
}

fn random() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

fn encode(text: &str) -> String {
    text.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn query(path: &str, key: &str) -> Option<String> {
    let (_, pairs) = path.split_once('?')?;
    pairs.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        (k == key).then(|| {
            let bytes = v.replace('+', " ");
            let mut out = Vec::new();
            let raw = bytes.as_bytes();
            let mut i = 0;
            while i < raw.len() {
                let hex = (raw[i] == b'%' && i + 2 < raw.len())
                    .then(|| std::str::from_utf8(raw.get(i + 1..i + 3)?).ok())
                    .flatten()
                    .and_then(|h| u8::from_str_radix(h, 16).ok());
                match hex {
                    Some(byte) => {
                        out.push(byte);
                        i += 3;
                    }
                    None => {
                        out.push(raw[i]);
                        i += 1;
                    }
                }
            }
            String::from_utf8_lossy(&out).into_owned()
        })
    })
}

fn failed(message: impl Into<String>) -> AiError {
    AiError::SignIn(message.into())
}

pub fn signed_in() -> bool {
    current().refresh_token.is_some()
}

/// The sign-in to work with. When this copy holds none it asks the keychain again: another copy
/// of Lokus may have signed in, or finished a slow renewal, since this one last looked. A
/// keychain that refused to be read is not asked twice.
fn current() -> Session {
    let session = load();
    if session.refresh_token.is_some() || !answered(ACCOUNT) {
        return session;
    }
    reload()
}

/// Forget the tokens. The installation's ids are kept, so signing in again is quick.
pub fn sign_out() {
    SIGN_OUTS.fetch_add(1, Ordering::SeqCst);
    forget_tokens();
}

/// How many times the person has signed out here, so a renewal on its way can tell.
static SIGN_OUTS: AtomicU64 = AtomicU64::new(0);

fn forget_tokens() {
    let old = reload();
    if old.host_id.is_empty() {
        forget(ACCOUNT);
        return;
    }
    save(&Session {
        host_id: old.host_id,
        client_id: old.client_id,
        ..Session::default()
    });
}

/// Why the sign-in service did not hand over tokens.
enum Refused {
    /// It could not be reached.
    Network,
    /// It said no to what was sent: the code or refresh token is spent or revoked.
    Rejected(String),
    /// It answered, but not about the sign-in: busy, rate limited, broken.
    Unavailable(u16),
}

impl From<Refused> for AiError {
    fn from(refused: Refused) -> Self {
        match refused {
            Refused::Network => AiError::Network(auth_url()),
            Refused::Rejected(code) => failed(format!("ChatGPT sign-in was refused ({code})")),
            Refused::Unavailable(status) => failed(format!(
                "ChatGPT's sign-in service is not answering ({status}); try again in a moment"
            )),
        }
    }
}

async fn token_request(form: &[(&str, &str)]) -> std::result::Result<Value, Refused> {
    let response = reqwest::Client::new()
        .post(format!("{}/api/accounts/oauth/token", auth_url()))
        .form(form)
        // A sign-in service that never answers is unreachable, not a refusal.
        .timeout(RENEWAL_ENDS_WITHIN)
        .send()
        .await
        .map_err(|_| Refused::Network)?;
    let status = response.status();
    let body: Value = response.json().await.unwrap_or_default();
    if status.is_success() {
        return Ok(body);
    }
    if !matches!(status.as_u16(), 400 | 401) {
        return Err(Refused::Unavailable(status.as_u16()));
    }
    let code = body["error"]
        .as_str()
        .or_else(|| body["error"]["code"].as_str());
    Err(Refused::Rejected(
        code.unwrap_or("no reason given").to_string(),
    ))
}

fn accept(session: &mut Session, tokens: &Value) -> Result<()> {
    let access = tokens["access_token"]
        .as_str()
        .ok_or_else(|| failed("ChatGPT sent no access token"))?;
    session.access_token = Some(access.to_string());
    if let Some(refresh) = tokens["refresh_token"].as_str() {
        // Refresh tokens are single-use: always keep the newest.
        session.refresh_token = Some(refresh.to_string());
    }
    session.expires_at = now() + tokens["expires_in"].as_u64().unwrap_or(3600);
    Ok(())
}

/// One refresh at a time. A refresh token works once: two requests that both found the token
/// run out used to spend the same one, the second was refused, and the refusal signed the
/// person out although the first had just renewed the sign-in (2026-11-25).
static REFRESHING: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// How long a renewal waits for the sign-in service to answer.
const RENEWAL_ENDS_WITHIN: Duration = Duration::from_secs(20);

/// How long a refused renewal waits for another copy of Lokus to save the sign-in it just won:
/// a little longer than that copy's own renewal can take.
const WINNER_SAVES_WITHIN: Duration = Duration::from_secs(22);

/// A token that is good for a request right now, refreshing it if it is about to run out.
pub async fn access_token() -> Result<String> {
    finished(None).await
}

/// A token to try again with after the provider answered 401 to `refused`: the newer one if a
/// renewal has happened since, otherwise the result of renewing now.
pub async fn renewed(refused: &str) -> Result<String> {
    finished(Some(refused.to_owned())).await
}

/// Runs the renewal to its end even if the answer that asked for it is stopped: a refresh token
/// the service has already spent is worthless unless its replacement is saved.
async fn finished(refused: Option<String>) -> Result<String> {
    tokio::spawn(token(refused))
        .await
        .unwrap_or_else(|_| Err(failed("could not renew the ChatGPT sign-in; try again")))
}

async fn token(refused: Option<String>) -> Result<String> {
    let refused = refused.as_deref();
    let _one = REFRESHING.lock().await;
    let sign_outs = SIGN_OUTS.load(Ordering::SeqCst);
    let mut session = if refused.is_some() {
        reload()
    } else {
        current()
    };
    // Tried again only while the keychain turns out to hold a newer sign-in than the one refused.
    loop {
        let (Some(refresh), Some(client)) =
            (session.refresh_token.clone(), session.client_id.clone())
        else {
            return Err(failed("sign in with ChatGPT in Settings first"));
        };
        if let Some(token) = session
            .access_token
            .clone()
            .filter(|token| session.expires_at > now() + 60 && Some(token.as_str()) != refused)
        {
            return Ok(token);
        }
        let form = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh.as_str()),
            ("client_id", client.as_str()),
            ("resource", RESOURCE),
        ];
        match token_request(&form).await {
            Ok(tokens) => {
                // Signed out in Settings while this was on its way: stay signed out.
                if SIGN_OUTS.load(Ordering::SeqCst) != sign_outs {
                    return Err(failed("sign in with ChatGPT in Settings first"));
                }
                accept(&mut session, &tokens)?;
                save(&session);
                return session
                    .access_token
                    .ok_or_else(|| failed("ChatGPT sent no access token"));
            }
            Err(Refused::Rejected(_)) => {
                // Another copy of Lokus may have spent this refresh token a moment ago and not
                // have saved what it got yet: look again for a short while before giving up.
                let gave_up = Instant::now() + WINNER_SAVES_WITHIN;
                let newer = loop {
                    let stored = reload();
                    if stored.refresh_token.is_some()
                        && stored.refresh_token.as_deref() != Some(refresh.as_str())
                    {
                        break Some(stored);
                    }
                    if Instant::now() >= gave_up {
                        break None;
                    }
                    tokio::time::sleep(Duration::from_millis(250)).await;
                };
                match newer {
                    Some(stored) => session = stored,
                    None => break,
                }
            }
            Err(other) => return Err(other.into()),
        }
    }
    // Only the sign-in that was refused is dropped, never one another copy saved this instant.
    if reload().refresh_token == session.refresh_token {
        forget_tokens();
    }
    Err(failed(
        "your ChatGPT sign-in has expired; sign in again in Settings",
    ))
}

/// Sign in. `show` is handed the address to open in a browser; this returns
/// once the browser has come back, or after five minutes.
pub async fn login(show: impl FnOnce(&str)) -> Result<()> {
    let outcome = sign_in(show).await;
    // A sign-in that fails with a remembered client id may be failing because of that id (a
    // stand-in's id once got saved here and OpenAI turned every later sign-in away). Drop it, so
    // the next try registers this installation afresh.
    if outcome.is_err() {
        let mut session = load();
        if session.access_token.is_none() && session.client_id.take().is_some() {
            save(&session);
        }
    }
    outcome
}

async fn sign_in(show: impl FnOnce(&str)) -> Result<()> {
    let io = |e: std::io::Error| failed(format!("sign-in failed: {e}"));
    let mut session = load();
    if session.host_id.is_empty() {
        session.host_id = format!("urn:uuid:{}", uuid::Uuid::new_v4());
        save(&session);
    }
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.map_err(io)?;
    let port = listener.local_addr().map_err(io)?.port();
    // Only the port may differ between sign-ins; the host and path are fixed.
    let redirect = format!("http://127.0.0.1:{port}/auth/callback");
    let (state, nonce, verifier) = (random(), random(), random());
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(Sha256::digest(verifier.as_bytes()));
    let client = session
        .client_id
        .clone()
        .unwrap_or_else(|| FIRST_CLIENT.to_string());
    let mut url = format!(
        "{}/api/accounts/authorize?response_type=code&client_id={}&redirect_uri={}&scope={}&resource={}&state={state}&nonce={nonce}&code_challenge={challenge}&code_challenge_method=S256",
        auth_url(),
        encode(&client),
        encode(&redirect),
        encode(SCOPES),
        encode(RESOURCE),
    );
    if session.client_id.is_none() {
        url.push_str(&format!(
            "&agent_name_hint=Lokus&ext_agent_host_id={}",
            encode(&session.host_id)
        ));
    }
    show(&url);

    let came_back = async {
        loop {
            let (mut stream, _) = listener.accept().await?;
            let mut head = vec![0u8; 16384];
            let n = stream.read(&mut head).await?;
            let request = String::from_utf8_lossy(&head[..n]).into_owned();
            let path = request
                .split_whitespace()
                .nth(1)
                .unwrap_or_default()
                .to_string();
            let found = path.starts_with("/auth/callback?");
            let (status, body) = if found {
                ("200 OK", DONE_PAGE)
            } else {
                ("404 Not Found", "")
            };
            let reply = format!(
                "HTTP/1.1 {status}\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(reply.as_bytes()).await?;
            if found {
                return Ok::<String, std::io::Error>(path);
            }
        }
    };
    let path = tokio::time::timeout(WAIT, came_back)
        .await
        .map_err(|_| failed("sign-in was not finished in the browser"))?
        .map_err(io)?;
    if let Some(error) = query(&path, "error") {
        return Err(failed(if error == "access_denied" {
            "sign-in was cancelled".to_string()
        } else {
            format!("ChatGPT sign-in was refused ({error})")
        }));
    }
    if query(&path, "state").as_deref() != Some(state.as_str()) {
        return Err(failed(
            "the sign-in answer did not match the request; try again",
        ));
    }
    let code = query(&path, "code").ok_or_else(|| failed("ChatGPT sent no sign-in code"))?;
    // The first sign-in hands this installation its own client id.
    let client = query(&path, "client_id").unwrap_or(client);
    if client == FIRST_CLIENT {
        return Err(failed("ChatGPT did not register this app; try again"));
    }
    let form = [
        ("grant_type", "authorization_code"),
        ("client_id", client.as_str()),
        ("code", code.as_str()),
        ("code_verifier", verifier.as_str()),
        ("redirect_uri", redirect.as_str()),
        ("resource", RESOURCE),
    ];
    let tokens = token_request(&form).await?;
    session.client_id = Some(client);
    let granted = tokens["scope"].as_str().unwrap_or(SCOPES);
    if !granted.split_whitespace().any(|s| s == PLAN_SCOPE) {
        save(&session);
        return Err(failed(
            "signed in, but this ChatGPT account did not allow its plan to be used here (it needs Plus or Pro)",
        ));
    }
    accept(&mut session, &tokens)?;
    save(&session);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn callback_values_are_read_and_decoded() {
        let path = "/auth/callback?code=a%2Fb+c&state=xyz&client_id=oaiapp_1";
        assert_eq!(query(path, "code").as_deref(), Some("a/b c"));
        assert_eq!(query(path, "client_id").as_deref(), Some("oaiapp_1"));
        assert_eq!(query(path, "missing"), None);
        assert_eq!(
            encode("http://127.0.0.1:1/a b"),
            "http%3A%2F%2F127.0.0.1%3A1%2Fa%20b"
        );
    }
}
