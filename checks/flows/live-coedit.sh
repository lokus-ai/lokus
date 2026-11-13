#!/bin/zsh
# Flow: two instances of the real app edit one note together through a relay.
# Needs a desktop session. Start first, from the repo root:
#   LOKUS_DEV_TOKENS="ta:alice:alice@x.io,tb:bob:bob@x.io" PORT=8799 target/debug/lokus-server &
#   pnpm dev:ui &
#   LOKUS_DEV_SOCK=/tmp/lk-a.sock target/debug/lokus-desktop &
#   LOKUS_DEV_SOCK=/tmp/lk-b.sock target/debug/lokus-desktop &
# Usage: checks/flows/live-coedit.sh
set -u; SCRATCH=$(mktemp -d); mkdir -p $SCRATCH/live/a $SCRATCH/live/b
T=$SCRATCH/live
A() { LOKUS_DEV_SOCK=/tmp/lk-a.sock target/debug/lokus app "$@"; }; Bb() { LOKUS_DEV_SOCK=/tmp/lk-b.sock target/debug/lokus app "$@"; }
U=http://127.0.0.1:8799; H='content-type: application/json'
W=$(curl -s -X POST $U/v1/workspaces -H "authorization: Bearer ta" -H "$H" -d '{"name":"Team"}' | jq -r .id); I=$(curl -s -X POST $U/v1/workspaces/$W/invites -H "authorization: Bearer ta" -H "$H" -d '{"role":"editor"}' | jq -r .code); curl -s -X POST $U/v1/invites/$I/accept -H "authorization: Bearer tb" >/dev/null
A vault.use path=$T/a >/dev/null; Bb vault.use path=$T/b >/dev/null; sleep 1
A sync.connect server=$U workspace=$W token=ta >/dev/null; Bb sync.connect server=$U workspace=$W token=tb >/dev/null; sleep 2
echo "status: A=$(A app.state | jq -c '.sync|{status,role}') B=$(Bb app.state | jq -c '.sync|{status,role}')"
A note.create path=Shared.md text='# Shared' >/dev/null; sleep 2.5; echo "1. note created in A appears in B's folder: $(cat $T/b/Shared.md 2>&1)"
A note.open path=Shared.md >/dev/null; Bb note.open path=Shared.md >/dev/null; sleep 1.5
A editor.select anchor=999 >/dev/null; A editor.type --json '{"text":"\nhello from A"}' >/dev/null; sleep 1.2; echo "2. A types, B's editor shows: $(Bb editor.state | jq -c .text)"
Bb editor.select anchor=999 >/dev/null; Bb editor.type --json '{"text":"\nhello from B"}' >/dev/null; sleep 1.2; echo "3. B types, A's editor shows: $(A editor.state | jq -c .text)"
A editor.select anchor=8 >/dev/null; Bb editor.select anchor=999 >/dev/null; (A editor.type text=' [A-edit]' >/dev/null) & p1=$!; (Bb editor.type text=' [B-edit]' >/dev/null) & p2=$!; wait $p1 $p2; sleep 1.8
TA=$(A editor.state | jq -r .text); TB=$(Bb editor.state | jq -r .text); echo "4. both type at once -> A: $(echo "$TA" | tr '\n' '|')"; [ "$TA" = "$TB" ] && echo "   editors identical: yes" || echo "   editors identical: NO  B: $(echo "$TB" | tr '\n' '|')"
echo "5. presence: A sees $(A app.state | jq -c .peers), B sees $(Bb app.state | jq -c .peers); cursor drawn in A: $(A ui.measure selector='.cm-ySelectionCaret' | jq -c '.[".cm-ySelectionCaret"] != null')"
printf '\nadded by another program\n' >> $T/a/Shared.md; sleep 2.5; echo "6. outside edit on A's disk -> B editor: $(Bb editor.state | jq -c '.text[-26:]')  A editor: $(A editor.state | jq -c '.text[-26:]')"
sleep 1; cmp -s $T/a/Shared.md $T/b/Shared.md && echo "   files identical: yes" || { echo "   files identical: NO"; diff $T/a/Shared.md $T/b/Shared.md | head -6; }
echo "7. undo in A only undoes A's own typing:"; A editor.select anchor=999 >/dev/null; A editor.type text='MINE' >/dev/null; Bb editor.select anchor=0 >/dev/null; Bb editor.type text='THEIRS ' >/dev/null; sleep 1; A ui.key key=z meta=true >/dev/null; sleep 1.2; echo "   A: $(A editor.state | jq -c '.text')"
