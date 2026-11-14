//! @part-of server
//! The relay's promises about who may do what, checked against a real relay on a local port.
//! Each test pins a hole that was open before 2026-11-13: sign-ins in the address, removal and
//! role changes that only applied on reconnect, sockets that outlived their sign-in, invites
//! that never ran out, and no ceiling on storage.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use lokus_server::auth::Auth;
use lokus_server::store::{now, Role, Store};
use lokus_server::{router, App, Limits};
use serde_json::{json, Value};
use tokio_tungstenite::tungstenite::Message;

type Socket =
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

const PEOPLE: &str = "ta:alice:alice@x.io,tb:bob:bob@x.io,tc:carol:carol@x.io";

struct Relay {
    url: String,
    http: reqwest::Client,
    _dir: tempfile::TempDir,
}

async fn relay_with(auth: Auth, limits: Limits) -> Relay {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("relay.sqlite")).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move {
        axum::serve(listener, router(App::new(store, auth, limits)))
            .await
            .unwrap();
    });
    Relay {
        url,
        http: reqwest::Client::new(),
        _dir: dir,
    }
}

async fn relay() -> Relay {
    relay_with(Auth::dev(PEOPLE), Limits::default()).await
}

impl Relay {
    /// One request; gives back the status and the JSON body.
    async fn call(&self, token: &str, method: &str, path: &str, body: Value) -> (u16, Value) {
        let url = format!("{}{path}", self.url);
        let request = match method {
            "GET" => self.http.get(url),
            "POST" => self.http.post(url).json(&body),
            "PATCH" => self.http.patch(url).json(&body),
            "DELETE" => self.http.delete(url),
            other => panic!("{other}"),
        };
        let response = request.bearer_auth(token).send().await.unwrap();
        let status = response.status().as_u16();
        (status, response.json().await.unwrap_or(Value::Null))
    }

    /// A workspace alice owns with bob in it as `role`.
    async fn team(&self, role: &str) -> String {
        let (_, made) = self
            .call("ta", "POST", "/v1/workspaces", json!({ "name": "Team" }))
            .await;
        let id = made["id"].as_str().unwrap().to_string();
        let (_, invite) = self
            .call(
                "ta",
                "POST",
                &format!("/v1/workspaces/{id}/invites"),
                json!({ "role": role }),
            )
            .await;
        let code = invite["code"].as_str().unwrap();
        let (status, _) = self
            .call(
                "tb",
                "POST",
                &format!("/v1/invites/{code}/accept"),
                Value::Null,
            )
            .await;
        assert_eq!(status, 200);
        id
    }

    async fn raw_socket(&self, query: &str) -> Socket {
        let url = format!("{}/v1/ws{query}", self.url.replacen("http", "ws", 1));
        tokio_tungstenite::connect_async(url).await.unwrap().0
    }

    /// A socket that has signed in; panics unless the relay says hello.
    async fn socket(&self, token: &str, workspace: &str) -> Socket {
        let mut socket = self.raw_socket("").await;
        say(
            &mut socket,
            json!({ "t": "auth", "token": token, "workspace": workspace }),
        )
        .await;
        assert_eq!(next(&mut socket).await["t"], "hello");
        socket
    }
}

async fn say(socket: &mut Socket, value: Value) {
    socket
        .send(Message::Text(value.to_string().into()))
        .await
        .unwrap();
}

/// The next message meant for this socket, or `{"t":"closed"}` when the relay hangs up or stays silent.
async fn next(socket: &mut Socket) -> Value {
    loop {
        match tokio::time::timeout(Duration::from_secs(4), socket.next()).await {
            Ok(Some(Ok(Message::Text(text)))) => {
                let value: Value = serde_json::from_str(&text).unwrap();
                // Another socket leaving is announced to everyone; no test here is about that.
                if value["t"] != "bye" {
                    return value;
                }
            }
            Ok(Some(Ok(_))) => continue,
            _ => return json!({ "t": "closed" }),
        }
    }
}

