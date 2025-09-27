use std::env;

fn main() {
    // Load environment variables at compile time
    if let Ok(client_id) = env::var("GOOGLE_CLIENT_ID") {
        println!("cargo:rustc-env=GOOGLE_CLIENT_ID={}", client_id);
    } else {
        println!("cargo:warning=GOOGLE_CLIENT_ID not set in environment");
    }

    if let Ok(client_secret) = env::var("GOOGLE_CLIENT_SECRET") {
        println!("cargo:rustc-env=GOOGLE_CLIENT_SECRET={}", client_secret);
    } else {
        println!("cargo:warning=GOOGLE_CLIENT_SECRET not set in environment");
    }

    tauri_build::build()
}
