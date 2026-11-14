//! @part-of server
//! Inviting someone to a workspace by email, checked against a real relay on a local port with
//! a stand-in for the mail service.

use lokus_server::auth::Auth;
use lokus_server::store::{now, Role, Store};
use lokus_server::{router, App, Limits};
use serde_json::{json, Value};

const PEOPLE: &str = "ta:alice:alice@x.io,tb:bob:bob@x.io,tc:carol:carol@x.io";

struct Relay {
    url: String,
    http: reqwest::Client,
    _dir: tempfile::TempDir,
}

/// A relay that sends no email.
async fn relay() -> Relay {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("relay.sqlite")).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let app = App::new(store, Auth::dev(PEOPLE), Limits::default());
    tokio::spawn(async move { axum::serve(listener, router(app)).await.unwrap() });
    Relay {
        url,
        http: reqwest::Client::new(),
        _dir: dir,
    }
}

/// A relay that emails invitations, and the stand-in for the mail service: everything handed
/// to it is kept, and an address with "bounce" in it is refused.
async fn mailing_relay() -> (Relay, std::sync::Arc<std::sync::Mutex<Vec<Value>>>) {
    use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
    type Kept = std::sync::Arc<std::sync::Mutex<Vec<Value>>>;
    let kept = Kept::default();
    let post_office = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let api = format!("http://{}/emails", post_office.local_addr().unwrap());
    let take = |State(kept): State<Kept>, Json(mail): Json<Value>| async move {
        if mail["to"][0]
            .as_str()
            .unwrap_or_default()
            .contains("bounce")
        {
            return StatusCode::UNPROCESSABLE_ENTITY;
        }
        kept.lock().unwrap().push(mail);
        StatusCode::OK
    };
    let office = Router::new()
        .route("/emails", post(take))
        .with_state(kept.clone());
    tokio::spawn(async move { axum::serve(post_office, office).await.unwrap() });

    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("relay.sqlite")).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let mailer = lokus_server::mail::Mailer::new(
        "mail-key",
        "Lokus <noreply@lokusmd.com>",
        &url,
        Some(&api),
    );
    let app = App::build(
        store,
        Auth::dev(PEOPLE),
        Limits::default(),
        None,
        Some(mailer),
    );
    tokio::spawn(async move { axum::serve(listener, router(app)).await.unwrap() });
    (
        Relay {
            url,
            http: reqwest::Client::new(),
            _dir: dir,
        },
        kept,
    )
}

impl Relay {
    /// One request; gives back the status and the JSON body.
    async fn call(&self, token: &str, method: &str, path: &str, body: Value) -> (u16, Value) {
        let url = format!("{}{path}", self.url);
        let request = match method {
            "GET" => self.http.get(url),
            "POST" => self.http.post(url).json(&body),
            other => panic!("{other}"),
        };
        let response = request.bearer_auth(token).send().await.unwrap();
        let status = response.status().as_u16();
        (status, response.json().await.unwrap_or(Value::Null))
    }

    /// A workspace alice owns with bob in it as `role`.
    async fn team(&self, role: &str) -> String {
        let id = self.workspace("Team").await;
        let invites = format!("/v1/workspaces/{id}/invites");
        let (_, invite) = self
            .call("ta", "POST", &invites, json!({ "role": role }))
            .await;
        let accept = format!("/v1/invites/{}/accept", invite["code"].as_str().unwrap());
        assert_eq!(self.call("tb", "POST", &accept, Value::Null).await.0, 200);
        id
    }
}

impl Relay {
    async fn workspace(&self, name: &str) -> String {
        let (_, made) = self
            .call("ta", "POST", "/v1/workspaces", json!({ "name": name }))
            .await;
        made["id"].as_str().unwrap().to_string()
    }

    async fn page(&self, path: &str) -> String {
        let got = self
            .http
            .get(format!("{}{path}", self.url))
            .send()
            .await
            .unwrap();
        got.text().await.unwrap()
    }
}

