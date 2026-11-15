//! @part-of cli
//! Publishing the app itself: releases people update to, and the news they read.
//!
//!   lokus release version=2.0.1 server=URL darwin-aarch64=URL [windows-x86_64=URL ...]
//!   lokus release.pull version=2.0.1 server=URL
//!   lokus release.list server=URL
//!   lokus news file=news/2.0.1.md server=URL
//!   lokus news.remove id=2-0-1 server=URL
//!
//! The publish key is read from `LOKUS_PUBLISH_KEY`, never from the command line.
//!
//! A release is refused unless every build can be downloaded from the address given and carries
//! a signature made with our key, and unless it covers every platform the release before it
//! covered. Lokus 1 shipped a release with no Mac build in it and nobody noticed; that is the
//! mistake these two checks exist to make impossible.

use base64::Engine as _;
use minisign_verify::{PublicKey, Signature};
use serde_json::{json, Map, Value};

type Outcome = Result<Value, Value>;

fn fail(code: &str, message: impl Into<String>) -> Value {
    json!({ "code": code, "message": message.into() })
}

fn text<'a>(args: &'a Value, name: &str) -> Result<&'a str, Value> {
    args[name]
        .as_str()
        .filter(|v| !v.is_empty())
        .ok_or_else(|| fail("usage", format!("{name}= is needed")))
}

fn key() -> Result<String, Value> {
    std::env::var("LOKUS_PUBLISH_KEY")
        .ok()
        .filter(|k| !k.is_empty())
        .ok_or_else(|| fail("no_key", "set LOKUS_PUBLISH_KEY to the relay's publish key"))
}

async fn call(server: &str, key: &str, method: &str, path: &str, body: Option<Value>) -> Outcome {
    lokus_sync::api::call(server, key, method, path, body)
        .await
        .map_err(|e| fail("relay", e.to_string()))
}

fn unwrap64(what: &str, text: &str) -> Result<String, Value> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(text.trim())
        .map_err(|_| {
            fail(
                "bad_signature",
                format!("{what} is not what the Tauri signer writes"),
            )
        })?;
    String::from_utf8(bytes)
        .map_err(|_| fail("bad_signature", format!("{what} is not text inside")))
}

/// The key every installed copy trusts: the one in the app's own configuration.
fn public_key(args: &Value) -> Result<PublicKey, Value> {
    let conf = args["conf"]
        .as_str()
        .unwrap_or("apps/desktop/tauri.conf.json");
    let read = std::fs::read_to_string(conf).map_err(|e| {
        fail(
            "no_conf",
            format!("{conf}: {e} (run from the repo, or pass conf=)"),
        )
    })?;
    let parsed: Value =
        serde_json::from_str(&read).map_err(|e| fail("no_conf", format!("{conf}: {e}")))?;
    let packed = parsed["plugins"]["updater"]["pubkey"]
        .as_str()
        .ok_or_else(|| fail("no_conf", format!("{conf} has no plugins.updater.pubkey")))?;
    PublicKey::decode(&unwrap64("the public key", packed)?)
        .map_err(|e| fail("no_conf", format!("the public key in {conf}: {e}")))
}

async fn fetch(url: &str) -> Result<Vec<u8>, Value> {
    let got = reqwest::get(url)
        .await
        .map_err(|e| fail("unreachable", format!("{url}: {e}")))?;
    if !got.status().is_success() {
        return Err(fail(
            "unreachable",
            format!("{url} answered {}", got.status()),
        ));
    }
    Ok(got
        .bytes()
        .await
        .map_err(|e| fail("unreachable", format!("{url}: {e}")))?
        .to_vec())
}

/// Download a build and its `.sig`, exactly as an installed copy would, and check the two agree.
/// The app accepts an update only if its signature says which version it was signed for, and
/// that is the version being offered. A file signed without one would be published, offered,
/// downloaded and then refused by every copy: found the night before the first release.
fn names_version(signature_text: &str, version: &str) -> bool {
    signature_text
        .lines()
        .find_map(|line| line.strip_prefix("trusted comment:"))
        .is_some_and(|comment| {
            comment
                .split('\t')
                .any(|part| part.trim() == format!("version:{version}"))
        })
}

async fn checked(pubkey: &PublicKey, url: &str, version: &str) -> Result<(String, usize), Value> {
    let build = fetch(url).await?;
    let packed = String::from_utf8(fetch(&format!("{url}.sig")).await?)
        .map_err(|_| fail("bad_signature", format!("{url}.sig is not text")))?;
    let text = unwrap64(&format!("{url}.sig"), &packed)?;
    if !names_version(&text, version) {
        return Err(fail(
            "bad_signature",
            format!("{url}.sig does not say it was signed for version {version}; an installed copy would refuse it. Sign it again with `tauri signer sign --app-version {version}`."),
        ));
    }
    let signature =
        Signature::decode(&text).map_err(|e| fail("bad_signature", format!("{url}.sig: {e}")))?;
    pubkey.verify(&build, &signature, true).map_err(|_| {
        fail(
            "bad_signature",
            format!("{url} was not signed with our key; an installed copy would refuse it"),
        )
    })?;
    Ok((packed.trim().to_string(), build.len()))
}

