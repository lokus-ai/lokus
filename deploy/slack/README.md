# The Slack app behind the Slack connection

Slack's tool server (`https://mcp.slack.com/mcp`) only answers to a Slack app it knows: it has
no sign-up on the fly. So Lokus needs one Slack app of its own, and Lokus carries that app's
client ID (which is not a secret). Checked against Slack's docs on 2026-11-13:
<https://docs.slack.dev/ai/slack-mcp-server> and <https://docs.slack.dev/authentication/using-pkce>.

`manifest.json` is that app:

- **Desktop sign-in with no secret** (`pkce_enabled`). The person signs in in the browser and
  Slack returns to `http://localhost:53683/callback` on their own computer. Turning this on
  cannot be undone without Slack's support.
- **Acts as the person, never as a bot.** Only user permissions are asked for: search, read
  channels and threads, read files and people, send messages, react, read and write canvases.
  Creating channels, uploading files and Slack lists are left out until they are needed.

## Creating it

1. <https://api.slack.com/apps?new_app=1> → **From a manifest** → pick the workspace → paste
   `manifest.json`.
2. In the app's settings, **Agents** → switch on **Slack Model Context Protocol (MCP) Server**.
3. **Basic Information** → copy the **Client ID** (looks like `1234567890.1234567890`).

An app made this way is internal: it works in the workspace it was made in and nowhere else.
For anyone else's workspace, Slack requires the app to be published in the Slack Marketplace
(**Manage distribution** → submit for review).
