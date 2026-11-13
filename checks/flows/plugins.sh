#!/bin/zsh
# Flow: plugins in the real app. Installs the example plugin and a hostile
# fixture, runs both, and shows what the sandbox allowed.
# Needs a desktop session. Start first, from the repo root:
#   pnpm dev:ui &
#   LOKUS_DEV_SOCK=/tmp/lk-a.sock target/debug/lokus-desktop &
# Usage: checks/flows/plugins.sh
set -u; V=$(mktemp -d); printf '# Hello\n\none two three four five\n' > $V/Note.md
A() { LOKUS_DEV_SOCK=/tmp/lk-a.sock target/debug/lokus app "$@"; }
A vault.use path=$V >/dev/null
for p in examples/plugins/word-count checks/fixtures/plugins/prober; do A plugins.install from=$PWD/$p | jq -c '{installed: .id, permissions}'; done
echo "1. a plugin starts switched off: $(A plugins.list | jq -c 'map({id, enabled})')"
A plugins.enable id=word-count >/dev/null; A plugins.enable id=prober >/dev/null; A plugins.reload >/dev/null
A note.open path=Note.md >/dev/null
echo "2. the example plugin's command counts the open note: $(A word-count.count | jq -c .)   toast: $(A app.state | jq -c .notice)"
A word-count.view.stats >/dev/null; sleep 1
echo "3. its view opens in the side panel: $(A app.state | jq -c '.panel | {plugin, view}')  frame: $(A ui.measure selector='.plugin-view' | jq -c '.[".plugin-view"] | {width, height}')"
A editor.select anchor=999 >/dev/null; A editor.type --json '{"text":"\n/Call"}' >/dev/null; sleep 0.6; A ui.click text=Callout >/dev/null
echo "4. its slash-menu entry inserts: $(A editor.state | jq -c '.text[-12:]')"
echo "5. the hostile plugin (granted only vault:read) tried:"
A prober.probe | jq -r 'to_entries[] | select(.key != "origin") | "   \(.key): \(if .value.allowed then "ALLOWED" else "refused (\(.value.why))" end)"'
echo "   expected: readNote ALLOWED, everything else refused"
echo "6. the note is untouched: $(head -1 $V/Note.md)   vault still: $(A app.state | jq -r .vault.name)"
A plugins.remove id=prober >/dev/null; A plugins.reload >/dev/null
echo "7. removed plugin's command is gone: $(A prober.probe 2>&1 | jq -c .code)"