pub async fn release(args: &Value) -> Outcome {
    let (version, server, key) = (text(args, "version")?, text(args, "server")?, key()?);
    let builds: Vec<(&String, &str)> = args
        .as_object()
        .into_iter()
        .flatten()
        .filter(|(name, _)| name.contains('-'))
        .filter_map(|(name, url)| url.as_str().map(|u| (name, u)))
        .collect();
    if builds.is_empty() {
        return Err(fail(
            "usage",
            "name at least one build, like darwin-aarch64=https://…/Lokus.app.tar.gz",
        ));
    }

    // What the newest release already out covers; this one must not quietly cover less.
    let out = call(server, &key, "GET", "/v1/app/releases", None).await?;
    let before = out
        .as_array()
        .into_iter()
        .flatten()
        .filter(|r| r["pulled"] != true && r["version"] != version)
        .filter_map(|r| {
            Some((
                semver::Version::parse(r["version"].as_str()?).ok()?,
                r["platform"].as_str()?.to_string(),
            ))
        })
        .collect::<Vec<_>>();
    if let Some(newest) = before.iter().map(|(v, _)| v).max().cloned() {
        let missing: Vec<&str> = before
            .iter()
            .filter(|(v, p)| *v == newest && !builds.iter().any(|(name, _)| *name == p))
            .map(|(_, p)| p.as_str())
            .collect();
        if !missing.is_empty() && args["partial"] != true {
            return Err(fail(
                "platform_dropped",
                format!(
                    "{newest} was published for {}, and this release has no build for it. People on that platform would be left behind. Add the build, or pass partial=true if that is meant.",
                    missing.join(", ")
                ),
            ));
        }
    }

    let pubkey = public_key(args)?;
    let mut platforms = Map::new();
    let mut report = Vec::new();
    for (platform, url) in builds {
        let (signature, size) = checked(&pubkey, url, version).await?;
        report.push(json!({ "platform": platform, "url": url, "megabytes": (size as f64 / 104_857.6).round() / 10.0, "signature": "ok" }));
        platforms.insert(
            platform.clone(),
            json!({ "url": url, "signature": signature }),
        );
    }
    call(
        server,
        &key,
        "POST",
        &format!("/v1/app/releases/{version}"),
        Some(json!({ "platforms": platforms })),
    )
    .await?;
    Ok(json!({ "published": version, "builds": report }))
}

pub async fn pull(args: &Value) -> Outcome {
    let (version, server, key) = (text(args, "version")?, text(args, "server")?, key()?);
    call(
        server,
        &key,
        "DELETE",
        &format!("/v1/app/releases/{version}"),
        None,
    )
    .await
}

pub async fn list(args: &Value) -> Outcome {
    call(text(args, "server")?, "", "GET", "/v1/app/releases", None).await
}

/// A post is a markdown file: properties on top (title, version, video, show…), the text below.
/// Its file name is its id, so publishing the same file again corrects the post already out.
pub async fn news(args: &Value) -> Outcome {
    let (file, server, key) = (text(args, "file")?, text(args, "server")?, key()?);
    let read =
        std::fs::read_to_string(file).map_err(|e| fail("no_file", format!("{file}: {e}")))?;
    let id: String = std::path::Path::new(file)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let mut post = lokus_core::frontmatter::read(&read);
    // A version written bare in a file (`version: 2.1`) reads as a number; a post wants its text.
    for (_, value) in post.iter_mut() {
        if value.is_number() || value.is_boolean() {
            *value = Value::String(value.to_string());
        }
    }
    post.insert(
        "body".into(),
        json!(read[lokus_core::frontmatter::body_start(&read)..].trim()),
    );
    call(
        server,
        &key,
        "POST",
        &format!("/v1/app/news/{}", id.trim_matches('-')),
        Some(Value::Object(post)),
    )
    .await
}

pub async fn unpost(args: &Value) -> Outcome {
    let (id, server, key) = (text(args, "id")?, text(args, "server")?, key()?);
    call(server, &key, "DELETE", &format!("/v1/app/news/{id}"), None).await
}

#[cfg(test)]
mod tests {
    use super::names_version;

    #[test]
    fn a_signature_must_say_which_version_it_is_for() {
        let signed = "untrusted comment: signature from tauri secret key\nRWS...\ntrusted comment: timestamp:1794646978\tfile:Lokus_aarch64.app.tar.gz\tversion:2.0.0-alpha.1\nabc==\n";
        assert!(names_version(signed, "2.0.0-alpha.1"));
        assert!(!names_version(signed, "2.0.0-alpha.10"));
        assert!(!names_version(
            "trusted comment: timestamp:1\tfile:Lokus.app.tar.gz\n",
            "2.0.0-alpha.1"
        ));
    }
}
