//! @part-of calendar
//! Signing in to a provider as a desktop app: the person's browser, a one-time address on this
//! computer for the answer (loopback redirect) and PKCE, the same shape the assistant's
//! connected services use (`lokus-ai` `mcp_login`). The sign-in is kept in the OS keychain and
//! goes nowhere but the provider.

use std::time::Duration;

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use crate::model::{CalError, Provider, Result};

/// Where a provider is reached and who Lokus is to it.
pub struct Endpoints {
    pub authorize: String,
    pub token: String,
    pub api: String,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub scopes: &'static str,
    /// A local stand-in is answering, not the real service.
    pub stand_in: bool,
}

/// Lokus's registration with Google as a desktop app. The id is public and is this unless the
/// build names another. Google also gives a desktop app a "secret" and refuses the exchange
/// without it ("client_secret is missing"), though it says a desktop app cannot keep one: it is
/// read from the build (`LOKUS_GOOGLE_CLIENT_SECRET`) and never written in the repository, so a
/// build without it has no Google sign-in.
const GOOGLE_DEFAULT_ID: &str =
    "285421102231-flnsdrptj4ri7ml8ibkroqnj2kpr2tqt.apps.googleusercontent.com";
const GOOGLE_ID: Option<&str> = option_env!("LOKUS_GOOGLE_CLIENT_ID");
const GOOGLE_SECRET: Option<&str> = option_env!("LOKUS_GOOGLE_CLIENT_SECRET");
/// Microsoft's is set when the app is built; Lokus is not registered there yet.
const MICROSOFT_ID: Option<&str> = option_env!("LOKUS_MICROSOFT_CLIENT_ID");

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.trim().is_empty())
}

fn configured(name: &str, built: Option<&str>) -> Option<String> {
    env(name).or_else(|| built.filter(|v| !v.is_empty()).map(str::to_string))
}

/// `None` while Lokus has no registration with the provider in this build.
pub fn endpoints(provider: Provider) -> Option<Endpoints> {
    // A stand-in's address, for development and the scripted flow only.
    let stand_in = env(match provider {
        Provider::Google => "LOKUS_CALENDAR_GOOGLE",
        Provider::Microsoft => "LOKUS_CALENDAR_MICROSOFT",
    });
    let (id, secret) = match provider {
        Provider::Google => (
            configured("LOKUS_GOOGLE_CLIENT_ID", GOOGLE_ID).or(Some(GOOGLE_DEFAULT_ID.into())),
            configured("LOKUS_GOOGLE_CLIENT_SECRET", GOOGLE_SECRET),
        ),
        Provider::Microsoft => (configured("LOKUS_MICROSOFT_CLIENT_ID", MICROSOFT_ID), None),
    };
    if let Some(base) = stand_in {
        let base = base.trim_end_matches('/').to_string();
        return Some(Endpoints {
            authorize: format!("{base}/authorize"),
            token: format!("{base}/token"),
            api: match provider {
                Provider::Google => base.clone(),
                Provider::Microsoft => format!("{base}/v1.0"),
            },
            client_id: id.unwrap_or_else(|| "lokus-stand-in".into()),
            client_secret: None,
            scopes: scopes(provider),
            stand_in: true,
        });
    }
    let client_id = id?;
    if provider == Provider::Google && secret.is_none() {
        return None;
    }
    Some(match provider {
        Provider::Google => Endpoints {
            authorize: "https://accounts.google.com/o/oauth2/v2/auth".into(),
            token: "https://oauth2.googleapis.com/token".into(),
            api: "https://www.googleapis.com".into(),
            client_id,
            client_secret: secret,
            scopes: scopes(provider),
            stand_in: false,
        },
        Provider::Microsoft => Endpoints {
            authorize: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".into(),
            token: "https://login.microsoftonline.com/common/oauth2/v2.0/token".into(),
            api: "https://graph.microsoft.com/v1.0".into(),
            client_id,
            client_secret: None,
            scopes: scopes(provider),
            stand_in: false,
        },
    })
}

/// The least that covers the calendar list, events and free/busy.
fn scopes(provider: Provider) -> &'static str {
    match provider {
        Provider::Google => {
            "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.freebusy"
        }
        Provider::Microsoft => "offline_access User.Read Calendars.ReadWrite",
    }
}

pub fn need(provider: Provider) -> Result<Endpoints> {
    endpoints(provider).ok_or_else(|| {
        let name = match provider {
            Provider::Google => "Google Calendar",
            Provider::Microsoft => "Microsoft 365",
        };
        CalError::new(
            "not_available",
            format!("{name} is not available in this build of Lokus yet."),
        )
    })
}

