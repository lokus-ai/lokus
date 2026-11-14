//! @part-of server
//! Who is calling. Production checks Supabase login tokens: against the
//! project's public keys, or, for a project that still signs with a shared
//! secret, against `SUPABASE_JWT_SECRET`. Development uses fixed tokens from
//! the environment.

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
    /// When this sign-in runs out, in seconds since 1970. Development tokens never do.
    pub expires: Option<i64>,
}

pub enum Auth {
    /// `token -> identity`, from `LOKUS_DEV_TOKENS=token:user:email,...`.
    Dev(HashMap<String, Identity>),
    Supabase {
        jwks_url: String,
        keys: Mutex<Option<(Instant, JwkSet)>>,
        /// For projects whose tokens are signed with a shared secret (HS256).
        secret: Option<String>,
    },
}

#[derive(Deserialize)]
struct Claims {
    sub: String,
    email: Option<String>,
    exp: Option<i64>,
}

const KEY_LIFETIME: Duration = Duration::from_secs(600);

impl Auth {
    pub fn from_env() -> std::result::Result<Self, String> {
        if let Ok(url) = std::env::var("SUPABASE_URL") {
            let secret = std::env::var("SUPABASE_JWT_SECRET")
                .ok()
                .filter(|s| !s.is_empty());
            return Ok(Self::supabase(&url, secret));
        }
        let raw = std::env::var("LOKUS_DEV_TOKENS").map_err(|_| {
            "set SUPABASE_URL, or LOKUS_DEV_TOKENS=token:user:email for local use".to_string()
        })?;
        Ok(Self::dev(&raw))
    }

    pub fn supabase(url: &str, secret: Option<String>) -> Self {
        Self::Supabase {
            jwks_url: format!(
                "{}/auth/v1/.well-known/jwks.json",
                url.trim_end_matches('/')
            ),
            keys: Mutex::new(None),
            secret,
        }
    }

    /// Say at start-up if real logins cannot work with this configuration.
    pub async fn warn_if_unusable(&self) {
        let Self::Supabase {
            jwks_url, secret, ..
        } = self
        else {
            return;
        };
        let published = match reqwest::get(jwks_url).await {
            Ok(response) => response.json::<JwkSet>().await.map(|set| set.keys.len()),
            Err(e) => {
                eprintln!("warning: could not reach {jwks_url}: {e}");
                return;
            }
        };
        if matches!(published, Ok(0) | Err(_)) && secret.is_none() {
            eprintln!(
                "warning: this Supabase project publishes no signing keys, so it signs logins \
                 with a shared secret. Set SUPABASE_JWT_SECRET (Project Settings, API, JWT \
                 secret) or every login will be refused."
            );
        }
    }

    pub fn dev(raw: &str) -> Self {
        let mut map = HashMap::new();
        for entry in raw.split(',').filter(|e| !e.trim().is_empty()) {
            let mut parts = entry.trim().splitn(3, ':');
            if let (Some(token), Some(user)) = (parts.next(), parts.next()) {
                let email = parts.next().map(str::to_string);
                map.insert(
                    token.to_string(),
                    Identity {
                        user: user.to_string(),
                        email,
                        expires: None,
                    },
                );
            }
        }
        Self::Dev(map)
    }

    pub async fn identify(&self, token: &str) -> Result<Identity> {
        match self {
            Self::Dev(map) => map.get(token).cloned().ok_or(Error::Unauthorized),
            Self::Supabase {
                jwks_url,
                keys,
                secret,
            } => {
                let header = decode_header(token).map_err(|_| Error::Unauthorized)?;
                if header.alg == Algorithm::HS256 {
                    let secret = secret.as_deref().ok_or(Error::Unauthorized)?;
                    let mut rules = Validation::new(Algorithm::HS256);
                    rules.set_audience(&["authenticated"]);
                    let key = DecodingKey::from_secret(secret.as_bytes());
                    let claims = decode::<Claims>(token, &key, &rules)
                        .map_err(|_| Error::Unauthorized)?
                        .claims;
                    return Ok(Identity {
                        user: claims.sub,
                        email: claims.email,
                        expires: claims.exp,
                    });
                }
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
                let jwk = set
                    .as_ref()
                    .and_then(|s| s.find(&kid))
                    .ok_or(Error::Unauthorized)?;
                let key = DecodingKey::from_jwk(jwk).map_err(|_| Error::Unauthorized)?;
                let mut rules = Validation::new(match header.alg {
                    Algorithm::RS256 => Algorithm::RS256,
                    _ => Algorithm::ES256,
                });
                rules.set_audience(&["authenticated"]);
                let claims = decode::<Claims>(token, &key, &rules)
                    .map_err(|_| Error::Unauthorized)?
                    .claims;
                Ok(Identity {
                    user: claims.sub,
                    email: claims.email,
                    expires: claims.exp,
                })
            }
        }
    }
}

fn cached(keys: &Mutex<Option<(Instant, JwkSet)>>) -> Option<JwkSet> {
    let slot = keys.lock().ok()?;
    let (at, set) = slot.as_ref()?;
    (at.elapsed() < KEY_LIFETIME).then(|| set.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde_json::json;

    fn token(secret: &str, audience: &str) -> String {
        let far = 4_000_000_000u64;
        let claims = json!({ "sub": "user-1", "email": "a@x.io", "aud": audience, "exp": far });
        encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .unwrap()
    }

    #[tokio::test]
    async fn shared_secret_logins_are_checked_against_the_secret() {
        let auth = Auth::supabase("http://127.0.0.1:1", Some("right".into()));
        let me = auth
            .identify(&token("right", "authenticated"))
            .await
            .unwrap();
        assert_eq!(me.user, "user-1");
        assert!(auth
            .identify(&token("wrong", "authenticated"))
            .await
            .is_err());
        assert!(auth.identify(&token("right", "anon")).await.is_err());
        // Without the secret configured, such a token is never accepted.
        let none = Auth::supabase("http://127.0.0.1:1", None);
        assert!(none
            .identify(&token("right", "authenticated"))
            .await
            .is_err());
    }
}
