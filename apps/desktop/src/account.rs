//! @part-of desktop
//! Signing in to a Lokus account through the person's browser (Google). The window asks for the
//! sign-in page to be opened and waits here for the browser to come back to this computer.

use std::time::Duration;

use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// The one address the account service is allowed to send the browser back to. It has to match
/// the redirect address registered with the service, so the port cannot be picked at random.
const PORT: u16 = 53682;
const PATH: &str = "/auth/callback";
const WAIT: Duration = Duration::from_secs(300);

fn page(title: &str, line: &str) -> String {
    format!(
        "<!doctype html><meta charset=utf-8><title>Lokus</title>\
<body style=\"font:16px -apple-system,sans-serif;text-align:center;padding-top:20vh\">\
<h2>{title}</h2><p>{line}</p>"
    )
}

fn failed(message: impl Into<String>) -> Value {
    json!({ "code": "sign_in_failed", "message": message.into() })
}

/// Open `url` in the browser and wait for it to return to this computer. Gives back what came
/// after the `?` in the address it returned to; the window reads the sign-in code from that.
#[tauri::command]
pub async fn account_browser_login(url: String) -> Result<String, Value> {
    if !url.starts_with("https://") {
        return Err(failed("the sign-in page must be a secure address"));
    }
    let listener = TcpListener::bind(("127.0.0.1", PORT)).await.map_err(|_| {
        failed("another sign-in is already waiting; finish or close it, then try again")
    })?;
    open::that(&url).map_err(|e| failed(format!("could not open the browser: {e}")))?;

    let came_back = async {
        loop {
            let (mut stream, _) = listener.accept().await?;
            let mut head = vec![0u8; 16384];
            let n = stream.read(&mut head).await?;
            let request = String::from_utf8_lossy(&head[..n]).into_owned();
            let target = request.split_whitespace().nth(1).unwrap_or_default();
            let query = target
                .strip_prefix(PATH)
                .and_then(|rest| rest.strip_prefix('?'))
                .map(str::to_string);
            let (status, body) = match &query {
                Some(q) if q.contains("error=") => (
                    "200 OK",
                    page("Sign-in did not finish", "Go back to Lokus to try again."),
                ),
                Some(_) => (
                    "200 OK",
                    page("Signed in", "You can close this tab and go back to Lokus."),
                ),
                None => ("404 Not Found", String::new()),
            };
            let reply = format!(
                "HTTP/1.1 {status}\r\ncontent-type: text/html; charset=utf-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(reply.as_bytes()).await?;
            if let Some(query) = query {
                return Ok::<String, std::io::Error>(query);
            }
        }
    };
    tokio::time::timeout(WAIT, came_back)
        .await
        .map_err(|_| failed("sign-in was not finished in the browser"))?
        .map_err(|e| failed(format!("sign-in failed: {e}")))
}
