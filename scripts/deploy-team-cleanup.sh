#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to a session or direct connection}"
: "${SUPABASE_PROJECT_ID:?Set SUPABASE_PROJECT_ID}"
: "${SUPABASE_URL:?Set SUPABASE_URL}"

TEAM_UPLOAD_CLEANUP_TOKEN="${TEAM_UPLOAD_CLEANUP_TOKEN:-$(openssl rand -hex 32)}"
export TEAM_UPLOAD_CLEANUP_TOKEN

npx supabase secrets set \
  "TEAM_UPLOAD_CLEANUP_TOKEN=${TEAM_UPLOAD_CLEANUP_TOKEN}" \
  --project-ref "${SUPABASE_PROJECT_ID}"

printf '%s\n' \
  "select vault.create_secret(:'project_url', 'lokus_project_url', 'Lokus Edge Function project URL')" \
  "where not exists (select 1 from vault.secrets where name = 'lokus_project_url');" \
  "select vault.update_secret(id, :'project_url', 'lokus_project_url', 'Lokus Edge Function project URL')" \
  "from vault.secrets where name = 'lokus_project_url';" \
  "select vault.create_secret(:'cleanup_token', 'lokus_team_cleanup_token', 'Lokus team upload cleanup token')" \
  "where not exists (select 1 from vault.secrets where name = 'lokus_team_cleanup_token');" \
  "select vault.update_secret(id, :'cleanup_token', 'lokus_team_cleanup_token', 'Lokus team upload cleanup token')" \
  "from vault.secrets where name = 'lokus_team_cleanup_token';" \
  | psql "${SUPABASE_DB_URL}" \
      -X -q -v ON_ERROR_STOP=1 \
      -v project_url="${SUPABASE_URL}" \
      -v cleanup_token="${TEAM_UPLOAD_CLEANUP_TOKEN}"

npx supabase functions deploy team-upload-cleanup \
  --project-ref "${SUPABASE_PROJECT_ID}" \
  --no-verify-jwt \
  --use-api

npx supabase db push \
  --db-url "${SUPABASE_DB_URL}" \
  --include-all \
  --skip-vault \
  --yes