/// A well-formed edit to send: one empty Yjs update.
fn edit(id: u64) -> Value {
    json!({ "t": "up", "id": id, "doc": "manifest", "data": "AAA=" })
}

#[tokio::test]
async fn a_socket_signs_in_with_its_first_message_never_its_address() {
    let relay = relay().await;
    let team = relay.team("editor").await;
    // The old way: the sign-in in the address. It gets no access at all.
    let mut old = relay
        .raw_socket(&format!("?workspace={team}&token=ta"))
        .await;
    say(&mut old, json!({ "t": "pull", "since": 0 })).await;
    let refused = next(&mut old).await;
    assert_eq!(refused["code"], "unauthorized");
    assert_eq!(next(&mut old).await["t"], "closed");
    // Someone who is not in the workspace is turned away the same way.
    let mut stranger = relay.raw_socket("").await;
    say(
        &mut stranger,
        json!({ "t": "auth", "token": "tc", "workspace": team }),
    )
    .await;
    assert_eq!(next(&mut stranger).await["code"], "forbidden");
    // The right way works.
    let mut alice = relay.socket("ta", &team).await;
    say(&mut alice, edit(1)).await;
    assert_eq!(next(&mut alice).await["t"], "ack");
}

#[tokio::test]
async fn a_removed_member_is_cut_off_while_still_connected() {
    let relay = relay().await;
    let team = relay.team("editor").await;
    let mut bob = relay.socket("tb", &team).await;
    say(&mut bob, edit(1)).await;
    assert_eq!(next(&mut bob).await["t"], "ack");

    let (status, _) = relay
        .call(
            "ta",
            "DELETE",
            &format!("/v1/workspaces/{team}/members/bob"),
            Value::Null,
        )
        .await;
    assert_eq!(status, 200);
    let gone = next(&mut bob).await;
    assert_eq!(
        (gone["t"].as_str(), gone["code"].as_str()),
        (Some("error"), Some("forbidden"))
    );
    assert_eq!(next(&mut bob).await["t"], "closed");
    // And nothing else of the workspace is his to read any more.
    let (status, _) = relay
        .call(
            "tb",
            "GET",
            &format!("/v1/workspaces/{team}/members"),
            Value::Null,
        )
        .await;
    assert_eq!(status, 403);
}

#[tokio::test]
async fn a_role_change_applies_to_an_open_socket() {
    let relay = relay().await;
    let team = relay.team("editor").await;
    let mut bob = relay.socket("tb", &team).await;
    let (status, _) = relay
        .call(
            "ta",
            "PATCH",
            &format!("/v1/workspaces/{team}/members/bob"),
            json!({ "role": "viewer" }),
        )
        .await;
    assert_eq!(status, 200);
    let told = next(&mut bob).await;
    assert_eq!(
        (told["t"].as_str(), told["role"].as_str()),
        (Some("role"), Some("viewer"))
    );
    say(&mut bob, edit(1)).await;
    assert_eq!(next(&mut bob).await["code"], "forbidden");
    // Only an owner changes roles.
    let (status, _) = relay
        .call(
            "tb",
            "PATCH",
            &format!("/v1/workspaces/{team}/members/alice"),
            json!({ "role": "viewer" }),
        )
        .await;
    assert_eq!(status, 403);
}

