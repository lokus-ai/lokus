//! @part-of server
//! Who is calling. Production checks Supabase login tokens against the
//! project's public keys; development uses fixed tokens from the environment.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use jsonwebtoken::jwk::JwkSet;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

use crate::error::{Error, Result};

#[derive(Debug, Clone)]
pub struct Identity {
    pub user: String,
    pub email: Option<String>,
}

pub enum Auth {
    /// `token -> identity`, from `LOKUS_DEV_TOKENS=token:user:email,...`.
    Dev(HashMap<String, Identity>),
    Supabase { jwks_url: String, keys: Mutex<Option<(Instant, JwkSet)>> },
}

#[derive(Deserialize)]
struct Claims {
    sub: String,
    email: Option<String>,
}

const KEY_LIFETIME: Duration = Duration::from_secs(600);

impl Auth {
    pub fn from_env() -> std::result::Result<Self, String> {
        if let Ok(url) = std::env::var("SUPABASE_URL") {
            let jwks_url = format!("{}/auth/v1/.well-known/jwks.json", url.trim_end_matches('/'));
            return Ok(Self::Supabase { jwks_url, keys: Mutex::new(None) });
        }
        let raw = std::env::var("LOKUS_DEV_TOKENS")
            .map_err(|_| "set SUPABASE_URL, or LOKUS_DEV_TOKENS=token:user:email for local use".to_string())?;
        Ok(Self::dev(&raw))
    }

    pub fn dev(raw: &str) -> Self {
        let mut map = HashMap::new();
        for entry in raw.split(',').filter(|e| !e.trim().is_empty()) {
            let mut parts = entry.trim().splitn(3, ':');
            if let (Some(token), Some(user)) = (parts.next(), parts.next()) {
                let email = parts.next().map(str::to_string);
                map.insert(token.to_string(), Identity { user: user.to_string(), email });
            }
        }
        Self::Dev(map)
    }

    pub async fn identify(&self, token: &str) -> Result<Identity> {
        match self {
            Self::Dev(map) => map.get(token).cloned().ok_or(Error::Unauthorized),
            Self::Supabase { jwks_url, keys } => {
                let header = decode_header(token).map_err(|_| Error::Unauthorized)?;
                let kid = header.kid.ok_or(Error::Unauthorized)?;
                let mut set = cached(keys);
                // Unknown key id: the project may have rotated keys, so look again.
                if set.as_ref().and_then(|s| s.find(&kid)).is_none() {
                    let fresh: JwkSet = reqwest::get(jwks_url)
                        .await
                        .map_err(|e| Error::Internal(e.to_string()))?
                        .json()
                        .await
                        .map_err(|e| Error::Internal(e.to_string()))?;
                    if let Ok(mut slot) = keys.lock() {
                        *slot = Some((Instant::now(), fresh.clone()));
                    }
                    set = Some(fresh);
                }
                let jwk = set.as_ref().and_then(|s| s.find(&kid)).ok_or(Error::Unauthorized)?;
                let key = DecodingKey::from_jwk(jwk).map_err(|_| Error::Unauthorized)?;
                let mut rules = Validation::new(match header.alg {
                    Algorithm::RS256 => Algorithm::RS256,
                    _ => Algorithm::ES256,
                });
                rules.set_audience(&["authenticated"]);
                let claims = decode::<Claims>(token, &key, &rules).map_err(|_| Error::Unauthorized)?.claims;
                Ok(Identity { user: claims.sub, email: claims.email })
            }
        }
    }
}

fn cached(keys: &Mutex<Option<(Instant, JwkSet)>>) -> Option<JwkSet> {
    let slot = keys.lock().ok()?;
    let (at, set) = slot.as_ref()?;
    (at.elapsed() < KEY_LIFETIME).then(|| set.clone())
}
