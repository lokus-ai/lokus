//! @part-of server
//! Bringing someone into a workspace. An owner names a person by their email address and the
//! relay writes to them; the person signs in to Lokus with that address and finds the
//! invitation waiting. Nothing is copied or pasted.
//!
//! An invite can still be handed over as a link instead, for a relay that sends no email or
//! for a person who signs in under another address: whoever holds the code may use it once.
//!
//! "Waiting for you" trusts the address in the sign-in. That is only as good as the account
//! service's promise that people own the addresses they sign in with, so email confirmation
//! must stay on there.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::{header, HeaderMap};
use axum::response::{Html, IntoResponse, Response};
use axum::Json;
use semver::Version;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{Error, Result};
use crate::mail::{self, escape};
use crate::store::{now, Invitation, Role};
use crate::App;

/// How long an invite can be used for.
const INVITE_LIFE: i64 = 7 * 24 * 60 * 60;

#[derive(Deserialize)]
pub struct NewInvite {
    role: String,
    /// Who to write to. Left out: the invite is a link the owner passes on themselves.
    email: Option<String>,
    /// The name the owner goes by, for the email's first line.
    name: Option<String>,
}

/// What the owner is told about an invite just made or sent again.
fn made(app: &App, invitation: &Invitation, sent: Option<bool>) -> Value {
    json!({
        "code": invitation.code,
        "role": invitation.role.name(),
        "expires_at": invitation.expires_at,
        "email": invitation.email,
        "link": app.mailer.as_ref().map(|m| m.link(&invitation.code)),
        "sent": sent,
    })
}

/// Email an invitation and note that it went. `false` when the email could not be handed over;
/// the invite itself stays good either way.
async fn send(app: &App, invitation: &Invitation, by: &str) -> Result<bool> {
    let mailer = app.mailer.as_ref().ok_or_else(no_mail)?;
    if app.store.sent_today(by)? >= mail::DAILY {
        return Err(Error::BadRequest(format!(
            "that is {} invitations in a day, which is the most one account can send; try again tomorrow",
            mail::DAILY
        )));
    }
    match mailer.invite(invitation).await {
        Ok(()) => {
            app.store.invite_sent(&invitation.code)?;
            Ok(true)
        }
        Err(e) => {
            eprintln!("invitation email not sent: {e}");
            Ok(false)
        }
    }
}

fn no_mail() -> Error {
    Error::BadRequest("this server does not send email; make an invite link instead".into())
}

pub async fn create(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<NewInvite>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    let role = match Role::parse(&body.role) {
        Some(Role::Editor) => Role::Editor,
        Some(Role::Viewer) => Role::Viewer,
        _ => {
            return Err(Error::BadRequest(
                "an invite is for an editor or a viewer".into(),
            ))
        }
    };
    let email =
        match body
            .email
            .as_deref()
            .map(str::trim)
            .filter(|e| !e.is_empty())
        {
            Some(typed) => {
                if app.mailer.is_none() {
                    return Err(no_mail());
                }
                Some(mail::address(typed).ok_or_else(|| {
                    Error::BadRequest(format!("“{typed}” is not an email address"))
                })?)
            }
            None => None,
        };
    let name = body.name.as_deref().and_then(mail::name);
    let code = uuid::Uuid::new_v4().simple().to_string();
    app.store.create_invite(
        &code,
        &id,
        role,
        &me.user,
        now() + INVITE_LIFE,
        email.as_deref(),
        name.as_deref(),
    )?;
    let invitation = app
        .store
        .invitation(&code)?
        .ok_or(Error::NotFound("invite"))?;
    let sent = match email {
        Some(_) => Some(send(&app, &invitation, &me.user).await?),
        None => None,
    };
    Ok(Json(made(&app, &invitation, sent)))
}

/// Email an invitation again, to someone who lost the first or never got it.
pub async fn resend(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path((id, code)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    let invitation = app
        .store
        .invitation(&code)?
        .filter(|i| i.workspace == id && i.email.is_some())
        .ok_or(Error::NotFound("invite"))?;
    if invitation
        .sent_at
        .is_some_and(|at| now() - at < mail::AGAIN)
    {
        return Err(Error::BadRequest(
            "that was sent a moment ago; give it a minute to arrive".into(),
        ));
    }
    let sent = send(&app, &invitation, &me.user).await?;
    Ok(Json(made(&app, &invitation, Some(sent))))
}

pub async fn list(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    Ok(Json(json!(app.store.invites(&id)?)))
}

pub async fn revoke(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path((id, code)): Path<(String, String)>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    app.require_owner(&id, &me.user)?;
    app.store.revoke_invite(&id, &code, &me.user)?;
    Ok(Json(json!({ "cancelled": true })))
}

/// The invitations waiting for the person signed in, found by their address.
pub async fn mine(State(app): State<Arc<App>>, headers: HeaderMap) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    let waiting = match me.email.as_deref() {
        Some(email) => app.store.invitations_for(email, &me.user)?,
        None => Vec::new(),
    };
    Ok(Json(json!(waiting)))
}