#[tokio::test]
async fn a_workspace_always_keeps_an_owner_and_members_can_leave() {
    let relay = relay().await;
    let team = relay.team("editor").await;
    let member = |who: &str| format!("/v1/workspaces/{team}/members/{who}");
    // The only owner can neither leave nor step down.
    assert_eq!(
        relay
            .call("ta", "DELETE", &member("alice"), Value::Null)
            .await
            .0,
        400
    );
    assert_eq!(
        relay
            .call("ta", "PATCH", &member("alice"), json!({ "role": "editor" }))
            .await
            .0,
        400
    );
    // A member cannot remove someone else, but can leave.
    assert_eq!(
        relay
            .call("tb", "DELETE", &member("alice"), Value::Null)
            .await
            .0,
        403
    );
    assert_eq!(
        relay
            .call("tb", "DELETE", &member("bob"), Value::Null)
            .await
            .0,
        200
    );
    // Once there is a second owner, the first may step down.
    let team = relay.team("editor").await;
    let member = |who: &str| format!("/v1/workspaces/{team}/members/{who}");
    assert_eq!(
        relay
            .call("ta", "PATCH", &member("bob"), json!({ "role": "owner" }))
            .await
            .0,
        200
    );
    assert_eq!(
        relay
            .call("ta", "PATCH", &member("alice"), json!({ "role": "editor" }))
            .await
            .0,
        200
    );
    // What happened is on record, for owners only.
    let (status, log) = relay
        .call(
            "tb",
            "GET",
            &format!("/v1/workspaces/{team}/audit"),
            Value::Null,
        )
        .await;
    assert_eq!(status, 200);
    let actions: Vec<&str> = log
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|e| e["action"].as_str())
        .collect();
    assert_eq!(
        actions,
        [
            "role_changed",
            "role_changed",
            "invite_accepted",
            "invite_created",
            "workspace_created"
        ]
    );
    assert_eq!(
        relay
            .call(
                "ta",
                "GET",
                &format!("/v1/workspaces/{team}/audit"),
                Value::Null
            )
            .await
            .0,
        403
    );
}

#[tokio::test]
async fn deleting_a_workspace_ends_it_for_everyone() {
    let relay = relay().await;
    let team = relay.team("editor").await;
    let mut bob = relay.socket("tb", &team).await;
    assert_eq!(
        relay
            .call(
                "tb",
                "DELETE",
                &format!("/v1/workspaces/{team}"),
                Value::Null
            )
            .await
            .0,
        403
    );
    assert_eq!(
        relay
            .call(
                "ta",
                "DELETE",
                &format!("/v1/workspaces/{team}"),
                Value::Null
            )
            .await
            .0,
        200
    );
    assert_eq!(next(&mut bob).await["code"], "forbidden");
    let (_, mine) = relay.call("ta", "GET", "/v1/workspaces", Value::Null).await;
    assert_eq!(mine, json!([]));
}

#[tokio::test]
async fn an_invite_works_once_runs_out_and_can_be_cancelled() {
    let relay = relay().await;
    let (_, made) = relay
        .call("ta", "POST", "/v1/workspaces", json!({ "name": "Team" }))
        .await;
    let team = made["id"].as_str().unwrap();
    let invites = format!("/v1/workspaces/{team}/invites");
    let accept = |code: &str| format!("/v1/invites/{code}/accept");

    // Once.
    let (_, one) = relay
        .call("ta", "POST", &invites, json!({ "role": "editor" }))
        .await;
    let code = one["code"].as_str().unwrap();
    assert!(one["expires_at"].as_i64().unwrap() > now() + 6 * 24 * 3600);
    assert_eq!(
        relay.call("tb", "POST", &accept(code), Value::Null).await.0,
        200
    );
    assert_eq!(
        relay.call("tc", "POST", &accept(code), Value::Null).await.0,
        404
    );

    // Cancelled: listed while open, gone once cancelled, useless afterwards.
    let (_, two) = relay
        .call("ta", "POST", &invites, json!({ "role": "viewer" }))
        .await;
    let code = two["code"].as_str().unwrap();
    let (_, open) = relay.call("ta", "GET", &invites, Value::Null).await;
    assert_eq!(open.as_array().unwrap().len(), 1);
    assert_eq!(relay.call("tb", "GET", &invites, Value::Null).await.0, 403);
    assert_eq!(
        relay
            .call("ta", "DELETE", &format!("{invites}/{code}"), Value::Null)
            .await
            .0,
        200
    );
    assert_eq!(
        relay.call("tc", "POST", &accept(code), Value::Null).await.0,
        404
    );
    assert_eq!(
        relay.call("ta", "GET", &invites, Value::Null).await.1,
        json!([])
    );
    // An owner cannot be made by invite.
    assert_eq!(
        relay
            .call("ta", "POST", &invites, json!({ "role": "owner" }))
            .await
            .0,
        400
    );
}