/// A sign-in as it is kept in the keychain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tokens {
    pub access: String,
    pub refresh: String,
    /// Seconds since 1970 when `access` stops working.
    pub until: i64,
}

fn slot(account: &str) -> String {
    format!("calendar:{account}")
}

pub fn kept(account: &str) -> Option<Tokens> {
    serde_json::from_str(&lokus_ai::config::kept(&slot(account))?).ok()
}

pub fn keep(account: &str, tokens: &Tokens) {
    lokus_ai::config::keep(
        &slot(account),
        &serde_json::to_string(tokens).unwrap_or_default(),
    );
}

pub fn forget(account: &str) {
    lokus_ai::config::forget(&slot(account));
}

pub fn http() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(30))
        .build()
        .unwrap_or_default()
}

/// What went wrong reaching a provider. Only a connection that could not be made is "offline":
/// nothing was sent. An answer that did not come in time is "slow": the provider may have done
/// what was asked, so whatever is sent again must be something it cannot do twice.
pub fn unreachable(e: reqwest::Error) -> CalError {
    if e.is_connect() {
        CalError::new("offline", "The calendar provider could not be reached.")
    } else if e.is_timeout() {
        CalError::new("slow", "The calendar provider did not answer in time.")
    } else {
        CalError::new("provider", e.to_string())
    }
}

async fn exchange(at: &Endpoints, form: &[(&str, &str)]) -> Result<Value> {
    let mut form: Vec<(&str, &str)> = form.to_vec();
    form.push(("client_id", &at.client_id));
    if let Some(secret) = &at.client_secret {
        form.push(("client_secret", secret));
    }
    let answer = http()
        .post(&at.token)
        .form(&form)
        .send()
        .await
        .map_err(unreachable)?;
    let ok = answer.status().is_success();
    let body: Value = answer.json().await.unwrap_or(Value::Null);
    if !ok {
        let why = body["error_description"]
            .as_str()
            .or(body["error"].as_str())
            .unwrap_or("the provider refused the sign-in");
        return Err(CalError::new("sign_in", format!("Sign-in failed: {why}")));
    }
    Ok(body)
}

fn tokens(body: &Value, old_refresh: Option<&str>) -> Result<Tokens> {
    let access = body["access_token"].as_str().unwrap_or_default();
    let refresh = body["refresh_token"]
        .as_str()
        .or(old_refresh)
        .unwrap_or_default();
    if access.is_empty() {
        return Err(CalError::new(
            "sign_in",
            "Sign-in failed: the provider sent no access.",
        ));
    }
    Ok(Tokens {
        access: access.into(),
        refresh: refresh.into(),
        until: chrono::Utc::now().timestamp() + body["expires_in"].as_i64().unwrap_or(3600),
    })
}

/// A sign-in that works now: renewed when it has run out or `force` says it was refused.
pub async fn fresh(provider: Provider, account: &str, force: bool) -> Result<Tokens> {
    let signed_out = || CalError::new("signed_out", format!("Sign in to {account} again."));
    let had = kept(account).ok_or_else(signed_out)?;
    if !force && had.until - 60 > chrono::Utc::now().timestamp() {
        return Ok(had);
    }
    if had.refresh.is_empty() {
        return Err(signed_out());
    }
    let at = need(provider)?;
    let body = exchange(
        &at,
        &[
            ("grant_type", "refresh_token"),
            ("refresh_token", &had.refresh),
        ],
    )
    .await
    .map_err(|e| if e.waits() { e } else { signed_out() })?;
    let new = tokens(&body, Some(&had.refresh))?;
    keep(account, &new);
    Ok(new)
}

const DONE_PAGE: &str = "<html><body style=\"font:16px system-ui;margin:60px\"><h2>Lokus is connected to your calendar.</h2><p>You can close this tab.</p></body></html>";

fn random() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

