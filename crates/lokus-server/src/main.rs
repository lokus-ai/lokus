//! @part-of server
use std::path::PathBuf;

use lokus_server::auth::Auth;
use lokus_server::store::Store;
use lokus_server::{router, App, Limits};

#[tokio::main]
async fn main() {
    let data =
        PathBuf::from(std::env::var("LOKUS_DATA").unwrap_or_else(|_| "lokus-relay.sqlite".into()));
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8787u16);
    let auth = match Auth::from_env() {
        Ok(auth) => auth,
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(2);
        }
    };
    auth.warn_if_unusable().await;
    if matches!(auth, Auth::Dev(_)) {
        eprintln!("warning: using development tokens; do not expose this to the internet");
    }
    let store = Store::open(&data).unwrap_or_else(|e| {
        eprintln!("cannot open {}: {e}", data.display());
        std::process::exit(2);
    });
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .unwrap_or_else(|e| {
            eprintln!("cannot listen on port {port}: {e}");
            std::process::exit(2);
        });
    eprintln!(
        "lokus relay listening on :{port}, data in {}",
        data.display()
    );
    // Releases and news can be published only when a key of 24 characters or more is set.
    let publish_key = std::env::var("LOKUS_PUBLISH_KEY")
        .ok()
        .filter(|k| !k.is_empty());
    match publish_key.as_deref().map(str::len) {
        Some(n) if n < 24 => {
            eprintln!("warning: LOKUS_PUBLISH_KEY is shorter than 24 characters and is ignored")
        }
        Some(_) => eprintln!("releases and news can be published with LOKUS_PUBLISH_KEY"),
        None => {}
    }
    let mailer = lokus_server::mail::Mailer::from_env();
    match &mailer {
        Some(m) => eprintln!("invitations are emailed; their links point at {}", m.site),
        None => eprintln!("no LOKUS_MAIL_KEY: invitations are handed over as links, not emailed"),
    }
    let app = App::build(store, auth, Limits::from_env(), publish_key, mailer);
    let serve = axum::serve(listener, router(app));
    if let Err(e) = serve
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
    {
        eprintln!("server stopped: {e}");
    }
}