#[test]
fn an_invite_past_its_date_is_as_good_as_no_invite() {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("relay.sqlite")).unwrap();
    store.create_workspace("w", "Team", "alice", None).unwrap();
    store
        .create_invite("old", "w", Role::Editor, "alice", now() - 1)
        .unwrap();
    assert!(store.accept_invite("old", "bob", None).is_err());
    assert!(store.invites("w").unwrap().is_empty());
    assert_eq!(store.role("w", "bob").unwrap(), None);
}

/// A sign-in as Supabase issues them, signed with a shared secret, good for `seconds`.
fn sign_in(user: &str, seconds: i64) -> String {
    use jsonwebtoken::{encode, EncodingKey, Header};
    let claims = json!({ "sub": user, "aud": "authenticated", "exp": now() + seconds });
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"secret"),
    )
    .unwrap()
}

#[tokio::test]
async fn a_socket_does_not_outlive_its_sign_in_unless_it_is_renewed() {
    let auth = Auth::supabase("http://127.0.0.1:1", Some("secret".into()));
    let limits = Limits {
        sign_in_grace: 0,
        ..Limits::default()
    };
    let relay = relay_with(auth, limits).await;
    let (_, made) = relay
        .call(
            &sign_in("alice", 600),
            "POST",
            "/v1/workspaces",
            json!({ "name": "Team" }),
        )
        .await;
    let team = made["id"].as_str().unwrap();

    // Left alone, the socket is closed when the sign-in runs out.
    let mut lapsing = relay.socket(&sign_in("alice", 2), team).await;
    // Handed a fresh sign-in in time, it carries on.
    let mut renewed = relay.socket(&sign_in("alice", 2), team).await;
    say(
        &mut renewed,
        json!({ "t": "auth", "token": sign_in("alice", 600) }),
    )
    .await;
    assert_eq!(next(&mut renewed).await["t"], "authed");
    // Someone else's sign-in cannot be swapped in.
    say(
        &mut renewed,
        json!({ "t": "auth", "token": sign_in("mallory", 600) }),
    )
    .await;
    assert_eq!(next(&mut renewed).await["code"], "forbidden");

    let over = next(&mut lapsing).await;
    assert_eq!(
        (over["t"].as_str(), over["code"].as_str()),
        (Some("error"), Some("unauthorized"))
    );
    assert_eq!(next(&mut lapsing).await["t"], "closed");
    say(&mut renewed, edit(1)).await;
    assert_eq!(next(&mut renewed).await["t"], "ack");
}

#[tokio::test]
async fn attachments_stop_at_the_workspace_limit() {
    let limits = Limits {
        workspace_bytes: 1000,
        ..Limits::default()
    };
    let relay = relay_with(Auth::dev(PEOPLE), limits).await;
    let team = relay.team("viewer").await;
    let put = |token: &'static str, bytes: Vec<u8>| {
        let url = format!(
            "{}/v1/workspaces/{team}/blobs/{}",
            relay.url,
            blake3::hash(&bytes).to_hex()
        );
        let http = relay.http.clone();
        async move {
            http.put(url)
                .bearer_auth(token)
                .body(bytes)
                .send()
                .await
                .unwrap()
                .status()
                .as_u16()
        }
    };
    assert_eq!(put("ta", vec![1; 600]).await, 200);
    // The same bytes again cost nothing; different bytes that would pass the limit are refused.
    assert_eq!(put("ta", vec![1; 600]).await, 200);
    assert_eq!(put("ta", vec![2; 600]).await, 400);
    assert_eq!(put("ta", vec![3; 300]).await, 200);
    // A viewer stores nothing, and bytes must match the name they are stored under.
    assert_eq!(put("tb", vec![4; 10]).await, 403);
    let wrong = format!(
        "{}/v1/workspaces/{team}/blobs/{}",
        relay.url,
        "0".repeat(64)
    );
    let status = relay
        .http
        .put(wrong)
        .bearer_auth("ta")
        .body(vec![5; 10])
        .send()
        .await
        .unwrap()
        .status();
    assert_eq!(status.as_u16(), 400);
}

