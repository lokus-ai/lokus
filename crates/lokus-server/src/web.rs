//! @part-of server
//! Web search and page reading for the assistant. The app asks here; the relay asks the search
//! service (Context.dev) with the owner's key, which never leaves this machine, and counts
//! what each account asked today so one person's research cannot spend without limit.

use std::sync::Arc;
use std::time::Duration;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{Error, Result};
use crate::App;

/// How many searches and page reads one account may make in a day unless `LOKUS_WEB_DAILY` says.
const DAILY: i64 = 300;
/// How much of a page is handed back, in characters.
const PAGE_CHARS: usize = 60_000;

pub struct Web {
    key: String,
    /// Context.dev's API, unless a test points it at itself (`LOKUS_WEB_URL`).
    api: String,
    daily: i64,
    http: reqwest::Client,
}

impl Web {
    /// `None` when this relay has no search key (`CONTEXT_DEV_API_KEY`): web search is off.
    pub fn from_env() -> Option<Self> {
        let read = |name: &str| std::env::var(name).ok().filter(|v| !v.trim().is_empty());
        Some(Self {
            key: read("CONTEXT_DEV_API_KEY")?,
            api: read("LOKUS_WEB_URL")
                .unwrap_or_else(|| "https://api.context.dev/v1".into())
                .trim_end_matches('/')
                .to_string(),
            daily: read("LOKUS_WEB_DAILY")
                .and_then(|v| v.parse().ok())
                .unwrap_or(DAILY),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(45))
                .build()
                .unwrap_or_default(),
        })
    }

    pub fn daily(&self) -> i64 {
        self.daily
    }

    /// The one place that speaks Context.dev's interface (read from its API reference on
    /// 2026-11-27: `POST /web/search` and `POST /web/scrape`, a Bearer key).
    async fn ask(&self, path: &str, body: Value) -> Result<Value> {
        let down = || Error::Unavailable("web search is not answering right now".into());
        let response = self
            .http
            .post(format!("{}{path}", self.api))
            .bearer_auth(&self.key)
            .json(&body)
            .send()
            .await
            .map_err(|_| down())?;
        if !response.status().is_success() {
            eprintln!("web: the search service answered {}", response.status());
            return Err(down());
        }
        response.json().await.map_err(|_| down())
    }

    async fn search(&self, query: &str) -> Result<Value> {
        let found = self
            .ask("/web/search", json!({ "query": query, "numResults": 8 }))
            .await?;
        let results: Vec<Value> = found["results"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|r| json!({ "title": r["title"], "url": r["url"], "extract": r["description"] }))
            .collect();
        Ok(json!({ "results": results }))
    }

    async fn read(&self, url: &str) -> Result<Value> {
        let page = self
            .ask(
                "/web/scrape",
                json!({ "url": url, "formats": { "markdown": true } }),
            )
            .await?;
        match page["markdown"]["data"].as_str() {
            Some(text) => Ok(json!({
                "url": page["url"].as_str().unwrap_or(url),
                "text": text.chars().take(PAGE_CHARS).collect::<String>(),
                "cut": text.chars().count() > PAGE_CHARS,
            })),
            None => Err(Error::Unavailable("that page could not be read".into())),
        }
    }
}

#[derive(Deserialize)]
pub(crate) struct Ask {
    #[serde(default)]
    query: String,
    #[serde(default)]
    url: String,
}

/// Anyone signed in may ask, up to the day's ceiling for their account.
async fn allowed<'a>(app: &'a App, headers: &HeaderMap) -> Result<&'a Web> {
    let me = app.caller(headers).await?;
    let web = app
        .web
        .as_ref()
        .ok_or_else(|| Error::Unavailable("web search is not set up on this server".into()))?;
    if !app.store.count_web(&me.user, web.daily)? {
        return Err(Error::Limit(format!(
            "today's limit of {} web searches for this account is used up; it starts again tomorrow",
            web.daily
        )));
    }
    Ok(web)
}

pub(crate) async fn search(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Json(body): Json<Ask>,
) -> Result<Json<Value>> {
    let query = body.query.trim();
    if query.is_empty() || query.chars().count() > 400 {
        return Err(Error::BadRequest(
            "a search needs a query of up to 400 characters".into(),
        ));
    }
    Ok(Json(allowed(&app, &headers).await?.search(query).await?))
}

pub(crate) async fn read(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Json(body): Json<Ask>,
) -> Result<Json<Value>> {
    let url = body.url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) || url.len() > 2000 {
        return Err(Error::BadRequest(
            "a page to read needs an http or https link".into(),
        ));
    }
    Ok(Json(allowed(&app, &headers).await?.read(url).await?))
}
