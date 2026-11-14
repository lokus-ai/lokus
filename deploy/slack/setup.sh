#!/bin/bash
# Asks for what Lokus needs from the Slack app, one thing at a time, and saves it in .env.
# Nothing asked for here is a secret: a desktop app signs in without one.
set -e
ENV="$(cd "$(dirname "$0")/../.." && pwd)/.env"
touch "$ENV"

save() { # save NAME VALUE: replace the line if it is there, add it if not
  local tmp; tmp="$(mktemp)"
  grep -v "^$1=" "$ENV" > "$tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  mv "$tmp" "$ENV"
}

echo
echo "Slack app → Basic Information → App Credentials"
echo

while true; do
  read -r -p "1/2  Client ID (looks like 1234567890.1234567890): " CLIENT
  CLIENT="$(printf '%s' "$CLIENT" | tr -d '[:space:]')"
  if [[ "$CLIENT" =~ ^[0-9]+\.[0-9]+$ ]]; then break; fi
  echo "     That does not look like a Client ID. It is two numbers with a dot between them."
done
save LOKUS_SLACK_CLIENT_ID "$CLIENT"

read -r -p "2/2  App ID (starts with A, optional, Enter to skip): " APP
APP="$(printf '%s' "$APP" | tr -d '[:space:]')"
if [[ "$APP" =~ ^A[A-Z0-9]+$ ]]; then save LOKUS_SLACK_APP_ID "$APP"; fi

echo
echo "Saved to $ENV:"
grep -E "^LOKUS_SLACK_" "$ENV" | sed 's/^/  /'
echo
echo "Do NOT paste the Client Secret or Signing Secret anywhere. Lokus does not use them."
echo "Last check: in the Slack app, Agents → Slack Model Context Protocol (MCP) Server is ON."