#[tokio::test]
async fn what_a_socket_sends_is_checked_before_it_is_kept_or_passed_on() {
    let relay = relay().await;
    let team = relay.team("editor").await;
    let mut alice = relay.socket("ta", &team).await;
    for bad in [
        json!({ "t": "up", "id": 1, "doc": "../../etc", "data": "AAA=" }),
        json!({ "t": "up", "id": 1, "doc": "x".repeat(65), "data": "AAA=" }),
        json!({ "t": "up", "id": 1, "doc": "manifest", "data": "not base64!" }),
        json!({ "t": "up", "id": 1, "doc": "manifest", "data": "/////w==" }),
        json!({ "t": "aw", "doc": "manifest", "data": { "html": "<script>" } }),
        json!({ "t": "aw", "doc": "manifest", "data": "x".repeat(70_000) }),
        json!({ "t": "nonsense" }),
    ] {
        say(&mut alice, bad.clone()).await;
        assert_eq!(next(&mut alice).await["code"], "bad_request", "{bad}");
    }
    // The socket is still usable afterwards, and none of that reached the log.
    say(&mut alice, json!({ "t": "pull", "since": 0 })).await;
    assert_eq!(next(&mut alice).await["items"], json!([]));
    // A workspace's name is one short line.
    for name in ["", "a\nb", &"n".repeat(121)] {
        assert_eq!(
            relay
                .call("ta", "POST", "/v1/workspaces", json!({ "name": name }))
                .await
                .0,
            400
        );
    }
}

#[tokio::test]
async fn a_pushed_fact_needs_a_live_key_and_goes_to_one_device_at_a_time() {
    let r = relay().await;
    let w = r.team("editor").await;
    let keys = format!("/v1/workspaces/{w}/keys");
    // Only an owner makes a key, and the relay never shows it again.
    assert_eq!(
        r.call("tb", "POST", &keys, json!({ "label": "x" })).await.0,
        403
    );
    let (_, made) = r
        .call("ta", "POST", &keys, json!({ "label": "billing" }))
        .await;
    let key = made["key"].as_str().unwrap().to_string();
    let (_, listed) = r.call("ta", "GET", &keys, Value::Null).await;
    assert!(
        listed[0].get("key").is_none() && listed[0].get("hash").is_none(),
        "{listed}"
    );

    // A sign-in is not a key, and a fact names its customer.
    assert_eq!(
        r.call(
            "ta",
            "POST",
            "/v1/ingest",
            json!({ "customer": "acme.com" })
        )
        .await
        .0,
        401
    );
    assert_eq!(
        r.call(
            &key,
            "POST",
            "/v1/ingest",
            json!({ "set": { "plan": "pro" } })
        )
        .await
        .0,
        400
    );
    assert_eq!(
        r.call(
            &key,
            "POST",
            "/v1/ingest",
            json!({ "customer": "x".repeat(40_000) })
        )
        .await
        .0,
        400
    );

    // A connected device is told the moment something arrives.
    let mut bob = r.socket("tb", &w).await;
    let (status, taken) = r
        .call(
            &key,
            "POST",
            "/v1/ingest",
            json!({ "customer": "acme.com", "set": { "plan": "pro" } }),
        )
        .await;
    assert_eq!((status, taken["accepted"].as_i64()), (200, Some(1)));
    assert_eq!(next(&mut bob).await["t"], "inbox");

    // One device takes it; another gets nothing and cannot say it is done.
    let claim = format!("/v1/workspaces/{w}/inbox/claim");
    let ack = format!("/v1/workspaces/{w}/inbox/ack");
    let (_, mine) = r
        .call("ta", "POST", &claim, json!({ "device": "laptop" }))
        .await;
    assert_eq!(mine["items"][0]["fact"]["set"]["plan"], "pro");
    let seq = mine["items"][0]["seq"].as_i64().unwrap();
    let (_, theirs) = r
        .call("tb", "POST", &claim, json!({ "device": "desktop" }))
        .await;
    assert_eq!(theirs["items"].as_array().unwrap().len(), 0);
    let (_, wrong) = r
        .call(
            "tb",
            "POST",
            &ack,
            json!({ "device": "desktop", "seqs": [seq] }),
        )
        .await;
    assert_eq!(wrong["done"], 0);
    let (_, done) = r
        .call(
            "ta",
            "POST",
            &ack,
            json!({ "device": "laptop", "seqs": [seq] }),
        )
        .await;
    assert_eq!(done["done"], 1);

    // A removed key is refused, and someone outside the workspace cannot take facts.
    let id = made["id"].as_str().unwrap();
    assert_eq!(
        r.call("ta", "DELETE", &format!("{keys}/{id}"), Value::Null)
            .await
            .0,
        200
    );
    assert_eq!(
        r.call(
            &key,
            "POST",
            "/v1/ingest",
            json!({ "customer": "acme.com" })
        )
        .await
        .0,
        401
    );
    assert_eq!(
        r.call("tc", "POST", &claim, json!({ "device": "x" }))
            .await
            .0,
        403
    );
}

