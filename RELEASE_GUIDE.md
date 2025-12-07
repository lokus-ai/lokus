# 🚀 Lokus App Store Release Guide

This guide explains how to build, sign, and upload Lokus to the Mac App Store.

## Prerequisites

Ensure you have the following installed and configured:
- **Xcode** (latest version)
- **Node.js** & **npm**
- **Rust** & **Cargo**
- **Apple Developer Account** with:
    - `3rd Party Mac Developer Application` certificate
    - `3rd Party Mac Developer Installer` certificate
    - App Store Connect app record created

## 1. Build & Sign

We have automated the complex build and signing process into a single command.

Run the following command in your terminal:

```bash
npm run release:appstore
```

This script will:
1.  Build the Tauri app in release mode.
2.  Copy the embedded provisioning profile.
3.  Codesign the `.app` bundle.
4.  Package it into a `.pkg` installer.
5.  Sign the `.pkg` installer.

**Output:**
The final signed package will be located at:
`src-tauri/target/release/bundle/macos/Lokus-Signed.pkg`

## 2. Validate & Upload

Once you have the `Lokus-Signed.pkg`, you need to upload it to App Store Connect. You can use **Transporter** (GUI) or `xcrun altool` (CLI).

### Option A: Transporter (Recommended)
1.  Download **Transporter** from the Mac App Store.
2.  Open Transporter and sign in with your Apple ID.
3.  Drag and drop `src-tauri/target/release/bundle/macos/Lokus-Signed.pkg` into the window.
4.  Click **Deliver**.

### Option B: Command Line (xcrun altool)
If you prefer the command line or want to automate this in CI/CD:

1.  **Validate** the app first:
    ```bash
    xcrun altool --validate-app -f "src-tauri/target/release/bundle/macos/Lokus-Signed.pkg" -t ios --apiKey <YOUR_API_KEY_ID> --apiIssuer <YOUR_ISSUER_ID> --verbose
    ```
    *(Note: `-t ios` is often used for macOS apps in altool, or use `-t osx` if supported by your version)*

2.  **Upload** the app:
    ```bash
    xcrun altool --upload-app -f "src-tauri/target/release/bundle/macos/Lokus-Signed.pkg" -t ios --apiKey <YOUR_API_KEY_ID> --apiIssuer <YOUR_ISSUER_ID> --verbose
    ```

## Troubleshooting

-   **Provisioning Profile Errors**: Ensure `src-tauri/embedded.provisionprofile` is valid and matches your distribution certificate.
-   **Signing Errors**: Verify your certificates are in your Keychain:
    ```bash
    security find-identity -v -p codesigning
    ```
    You should see "3rd Party Mac Developer Application" and "Installer" identities.

## 3. Submit to App Store (From TestFlight)

Since you have already uploaded your build and it is available in TestFlight, follow these steps to release it to the public:

1.  **Log in to App Store Connect**: Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) and select your app.
2.  **Prepare for Submission**:
    -   Click on **App Store** in the top menu.
    -   In the left sidebar, verify you have a version ready (e.g., "1.0 Prepare for Submission"). If not, click the **(+)** next to **macOS App** to create a new version.
3.  **Select Build**:
    -   Scroll down to the **Build** section.
    -   Click **(+) Add Build**.
    -   Select the build number you verified in TestFlight (e.g., `1.3.13`) and click **Done**.
4.  **Fill Metadata**:
    -   **Screenshots**: Upload screenshots for the required Mac sizes.
    -   **Promotional Text**: (Optional) Short text about latest features.
    -   **Description**: Detailed description of your app.
    -   **Keywords**: Comma-separated search terms.
    -   **Support URL**: Link to your support page.
    -   **Marketing URL**: (Optional) Link to your marketing page.
    -   **Copyright**: e.g., "2025 Pratham Patel".
5.  **App Review Information**:
    -   **Sign-in required?**: If your app requires a login, provide a demo account username and password for the reviewer.
    -   **Notes**: specific instructions for the reviewer (e.g., "This is a note-taking app...").
6.  **Submit**:
    -   Click **Save** at the top right.
    -   Click **Add for Review**.
    -   Answer the compliance questions (Encryption, etc.).
    -   Click **Submit to App Review**.

**Timeline**:
-   **Waiting for Review**: usually 24-48 hours.
-   **In Review**: usually takes a few hours.
-   **Ready for Sale**: Once approved, you can release it immediately or schedule a date.

## 4. Pre-Submission Checklist (Don't Forget These!)

Yes, the technical part is done! But to ensure a smooth review, double-check these common pitfalls:

### ✅ Export Compliance
Since you use `crypto-js`, you are using encryption.
-   When you click "Submit", Apple will ask about encryption.
-   **Usually**: If you only use standard encryption (like HTTPS/SSL) or standard algorithms for authentication/integrity, you can often select "Yes" to encryption, but "Yes" to the exemption (e.g., it's standard/open source).
-   **Action**: Be prepared to answer the "Export Compliance Information" dialog.

### ✅ Demo Account
**Crucial**: If your app has a login screen, you **MUST** provide a working username and password in the "App Review Information" section.
-   If the reviewer cannot log in, they will **reject** the app immediately.
-   Create a dummy account (e.g., `reviewer@lokus.app` / `Password123!`) specifically for them.

### ✅ Privacy Policy URL
-   You must have a valid URL (e.g., `https://lokusmd.com/privacy`) linked in the metadata.

### ✅ "Sign in with Apple"
-   If you offer Google/Facebook/GitHub login, you **MUST** also offer "Sign in with Apple". If you only use email/password, you are fine.

### ✅ Data Collection (App Privacy)
-   You will need to fill out the "App Privacy" section in the sidebar.
-   Disclose if you collect data (Analytics, Crash Logs, User Content).
-   Since Lokus is "Local-first", you might collect very little, which is a great selling point!


