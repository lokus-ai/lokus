# Environment Variables

## Configuration

Lokus uses environment variables to configure various aspects of the application. These variables can be set in a `.env` file in the root directory.

## Available Variables

### Authentication

#### `VITE_AUTH_BASE_URL`
**Default:** `https://lokusmd.com` (production) or `http://localhost:3000` (development)

The base URL for the authentication backend server. This is used for:
- User sign up and sign in
- OAuth flows
- Email confirmation links
- User profile management

**Example:**
```bash
# Production (default)
VITE_AUTH_BASE_URL=https://lokusmd.com

# Local development
VITE_AUTH_BASE_URL=http://localhost:3000

# Custom backend
VITE_AUTH_BASE_URL=https://your-custom-backend.com
```

#### `AUTH_BASE_URL`
**Default:** Same as `VITE_AUTH_BASE_URL`

This is the Rust/Tauri backend equivalent of `VITE_AUTH_BASE_URL`. It's automatically set to match the frontend configuration but can be overridden if needed.

### Gmail Integration

#### `GOOGLE_CLIENT_ID`
**Required for Gmail integration**

Your Google OAuth Client ID from Google Cloud Console.

**Setup:**
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable Gmail API and Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Application type: "Desktop application"
6. Add authorized redirect URI: `http://localhost:8080/gmail-callback`
7. Copy the Client ID

#### `GOOGLE_CLIENT_SECRET`
**Required for Gmail integration**

Your Google OAuth Client Secret from Google Cloud Console (same setup as above).

## Platform-Specific Notes

### Windows
Environment variables are set the same way across all builds. The app will use `https://lokusmd.com` in production builds.

### macOS
Environment variables are set the same way across all builds. The app will use `https://lokusmd.com` in production builds.

### Linux
Environment variables are set the same way across all builds. The app will use `https://lokusmd.com` in production builds.

## Development vs Production

### Development Mode
When running `npm run dev`, the app uses:
- `VITE_AUTH_BASE_URL`: defaults to `http://localhost:3000`
- Reads from `.env` file if present

### Production Build
When building with `npm run build`:
- `VITE_AUTH_BASE_URL`: defaults to `https://lokusmd.com`
- Can be overridden by `.env` file during build time
- Environment variables are baked into the build

## Setup Instructions

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values:
   ```bash
   # For production builds
   VITE_AUTH_BASE_URL=https://lokusmd.com

   # For Gmail integration (optional)
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

3. Restart the development server or rebuild:
   ```bash
   # Development
   npm run dev

   # Production build
   npm run build
   ```

## Troubleshooting

### Email confirmation links showing localhost

**Problem:** After signing up, the email confirmation link points to localhost instead of your domain.

**Solution:**
1. Ensure `VITE_AUTH_BASE_URL=https://lokusmd.com` is set in your `.env` file
2. Rebuild the application with `npm run build`
3. Check that your backend server (lokusmd.com) is also configured to use the production URL for email links

### Authentication not working

**Problem:** Can't sign in or OAuth flows fail.

**Solution:**
1. Check that `VITE_AUTH_BASE_URL` points to a running backend server
2. Verify the backend server is accessible from your machine
3. Check browser console for error messages
4. Ensure the backend server is configured to accept requests from the desktop app

## Security Notes

- **Never commit `.env` files** with real credentials to version control
- The `.env` file is already in `.gitignore`
- Only use `.env.example` for documentation
- Rotate credentials if accidentally exposed