const PUBLISH: &str = "a-publish-key-of-enough-length";

async fn publishing_relay() -> Relay {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("relay.sqlite")).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let app = App::with_publisher(
        store,
        Auth::dev(PEOPLE),
        Limits::default(),
        Some(PUBLISH.into()),
    );
    tokio::spawn(async move { axum::serve(listener, router(app)).await.unwrap() });
    Relay {
        url,
        http: reqwest::Client::new(),
        _dir: dir,
    }
}

impl Relay {
    async fn put(&self, key: &str, path: &str, body: Value) -> (u16, Value) {
        let sent = self
            .http
            .post(format!("{}{path}", self.url))
            .bearer_auth(key)
            .json(&body)
            .send()
            .await
            .unwrap();
        (
            sent.status().as_u16(),
            sent.json().await.unwrap_or(Value::Null),
        )
    }

    /// What a copy of the app on this platform and version is offered: a version, or nothing.
    async fn offered(&self, platform: &str, current: &str) -> Option<String> {
        let (target, arch) = platform.split_once('-').unwrap();
        let got = self
            .http
            .get(format!(
                "{}/v1/app/update/{target}/{arch}/{current}",
                self.url
            ))
            .send()
            .await
            .unwrap();
        match got.status().as_u16() {
            204 => None,
            200 => Some(
                got.json::<Value>().await.unwrap()["version"]
                    .as_str()
                    .unwrap()
                    .to_string(),
            ),
            other => panic!("update check answered {other}"),
        }
    }
}

