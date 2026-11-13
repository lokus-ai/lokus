//! @part-of ai
//! Sign in with ChatGPT: use the person's own ChatGPT plan instead of an API
//! key. OpenAI offers this to open-source apps that run on the person's
//! machine. The flow is OAuth with PKCE and a redirect to a local port; the
//! first sign-in also registers this installation and gets its client id.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::config::{forget, keep, kept};
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
    load().refresh_token.is_some()
}

/// Forget the tokens. The installation's ids are kept, so signing in again is quick.
pub fn sign_out() {
    let old = load();
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

async fn token_request(form: &[(&str, &str)]) -> Result<Value> {
    let response = reqwest::Client::new()
        .post(format!("{}/api/accounts/oauth/token", auth_url()))
        .form(form)
        .send()
        .await
        .map_err(|_| AiError::Network(auth_url()))?;
    let ok = response.status().is_success();
    let body: Value = response.json().await.unwrap_or_default();
    if ok {
        Ok(body)
    } else {
        let code = body["error"]
            .as_str()
            .or_else(|| body["error"]["code"].as_str());
        Err(failed(format!(
            "ChatGPT sign-in was refused ({})",
            code.unwrap_or("no reason given")
        )))
    }
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

/// A token that is good for a request right now, refreshing it if it is about to run out.
pub async fn access_token() -> Result<String> {
    let mut session = load();
    let (Some(refresh), Some(client)) = (session.refresh_token.clone(), session.client_id.clone())
    else {
        return Err(failed("sign in with ChatGPT in Settings first"));
    };
    if let Some(token) = session
        .access_token
        .clone()
        .filter(|_| session.expires_at > now() + 60)
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
            accept(&mut session, &tokens)?;
            save(&session);
            session
                .access_token
                .ok_or_else(|| failed("ChatGPT sent no access token"))
        }
        Err(AiError::Network(url)) => Err(AiError::Network(url)),
        Err(_) => {
            // The sign-in is no longer good; it has to be done again.
            sign_out();
            Err(failed(
                "your ChatGPT sign-in has expired; sign in again in Settings",
            ))
        }
    }
}

/// Sign in. `show` is handed the address to open in a browser; this returns
/// once the browser has come back, or after five minutes.
pub async fn login(show: impl FnOnce(&str)) -> Result<()> {
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