/// The whole of inviting by email: the owner types an address, the relay writes to it, and the
/// person finds the invitation waiting when they sign in with that address. No code is passed.
#[tokio::test]
async fn an_invitation_is_emailed_and_waits_for_the_person_it_names() {
    let (relay, mail) = mailing_relay().await;
    let id = relay.workspace("Acme & Sons").await;
    let invites = format!("/v1/workspaces/{id}/invites");

    let (status, made) = relay
        .call(
            "ta",
            "POST",
            &invites,
            json!({ "role": "editor", "email": " Bob@X.io ", "name": "Alice Ng" }),
        )
        .await;
    assert_eq!(status, 200, "{made}");
    assert_eq!(made["sent"], true);
    assert_eq!(made["email"], "bob@x.io");
    let code = made["code"].as_str().unwrap().to_string();
    let link = format!("{}/join/{code}", relay.url);
    assert_eq!(made["link"], link.as_str());

    let sent = mail.lock().unwrap().clone();
    assert_eq!(sent.len(), 1);
    assert_eq!(sent[0]["to"], json!(["bob@x.io"]));
    assert_eq!(sent[0]["from"], "Lokus <noreply@lokusmd.com>");
    assert_eq!(sent[0]["reply_to"], "alice@x.io");
    assert_eq!(
        sent[0]["subject"],
        "Alice Ng invited you to Acme & Sons on Lokus"
    );
    for part in ["html", "text"] {
        assert!(sent[0][part].as_str().unwrap().contains(&link), "{part}");
    }
    assert!(sent[0]["html"]
        .as_str()
        .unwrap()
        .contains("Acme &amp; Sons"));

    // The owner sees who it went to; the page behind the link says who invited whom.
    let (_, open) = relay.call("ta", "GET", &invites, Value::Null).await;
    assert_eq!(open[0]["email"], "bob@x.io");
    assert!(open[0]["sent_at"].as_i64().is_some());
    let page = relay.page(&format!("/join/{code}")).await;
    assert!(page.contains("Alice Ng invited you to Acme &amp; Sons"));
    assert!(page.contains("bob@x.io"));

    // It waits for bob and for nobody else.
    let (_, waiting) = relay
        .call("tb", "GET", "/v1/invites/mine", Value::Null)
        .await;
    assert_eq!(waiting.as_array().unwrap().len(), 1);
    assert_eq!(waiting[0]["name"], "Acme & Sons");
    assert_eq!(waiting[0]["from"], "alice@x.io");
    assert_eq!(waiting[0]["from_name"], "Alice Ng");
    assert_eq!(waiting[0]["role"], "editor");
    let (_, others) = relay
        .call("tc", "GET", "/v1/invites/mine", Value::Null)
        .await;
    assert_eq!(others, json!([]));

    let (status, joined) = relay
        .call(
            "tb",
            "POST",
            &format!("/v1/invites/{code}/accept"),
            Value::Null,
        )
        .await;
    assert_eq!(
        (status, joined["workspace"].as_str()),
        (200, Some(id.as_str()))
    );
    let (_, waiting) = relay
        .call("tb", "GET", "/v1/invites/mine", Value::Null)
        .await;
    assert_eq!(waiting, json!([]));
    assert!(relay
        .page(&format!("/join/{code}"))
        .await
        .contains("can no longer be used"));

    // Someone already inside is not written to.
    let (status, said) = relay
        .call(
            "ta",
            "POST",
            &invites,
            json!({ "role": "viewer", "email": "bob@x.io" }),
        )
        .await;
    assert_eq!(status, 400);
    assert!(said["message"].as_str().unwrap().contains("already in"));
    assert_eq!(mail.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn emailing_an_invitation_has_its_limits() {
    let (relay, mail) = mailing_relay().await;
    let id = relay.team("editor").await;
    let invites = format!("/v1/workspaces/{id}/invites");
    let ask = |email: &str| json!({ "role": "viewer", "email": email });

    // Only an owner, and only to one plain address.
    assert_eq!(
        relay
            .call("tb", "POST", &invites, ask("carol@x.io"))
            .await
            .0,
        403
    );
    for bad in ["carol", "carol@x.io, dave@x.io", "Carol <carol@x.io>"] {
        assert_eq!(
            relay.call("ta", "POST", &invites, ask(bad)).await.0,
            400,
            "{bad}"
        );
    }
    assert_eq!(mail.lock().unwrap().len(), 0);

    // Inviting the same person again replaces the first invitation.
    let (_, first) = relay.call("ta", "POST", &invites, ask("carol@x.io")).await;
    let (_, second) = relay.call("ta", "POST", &invites, ask("CAROL@x.io")).await;
    let (_, open) = relay.call("ta", "GET", &invites, Value::Null).await;
    assert_eq!(open.as_array().unwrap().len(), 1);
    assert_eq!(open[0]["code"], second["code"]);
    let old = format!("/v1/invites/{}/accept", first["code"].as_str().unwrap());
    assert_eq!(relay.call("tc", "POST", &old, Value::Null).await.0, 404);

    // Sending again is for an email that got lost, not for nagging.
    let again = format!("{invites}/{}/send", second["code"].as_str().unwrap());
    let (status, said) = relay.call("ta", "POST", &again, Value::Null).await;
    assert_eq!(status, 400, "{said}");
    assert_eq!(relay.call("tb", "POST", &again, Value::Null).await.0, 403);
    assert_eq!(mail.lock().unwrap().len(), 2);

    // An email the mail service refuses leaves an invite the owner can still pass on.
    let (status, kept) = relay.call("ta", "POST", &invites, ask("bounce@x.io")).await;
    assert_eq!((status, &kept["sent"]), (200, &json!(false)));
    assert!(kept["link"].as_str().unwrap().contains("/join/"));
    assert_eq!(mail.lock().unwrap().len(), 2);
}

/// A relay with no mail service still invites the old way, and says so when asked to email.
#[tokio::test]
async fn a_relay_that_sends_no_email_hands_out_links() {
    let relay = relay().await;
    let id = relay.workspace("Team").await;
    let invites = format!("/v1/workspaces/{id}/invites");
    let (status, said) = relay
        .call(
            "ta",
            "POST",
            &invites,
            json!({ "role": "editor", "email": "bob@x.io" }),
        )
        .await;
    assert_eq!(status, 400);
    assert!(said["message"]
        .as_str()
        .unwrap()
        .contains("does not send email"));
    let (status, made) = relay
        .call("ta", "POST", &invites, json!({ "role": "editor" }))
        .await;
    assert_eq!(
        (status, &made["sent"], &made["link"]),
        (200, &Value::Null, &Value::Null)
    );
    let accept = format!("/v1/invites/{}/accept", made["code"].as_str().unwrap());
    assert_eq!(relay.call("tb", "POST", &accept, Value::Null).await.0, 200);
}

/// The relay already live was made before invitations had an address. Its database must open
/// under this build and take an emailed invitation.
#[test]
fn a_database_from_before_emailed_invitations_still_opens() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("relay.sqlite");
    Store::open(&path).unwrap();
    {
        let db = rusqlite::Connection::open(&path).unwrap();
        for column in ["email", "inviter", "sent_at", "sends"] {
            if column == "email" {
                db.execute_batch("DROP INDEX invites_by_email;").unwrap();
            }
            db.execute_batch(&format!("ALTER TABLE invites DROP COLUMN {column};"))
                .unwrap();
        }
    }
    let store = Store::open(&path).unwrap();
    store
        .create_workspace("w", "Team", "alice", Some("alice@x.io"))
        .unwrap();
    store
        .create_invite(
            "c",
            "w",
            Role::Viewer,
            "alice",
            now() + 60,
            Some("bob@x.io"),
            None,
        )
        .unwrap();
    let waiting = store.invitations_for("Bob@x.io", "bob").unwrap();
    assert_eq!(waiting.len(), 1);
    assert_eq!(waiting[0].from.as_deref(), Some("alice@x.io"));
}