/// The Lokus 1 failure, pinned: a release that has no build for a platform must leave that
/// platform alone instead of breaking its update check, and a build added later reaches it.
#[tokio::test]
async fn an_update_is_offered_only_to_platforms_it_was_built_for() {
    let relay = publishing_relay().await;
    let build =
        |name: &str| json!({ "url": format!("https://x.io/{name}.tar.gz"), "signature": "c2ln" });

    // Publishing needs the key, and an unsigned build is refused.
    let (status, _) = relay
        .put(
            "wrong-key-wrong-key-wrong-key",
            "/v1/app/releases/2.0.1",
            json!({ "platforms": { "darwin-aarch64": build("mac") } }),
        )
        .await;
    assert_eq!(status, 403);
    let (status, _) = relay
        .put(
            PUBLISH,
            "/v1/app/releases/2.0.1",
            json!({ "platforms": { "darwin-aarch64": { "url": "https://x.io/a" } } }),
        )
        .await;
    assert_eq!(status, 400);

    // Windows built, the Mac did not.
    let (status, _) = relay
        .put(
            PUBLISH,
            "/v1/app/releases/2.0.1",
            json!({ "platforms": { "windows-x86_64": build("win") } }),
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(
        relay.offered("windows-x86_64", "2.0.0").await.as_deref(),
        Some("2.0.1")
    );
    assert_eq!(relay.offered("darwin-aarch64", "2.0.0").await, None);

    // The Mac build arrives later and Mac users get it; nobody is offered what they have.
    relay
        .put(
            PUBLISH,
            "/v1/app/releases/2.0.1",
            json!({ "platforms": { "darwin-aarch64": build("mac") } }),
        )
        .await;
    assert_eq!(
        relay.offered("darwin-aarch64", "2.0.0").await.as_deref(),
        Some("2.0.1")
    );
    assert_eq!(relay.offered("darwin-aarch64", "2.0.1").await, None);

    // A test version goes only to people already on a test version.
    relay
        .put(
            PUBLISH,
            "/v1/app/releases/2.1.0-beta.1",
            json!({ "platforms": { "darwin-aarch64": build("beta") } }),
        )
        .await;
    assert_eq!(relay.offered("darwin-aarch64", "2.0.1").await, None);
    assert_eq!(
        relay
            .offered("darwin-aarch64", "2.0.0-alpha.3")
            .await
            .as_deref(),
        Some("2.1.0-beta.1")
    );

    // A bad release is pulled back and the one before it is offered again.
    let pulled = relay
        .http
        .delete(format!("{}/v1/app/releases/2.1.0-beta.1", relay.url))
        .bearer_auth(PUBLISH)
        .send()
        .await
        .unwrap();
    assert_eq!(pulled.status().as_u16(), 200);
    assert_eq!(
        relay
            .offered("darwin-aarch64", "2.0.0-alpha.3")
            .await
            .as_deref(),
        Some("2.0.1")
    );
}

#[tokio::test]
async fn news_is_published_with_the_key_and_read_by_anyone() {
    let relay = publishing_relay().await;
    let (status, _) = relay
        .put("ta", "/v1/app/news/hello", json!({ "title": "Hello" }))
        .await;
    assert_eq!(status, 403);
    let (status, _) = relay
        .put(
            PUBLISH,
            "/v1/app/news/hello",
            json!({ "title": "Hello", "video": "javascript:alert(1)" }),
        )
        .await;
    assert_eq!(status, 400);

    relay
        .put(
            PUBLISH,
            "/v1/app/news/first",
            json!({ "title": "First", "at": 100 }),
        )
        .await;
    let (status, post) = relay.put(PUBLISH, "/v1/app/news/second", json!({ "title": "Second", "version": "2.0.1", "summary": "Faster search", "show": "popup", "video": "https://x.io/demo.mp4", "at": 200 })).await;
    assert_eq!((status, post["show"].as_str()), (200, Some("popup")));

    // Anyone reads it, newest first; correcting a post keeps its place.
    relay
        .put(
            PUBLISH,
            "/v1/app/news/first",
            json!({ "title": "First, corrected" }),
        )
        .await;
    let read: Value = relay
        .http
        .get(format!("{}/v1/app/news", relay.url))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let titles: Vec<&str> = read["posts"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["title"].as_str().unwrap())
        .collect();
    assert_eq!(titles, ["Second", "First, corrected"]);

    // A release's post is what the update prompt says about it.
    relay.put(PUBLISH, "/v1/app/releases/2.0.1", json!({ "platforms": { "linux-x86_64": { "url": "https://x.io/l", "signature": "c2ln" } } })).await;
    let offer: Value = relay
        .http
        .get(format!("{}/v1/app/update/linux/x86_64/2.0.0", relay.url))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(offer["notes"], "Second\n\nFaster search");

    let gone = relay
        .http
        .delete(format!("{}/v1/app/news/second", relay.url))
        .bearer_auth(PUBLISH)
        .send()
        .await
        .unwrap();
    assert_eq!(gone.status().as_u16(), 200);
    let read: Value = relay
        .http
        .get(format!("{}/v1/app/news", relay.url))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(read["posts"].as_array().unwrap().len(), 1);
}
