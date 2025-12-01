use std::env;

fn main() {
    // Google OAuth credentials (optional - Gmail integration not in this release)
    if let Ok(_client_id) = env::var("GOOGLE_CLIENT_ID") {
    }
    // Disabled warning - Gmail not shipping in this release
    // else {
    //     println!("cargo:warning=GOOGLE_CLIENT_ID not set in environment");
    // }

    if let Ok(_client_secret) = env::var("GOOGLE_CLIENT_SECRET") {
    }
    // Disabled warning - Gmail not shipping in this release
    // else {
    //     println!("cargo:warning=GOOGLE_CLIENT_SECRET not set in environment");
    // }

    tauri_build::build()
}