/// Open the provider's sign-in in the browser (`show` is given the address) and wait for the
/// person to come back. Returns the sign-in; nothing is kept yet.
pub async fn sign_in(provider: Provider, show: impl FnOnce(&str)) -> Result<Tokens> {
    let at = need(provider)?;
    let io = |e: std::io::Error| CalError::new("sign_in", format!("Sign-in failed: {e}"));
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.map_err(io)?;
    let port = listener.local_addr().map_err(io)?.port();
    // Google documents http://127.0.0.1:port for desktop apps; Microsoft http://localhost,
    // matched whatever the port. A browser may try `localhost` as ::1 first.
    let (host, also) = match provider {
        Provider::Google => ("127.0.0.1", None),
        Provider::Microsoft => ("localhost", TcpListener::bind(("::1", port)).await.ok()),
    };
    let redirect = format!("http://{host}:{port}/callback");
    let (verifier, state) = (random(), random());
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(Sha256::digest(verifier.as_bytes()));
    let mut url =
        url::Url::parse(&at.authorize).map_err(|e| CalError::new("sign_in", e.to_string()))?;
    url.query_pairs_mut()
        .append_pair("client_id", &at.client_id)
        .append_pair("redirect_uri", &redirect)
        .append_pair("response_type", "code")
        .append_pair("scope", at.scopes)
        .append_pair("state", &state)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("access_type", "offline")
        .append_pair(
            "prompt",
            match provider {
                Provider::Google => "consent",
                Provider::Microsoft => "select_account",
            },
        );
    show(url.as_str());

    let came_back = async {
        loop {
            let (mut stream, _) = match &also {
                Some(other) => tokio::select! {
                    got = listener.accept() => got?,
                    got = other.accept() => got?,
                },
                None => listener.accept().await?,
            };
            let mut head = vec![0u8; 8192];
            let n = stream.read(&mut head).await?;
            let request = String::from_utf8_lossy(&head[..n]).into_owned();
            let path = request
                .split_whitespace()
                .nth(1)
                .unwrap_or_default()
                .to_string();
            let found = path.starts_with("/callback?");
            let (status, body) = if found {
                ("200 OK", DONE_PAGE)
            } else {
                ("404 Not Found", "")
            };
            let reply = format!(
                "HTTP/1.1 {status}\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(reply.as_bytes()).await;
            let _ = stream.shutdown().await;
            if found {
                return Ok::<String, std::io::Error>(path);
            }
        }
    };
    let path = tokio::time::timeout(Duration::from_secs(300), came_back)
        .await
        .map_err(|_| CalError::new("sign_in", "Sign-in was not finished in the browser."))?
        .map_err(io)?;
    let back = url::Url::parse(&format!("http://localhost{path}"))
        .map_err(|e| CalError::new("sign_in", e.to_string()))?;
    let get = |name: &str| {
        back.query_pairs()
            .find(|(k, _)| k == name)
            .map(|(_, v)| v.into_owned())
    };
    if get("state").as_deref() != Some(state.as_str()) {
        return Err(CalError::new(
            "sign_in",
            "Sign-in failed: the answer was not for this request.",
        ));
    }
    let Some(code) = get("code") else {
        let why = get("error_description")
            .or(get("error"))
            .unwrap_or_default();
        return Err(CalError::new(
            "sign_in",
            format!("Sign-in was not allowed. {why}"),
        ));
    };
    let body = exchange(
        &at,
        &[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("code_verifier", &verifier),
            ("redirect_uri", &redirect),
        ],
    )
    .await?;
    tokens(&body, None)
}

/// One request to a provider as an account, renewing the sign-in once if it is refused.
pub async fn call(
    provider: Provider,
    account: &str,
    method: reqwest::Method,
    url: &str,
    body: Option<&Value>,
) -> Result<(u16, Value)> {
    let mut force = false;
    loop {
        let tokens = fresh(provider, account, force).await?;
        let mut request = http()
            .request(method.clone(), url)
            .bearer_auth(&tokens.access)
            // Graph: times in UTC, and the whole description as text, not HTML with a short
            // preview beside it.
            .header(
                "prefer",
                "outlook.timezone=\"UTC\", outlook.body-content-type=\"text\"",
            );
        if let Some(body) = body {
            request = request.json(body);
        }
        let answer = request.send().await.map_err(unreachable)?;
        let status = answer.status().as_u16();
        if status == 401 && !force {
            force = true;
            continue;
        }
        let text = answer.text().await.unwrap_or_default();
        let value: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        if status == 410 {
            return Err(CalError::new(
                "gone",
                "the sync position is no longer valid",
            ));
        }
        if status >= 400 {
            let why = value["error"]["message"]
                .as_str()
                .or(value["error"].as_str())
                .unwrap_or("the provider refused the request");
            return Err(CalError::new(
                match status {
                    401 => "signed_out",
                    409 => "conflict",
                    _ => "provider",
                },
                format!("{why} ({status})"),
            ));
        }
        return Ok((status, value));
    }
}
