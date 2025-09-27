use std::collections::HashMap;
use std::sync::Arc;
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, StatusCode, Method};
use hyper::body::Incoming;
use hyper_util::rt::TokioIo;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use serde_json;
use std::fs;
use http_body_util::Full;
use hyper::body::Bytes;

type HyperResponse = hyper::Response<Full<Bytes>>;

const OAUTH_PORT: u16 = 8080;

#[derive(Clone)]
pub struct OAuthServer {
    running: Arc<Mutex<bool>>,
}

impl OAuthServer {
    pub fn new() -> Self {
        Self {
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut running = self.running.lock().await;
        if *running {
            println!("[OAUTH SERVER] ⚠️ OAuth server already running");
            return Ok(());
        }

        // Check if another OAuth server is already running
        if self.is_oauth_server_running().await {
            println!("[OAUTH SERVER] ✅ Another OAuth server already running on port {}, using existing server", OAUTH_PORT);
            *running = true;
            return Ok(());
        }

        println!("[OAUTH SERVER] 🚀 Starting Gmail OAuth callback server on port {}", OAUTH_PORT);

        let addr = std::net::SocketAddr::from(([127, 0, 0, 1], OAUTH_PORT));
        let listener = TcpListener::bind(addr).await?;

        *running = true;
        drop(running);

        println!("[OAUTH SERVER] 🌐 Gmail OAuth callback server running at http://localhost:{}", OAUTH_PORT);
        println!("[OAUTH SERVER] 📍 Callback URL: http://localhost:{}/gmail-callback", OAUTH_PORT);

        let running_clone = self.running.clone();
        tokio::spawn(async move {
            loop {
                let (stream, _) = match listener.accept().await {
                    Ok(conn) => conn,
                    Err(e) => {
                        eprintln!("[OAUTH SERVER] ❌ Accept error: {}", e);
                        continue;
                    }
                };

                let io = TokioIo::new(stream);
                let running_check = running_clone.clone();
                
                tokio::task::spawn(async move {
                    if let Err(err) = http1::Builder::new()
                        .serve_connection(io, service_fn(handle_request))
                        .await
                    {
                        eprintln!("[OAUTH SERVER] ❌ Connection error: {}", err);
                    }
                });

                // Check if server should stop
                if !*running_check.lock().await {
                    break;
                }
            }
        });

        Ok(())
    }

    #[allow(dead_code)]
    pub async fn is_running(&self) -> bool {
        *self.running.lock().await
    }

    async fn is_oauth_server_running(&self) -> bool {
        // Test if the OAuth server is responding on the expected port
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(1000))
            .build()
            .unwrap_or_default();

        match client.get(&format!("http://localhost:{}/health", OAUTH_PORT)).send().await {
            Ok(response) => {
                if response.status().is_success() {
                    println!("[OAUTH SERVER] 🔍 Found existing OAuth server responding on port {}", OAUTH_PORT);
                    true
                } else {
                    false
                }
            }
            Err(_) => false,
        }
    }

    #[allow(dead_code)]
    pub async fn stop(&self) {
        let mut running = self.running.lock().await;
        *running = false;
        println!("[OAUTH SERVER] 🛑 OAuth server stopped");
    }
}

async fn handle_request(req: Request<Incoming>) -> Result<HyperResponse, Box<dyn std::error::Error + Send + Sync>> {
    let uri = req.uri();
    let path = uri.path();
    let method = req.method();

    println!("[OAUTH SERVER] 📥 Received request: {} {}", method, uri);

    match (method, path) {
        (&Method::GET, "/gmail-callback") => handle_gmail_callback(req).await,
        (&Method::POST, "/complete-auth") => handle_complete_auth(req).await,
        (&Method::GET, "/health") => handle_health_check().await,
        _ => {
            Ok(hyper::Response::builder()
                .status(StatusCode::NOT_FOUND)
                .body(Full::new(Bytes::from("Not Found")))?)
        }
    }
}

async fn handle_gmail_callback(req: Request<Incoming>) -> Result<HyperResponse, Box<dyn std::error::Error + Send + Sync>> {
    let uri = req.uri();
    let query_params = parse_query_params(uri.query().unwrap_or(""));

    let code = query_params.get("code");
    let state = query_params.get("state");
    let error = query_params.get("error");

    if let Some(error) = error {
        println!("[OAUTH SERVER] ❌ OAuth error: {}", error);
        return Ok(hyper::Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .header("Content-Type", "text/html")
            .body(Full::new(Bytes::from(format!(
                r#"
                <html>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #dc3545;">❌ Authentication Failed</h1>
                    <p>Error: {}</p>
                    <p>You can close this window and try again.</p>
                  </body>
                </html>
                "#,
                error
            ))))?);
    }

    if code.is_none() || state.is_none() {
        println!("[OAUTH SERVER] ❌ Missing code or state");
        return Ok(hyper::Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .header("Content-Type", "text/html")
            .body(Full::new(Bytes::from(
                r#"
                <html>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #dc3545;">❌ Authentication Failed</h1>
                    <p>Missing authorization code or state parameter.</p>
                    <p>You can close this window and try again.</p>
                  </body>
                </html>
                "#
            )))?);
    }

    let code = code.unwrap();
    let state = state.unwrap();

    println!("[OAUTH SERVER] ✅ Received valid OAuth callback");
    println!("[OAUTH SERVER] 📋 Code: {}...", &code[..20.min(code.len())]);
    println!("[OAUTH SERVER] 📋 State: {}", state);

    // Write the auth data to a temporary file for the Tauri app to pick up
    if let Err(e) = write_auth_callback(code, state) {
        println!("[OAUTH SERVER] ❌ Failed to write auth data: {}", e);
    }

    Ok(hyper::Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/html")
        .body(Full::new(Bytes::from(format!(
            r#"
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #28a745;">✅ Authentication Successful!</h1>
                <p>Gmail connection completed successfully.</p>
                <p>You can close this window and return to Lokus.</p>
                <script>
                  // Auto-close after 3 seconds
                  setTimeout(() => {{
                    window.close();
                  }}, 3000);
                </script>
              </body>
            </html>
            "#
        ))))?)
}

async fn handle_complete_auth(_req: Request<Incoming>) -> Result<HyperResponse, Box<dyn std::error::Error + Send + Sync>> {
    Ok(hyper::Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .body(Full::new(Bytes::from(r#"{"success": true}"#)))?)
}

async fn handle_health_check() -> Result<HyperResponse, Box<dyn std::error::Error + Send + Sync>> {
    Ok(hyper::Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .body(Full::new(Bytes::from(format!(
            r#"{{"status": "ok", "port": {}}}"#,
            OAUTH_PORT
        ))))?)
}

fn parse_query_params(query: &str) -> HashMap<String, String> {
    let mut params = HashMap::new();
    for pair in query.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            params.insert(
                urlencoding::decode(key).unwrap_or_default().to_string(),
                urlencoding::decode(value).unwrap_or_default().to_string(),
            );
        }
    }
    params
}

fn write_auth_callback(code: &str, state: &str) -> Result<(), Box<dyn std::error::Error>> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let temp_dir = home_dir.join(".lokus").join("temp");
    
    // Ensure temp directory exists
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)?;
    }
    
    let auth_file = temp_dir.join("gmail_auth_callback.json");
    let auth_data = serde_json::json!({
        "code": code,
        "state": state,
        "timestamp": chrono::Utc::now().timestamp()
    });
    
    fs::write(&auth_file, serde_json::to_string_pretty(&auth_data)?)?;
    println!("[OAUTH SERVER] 💾 Auth data written to: {:?}", auth_file);
    
    Ok(())
}