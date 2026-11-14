//! @part-of server
//! What every copy of the app asks the relay, signed in or not: is there a newer version for
//! this computer, and what is new.
//!
//! Lokus 1 answered the first question with one file listing every platform, written by
//! whichever build jobs happened to finish. When the Mac job failed the file simply had no Mac
//! in it, and Mac users were never offered an update again. Here each platform is its own row:
//! a computer is offered a version only if a build for that exact platform was published, and
//! a bad release can be pulled back in one call.
//!
//! Publishing needs the relay's publish key (`LOKUS_PUBLISH_KEY`). Without one set, nothing
//! can be published. The app trusts a download because of its signature, never because of
//! where it came from, so this relay cannot make an app install something we did not sign.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use semver::Version;
use serde::Deserialize;
use serde_json::{json, Map, Value};

use crate::error::{Error, Result};
use crate::store::now;
use crate::App;

/// The most a whole post or release may weigh.
pub const MAX_BODY: usize = 64 * 1024;
/// How many posts the app is handed: the newest ones.
const POSTS: i64 = 50;

const TARGETS: [&str; 3] = ["darwin", "linux", "windows"];
const ARCHES: [&str; 4] = ["aarch64", "x86_64", "i686", "armv7"];

fn publisher(app: &App, headers: &HeaderMap) -> Result<()> {
    let wanted = app.publish_key.as_deref().ok_or(Error::Forbidden)?;
    let given = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(Error::Unauthorized)?;
    // Compared by hash, so how long the comparison takes says nothing about the key.
    if blake3::hash(given.as_bytes()) == blake3::hash(wanted.as_bytes()) {
        Ok(())
    } else {
        Err(Error::Forbidden)
    }
}

fn version(text: &str) -> Result<Version> {
    Version::parse(text.trim_start_matches('v'))
        .map_err(|_| Error::BadRequest(format!("“{text}” is not a version like 2.1.0")))
}

/// An address the app may be sent to: https, or this computer while testing.
fn address(text: &str, what: &str) -> Result<String> {
    let ok = text.len() <= 2000
        && !text.chars().any(|c| c.is_control() || c.is_whitespace())
        && (text.starts_with("https://")
            || text.starts_with("http://127.0.0.1:")
            || text.starts_with("http://localhost:"));
    if ok {
        Ok(text.to_string())
    } else {
        Err(Error::BadRequest(format!("{what} must be an https address")))
    }
}

/// The app's question. 204 means "you have the newest there is for your computer".
pub async fn update(
    State(app): State<Arc<App>>,
    Path((target, arch, current)): Path<(String, String, String)>,
) -> Result<Response> {
    let current = version(&current)?;
    let platform = format!("{target}-{arch}");
    let newest = app
        .store
        .releases()?
        .into_iter()
        .filter(|r| !r.pulled && r.platform == platform)
        .filter_map(|r| Version::parse(&r.version).ok().map(|v| (v, r)))
        // Someone on a finished version is never moved onto a test version; someone already
        // on a test version gets whatever is newest.
        .filter(|(v, _)| *v > current && (v.pre.is_empty() || !current.pre.is_empty()))
        .max_by(|a, b| a.0.cmp(&b.0));
    let Some((found, release)) = newest else {
        return Ok(StatusCode::NO_CONTENT.into_response());
    };
    let found = found.to_string();
    let notes = app
        .store
        .news(POSTS)?
        .into_iter()
        .filter_map(|body| serde_json::from_str::<Value>(&body).ok())
        .find(|post| post["version"] == found.as_str())
        .map(|post| {
            let title = post["title"].as_str().unwrap_or_default();
            match post["summary"].as_str().filter(|s| !s.is_empty()) {
                Some(summary) => format!("{title}\n\n{summary}"),
                None => title.to_string(),
            }
        })
        .unwrap_or_default();
    Ok(Json(json!({
        "version": found,
        "url": release.url,
        "signature": release.signature,
        "notes": notes,
    }))
    .into_response())
}

/// Every published build, newest version first. Nothing in it is secret: the download page
/// and the release tool both read it.
pub async fn list(State(app): State<Arc<App>>) -> Result<Json<Value>> {
    let mut all = app.store.releases()?;
    all.sort_by(|a, b| {
        let key = |v: &str| Version::parse(v).ok();
        key(&b.version).cmp(&key(&a.version)).then(a.platform.cmp(&b.platform))
    });
    Ok(Json(json!(all)))
}

#[derive(Deserialize)]
pub struct NewRelease {
    /// By platform ("darwin-aarch64"): where the update file is, and its signature.
    platforms: Map<String, Value>,
}