pub async fn accept(
    State(app): State<Arc<App>>,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> Result<Json<Value>> {
    let me = app.caller(&headers).await?;
    let workspace = app
        .store
        .accept_invite(&code, &me.user, me.email.as_deref())?;
    Ok(Json(json!({ "workspace": workspace })))
}

/// The newest build's installers, by the kind of Mac: found beside the update files, which
/// `deploy/release/mac.sh` names `Lokus_<arch>.app.tar.gz` next to `Lokus_<version>_<arch>.dmg`.
fn installers(app: &App) -> Vec<(&'static str, String)> {
    let Ok(all) = app.store.releases() else {
        return Vec::new();
    };
    let newest = all
        .iter()
        .filter(|r| !r.pulled)
        .filter_map(|r| Version::parse(&r.version).ok())
        .max();
    let Some(newest) = newest.map(|v| v.to_string()) else {
        return Vec::new();
    };
    [
        ("darwin-aarch64", "aarch64", "Mac with an Apple chip"),
        ("darwin-x86_64", "x86_64", "Mac with an Intel chip"),
    ]
    .into_iter()
    .filter_map(|(platform, arch, label)| {
        let build = all
            .iter()
            .find(|r| !r.pulled && r.version == newest && r.platform == platform)?;
        let folder = build
            .url
            .strip_suffix(&format!("Lokus_{arch}.app.tar.gz"))?;
        Some((label, format!("{folder}Lokus_{newest}_{arch}.dmg")))
    })
    .collect()
}

/// The page an invitation's link opens, in a browser, signed in to nothing.
pub async fn page(State(app): State<Arc<App>>, Path(code): Path<String>) -> Result<Response> {
    let found = app.store.invitation(&code)?;
    let (title, body) = match &found {
        None => (
            "This invitation can no longer be used".to_string(),
            "<h1>This invitation can no longer be used</h1>\
             <p class=\"gone\">It was already used, it was cancelled, or it is more than a week old. \
             Ask the person who invited you to send a new one.</p>"
                .to_string(),
        ),
        Some(invitation) => {
            let who = mail::sender(invitation);
            let title = format!("{who} invited you to {}", invitation.name);
            let initial = invitation
                .name
                .chars()
                .find(|c| c.is_alphanumeric())
                .map(|c| c.to_uppercase().to_string())
                .unwrap_or_else(|| "L".into());
            let get: String = installers(&app)
                .iter()
                .enumerate()
                .map(|(i, (label, url))| {
                    format!(
                        "<a class=\"button{}\" href=\"{}\">{label}</a>",
                        if i == 0 { "" } else { " second" },
                        escape(url)
                    )
                })
                .collect();
            let get = if get.is_empty() {
                "<a class=\"button\" href=\"https://github.com/lokus-ai/lokus#get-it\">Get Lokus</a>".to_string()
            } else {
                get
            };
            let sign_in = match &invitation.email {
                Some(to) => format!(
                    "<b>Sign in as <span class=\"to\">{}</span></b><p>Lokus asks you to sign in when it first opens. Use this address, since it is the one that was invited.</p>",
                    escape(to)
                ),
                None => "<b>Sign in</b><p>Lokus asks you to sign in when it first opens.</p>".to_string(),
            };
            let (join, other) = match &invitation.email {
                Some(_) => (
                    "<b>Click Join</b><p>Your invitation is waiting inside. Nothing to copy.</p>",
                    "Signing in with a different address? Open Settings, then Team, and paste this code instead.",
                ),
                None => (
                    "<b>Paste your code</b><p>Open Settings, then Team, and paste the code below under “Join with an invite”.</p>",
                    "Your invite code. It works once.",
                ),
            };
            let body = format!(
                "<h1>{title}</h1>\
                 <p class=\"lead\">Lokus is where a team keeps its customers, tasks and notes in one place. You would join as {role}.</p>\
                 <div class=\"card\"><div class=\"tile\">{initial}</div><div><strong>{workspace}</strong><span>{role_name}, invited by {by}. Works until {until}.</span></div></div>\
                 <ol>\
                 <li><b>Get Lokus</b><p>Free, for Mac. Open the download and drag Lokus into Applications. Already have it? Skip this.</p><div class=\"get\">{get}</div></li>\
                 <li>{sign_in}</li>\
                 <li>{join}</li>\
                 </ol>\
                 <div class=\"other\">{other}<div class=\"code\"><code>{code}</code><button data-copy=\"{code}\">Copy</button></div></div>",
                title = escape(&title),
                role = escape(mail::may(invitation.role)),
                initial = escape(&initial),
                workspace = escape(&invitation.name),
                role_name = escape(&mail::capital(invitation.role.name())),
                by = escape(invitation.from.as_deref().unwrap_or(&who)),
                until = escape(&mail::day(invitation.expires_at)),
                code = escape(&invitation.code),
            );
            (title, body)
        }
    };
    let html = include_str!("../assets/join.html")
        .replace("{{title}}", &escape(&title))
        .replace("{{body}}", &body);
    Ok((
        [
            (header::CACHE_CONTROL, "no-store"),
            (header::REFERRER_POLICY, "no-referrer"),
            (header::X_FRAME_OPTIONS, "DENY"),
        ],
        Html(html),
    )
        .into_response())
}

/// The mark shown in the email and on the page.
pub async fn logo() -> Response {
    (
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, "public, max-age=604800"),
        ],
        include_bytes!("../assets/lokus.png").as_slice(),
    )
        .into_response()
}

/// The picture at the top of the invitation page; the email carries its own copy.
pub async fn picture() -> Response {
    (
        [
            (header::CONTENT_TYPE, "image/jpeg"),
            (header::CACHE_CONTROL, "public, max-age=604800"),
        ],
        include_bytes!("../assets/invitation.jpg").as_slice(),
    )
        .into_response()
}