/// Publish builds of one version. Platforms not named are left as they were, so a platform
/// whose build finished late can be added without touching the others.
pub async fn publish(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(v): Path<String>,
    Json(body): Json<NewRelease>,
) -> Result<Json<Value>> {
    publisher(&app, &headers)?;
    let v = version(&v)?.to_string();
    if body.platforms.is_empty() {
        return Err(Error::BadRequest("name at least one platform".into()));
    }
    let mut builds = Vec::new();
    for (platform, build) in &body.platforms {
        let known = platform
            .split_once('-')
            .is_some_and(|(t, a)| TARGETS.contains(&t) && ARCHES.contains(&a));
        if !known {
            return Err(Error::BadRequest(format!(
                "“{platform}” is not a platform like darwin-aarch64"
            )));
        }
        let url = address(build["url"].as_str().unwrap_or_default(), "a build's url")?;
        let signature = build["signature"].as_str().unwrap_or_default().trim();
        if signature.is_empty() || signature.len() > 4000 {
            return Err(Error::BadRequest(format!(
                "{platform} has no signature; an unsigned build cannot be installed"
            )));
        }
        builds.push((platform.clone(), url, signature.to_string()));
    }
    for (platform, url, signature) in &builds {
        app.store.put_release(&v, platform, url, signature)?;
    }
    eprintln!("published {v} for {}", builds.iter().map(|b| b.0.as_str()).collect::<Vec<_>>().join(", "));
    Ok(Json(json!({ "version": v, "platforms": builds.iter().map(|b| &b.0).collect::<Vec<_>>() })))
}

/// Take a version back: nobody is offered it from now on. Copies already installed stay.
pub async fn pull(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(v): Path<String>,
) -> Result<Json<Value>> {
    publisher(&app, &headers)?;
    let v = version(&v)?.to_string();
    if app.store.pull_release(&v)? == 0 {
        return Err(Error::NotFound("release"));
    }
    eprintln!("pulled {v}");
    Ok(Json(json!({ "pulled": v })))
}

/// What is new, newest first: release notes and announcements alike.
pub async fn news(State(app): State<Arc<App>>) -> Result<Json<Value>> {
    let posts: Vec<Value> = app
        .store
        .news(POSTS)?
        .into_iter()
        .filter_map(|body| serde_json::from_str(&body).ok())
        .collect();
    Ok(Json(json!({ "posts": posts })))
}

/// Publish a post, or change one already out. Every running app picks it up by itself.
pub async fn post(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>> {
    publisher(&app, &headers)?;
    let named = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if !named {
        return Err(Error::BadRequest(
            "a post's id is lowercase letters, digits and dashes".into(),
        ));
    }
    let text = |key: &str, most: usize| -> Result<String> {
        let value = body[key].as_str().unwrap_or_default().trim().to_string();
        if value.chars().count() > most {
            return Err(Error::BadRequest(format!("{key} is limited to {most} characters")));
        }
        Ok(value)
    };
    let link = |key: &str| -> Result<String> {
        match body[key].as_str().map(str::trim).filter(|s| !s.is_empty()) {
            Some(value) => address(value, key),
            None => Ok(String::new()),
        }
    };
    let title = text("title", 120)?;
    if title.is_empty() {
        return Err(Error::BadRequest("a post needs a title".into()));
    }
    let show = match body["show"].as_str().unwrap_or("quiet") {
        "popup" => "popup",
        "quiet" => "quiet",
        _ => return Err(Error::BadRequest("show is popup or quiet".into())),
    };
    let for_version = match body["version"].as_str().map(str::trim).filter(|s| !s.is_empty()) {
        Some(v) => version(v)?.to_string(),
        None => String::new(),
    };
    // A post keeps the day it first went out, so correcting a typo does not move it to the top.
    let at = match body["at"].as_i64() {
        Some(at) => at,
        None => app.store.news_at(&id)?.unwrap_or_else(now),
    };
    let post = json!({
        "id": id,
        "title": title,
        "summary": text("summary", 300)?,
        "body": text("body", 20_000)?,
        "version": for_version,
        "video": link("video")?,
        "image": link("image")?,
        "link": link("link")?,
        "link_label": text("link_label", 40)?,
        "show": show,
        "at": at,
    });
    app.store.put_news(&id, &post.to_string(), at)?;
    eprintln!("posted {id}");
    Ok(Json(post))
}

pub async fn unpost(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    publisher(&app, &headers)?;
    if app.store.drop_news(&id)? == 0 {
        return Err(Error::NotFound("post"));
    }
    Ok(Json(json!({ "removed": id })))
}
