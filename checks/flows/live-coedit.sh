#!/bin/zsh
# Flow: two instances of the real app edit one note together through a relay.
# Needs a desktop session. Start first, from the repo root:
#   pnpm dev:ui &
#   LOKUS_DEV_SOCK=/tmp/lk-a.sock target/debug/lokus-desktop &
#   LOKUS_DEV_SOCK=/tmp/lk-b.sock target/debug/lokus-desktop &
# The flow starts its own relay (and stops and restarts it, to stand in for a lost connection).
# Usage: checks/flows/live-coedit.sh
set -u; SCRATCH=$(mktemp -d); mkdir -p $SCRATCH/live/a $SCRATCH/live/b
T=$SCRATCH/live
A() { LOKUS_DEV_SOCK=/tmp/lk-a.sock target/debug/lokus app "$@"; }; Bb() { LOKUS_DEV_SOCK=/tmp/lk-b.sock target/debug/lokus app "$@"; }
U=http://127.0.0.1:8799; H='content-type: application/json'
relay() { LOKUS_DEV_TOKENS="ta:alice:alice@x.io,tb:bob:bob@x.io" LOKUS_DATA=$SCRATCH/relay.sqlite PORT=8799 target/debug/lokus-server > $SCRATCH/relay.log 2>&1 & echo $! > $SCRATCH/relay.pid; for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null $U/health && break; sleep 0.3; done; }
norelay() { kill $(cat $SCRATCH/relay.pid) 2>/dev/null; sleep 0.6; }
text() { "$1" editor.state | jq -r .text | tr '\n' '|'; }
relay; trap 'norelay' EXIT
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
echo "8. A deletes a paragraph at the moment B types inside it:"; A editor.setText --json '{"text":"# Shared\n\nkeep this line\nthe doomed paragraph\nand this one stays\n"}' >/dev/null; sleep 1.5; A editor.select anchor=25 head=46 >/dev/null; Bb editor.select anchor=35 >/dev/null; (A editor.delete >/dev/null) & p1=$!; (Bb editor.type text='[B TYPED HERE]' >/dev/null) & p2=$!; wait $p1 $p2; sleep 1.8
TA=$(text A); TB=$(text Bb); echo "   A: $TA"; [ "$TA" = "$TB" ] && echo "   editors identical: yes   B's words survived: $(echo "$TA" | grep -c 'B TYPED HERE')" || echo "   editors identical: NO   B: $TB"
echo "9. the connection is lost; both keep typing; it comes back:"; norelay; sleep 1; echo "   while lost: A=$(A app.state | jq -r .sync.status) B=$(Bb app.state | jq -r .sync.status)"; A editor.select anchor=0 >/dev/null; A editor.type --json '{"text":"A while offline\n"}' >/dev/null; Bb editor.select anchor=999 >/dev/null; Bb editor.type --json '{"text":"\nB while offline"}' >/dev/null; sleep 1; relay; sleep 6
TA=$(text A); TB=$(text Bb); echo "   back: A=$(A app.state | jq -r .sync.status) B=$(Bb app.state | jq -r .sync.status)"; echo "   A: $TA"; [ "$TA" = "$TB" ] && echo "   editors identical: yes   both offline edits kept: $(echo "$TA" | grep -c 'A while offline.*B while offline')" || echo "   editors identical: NO   B: $TB"
sleep 1.5; cmp -s $T/a/Shared.md $T/b/Shared.md && echo "   files identical: yes" || echo "   files identical: NO"
echo "10. many quick edits from both at once:"; A editor.select anchor=0 >/dev/null; Bb editor.select anchor=999 >/dev/null; (for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do A editor.type text="a$i " >/dev/null; done) & p1=$!; (for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do Bb editor.type text="b$i " >/dev/null; done) & p2=$!; wait $p1 $p2; sleep 3
TA=$(text A); TB=$(text Bb); [ "$TA" = "$TB" ] && echo "   editors identical: yes   A's 30 in order: $(echo "$TA" | grep -c 'a1 a2 a3 .*a29 a30')   B's 30 in order: $(echo "$TA" | grep -c 'b1 b2 b3 .*b29 b30')" || { echo "   editors identical: NO"; echo "   A: $TA"; echo "   B: $TB"; }
echo "11. the connection is lost; A deletes a note while B keeps writing in it; it comes back:"; A note.create path=Doomed.md text='first line' >/dev/null; sleep 4; Bb note.open path=Doomed.md >/dev/null; sleep 1.5; echo "   B has open: $(Bb app.state | jq -r .active) reading: $(text Bb)"; norelay; sleep 1; A note.delete path=Doomed.md >/dev/null; Bb editor.select anchor=999 >/dev/null; Bb editor.type --json '{"text":"\nB kept writing while A deleted it"}' >/dev/null; sleep 1.5; relay; sleep 7
echo "   A's folder: $(cd $T/a && ls *.md | tr '\n' ' ')  A's trash: $(cd $T/a && find .lokus/trash -name '*.md' 2>/dev/null | sed 's|.*/||' | tr '\n' ' ')"; echo "   B's folder: $(cd $T/b && ls *.md | tr '\n' ' ')  B's trash: $(cd $T/b && find .lokus/trash -name '*.md' 2>/dev/null | sed 's|.*/||' | tr '\n' ' ')"; echo "   B's words are still somewhere on B's disk: $(grep -rl 'B kept writing' $T/b 2>/dev/null | grep -v '\.sqlite' | sed "s|$T/b/||" | tr '\n' ' ')"
echo "12. a brand-new device signs in and pulls everything:"; mkdir -p $T/new; (target/debug/lokus sync --vault $T/new server=$U workspace=$W token=ta > $T/new.log 2>&1 & echo $! > $T/new.pid); sleep 5; kill $(cat $T/new.pid) 2>/dev/null; echo "   it has: $(cd $T/new && ls *.md 2>/dev/null | tr '\n' ' ')"; cmp -s $T/a/Shared.md $T/new/Shared.md && echo "   Shared.md matches A byte for byte: yes" || echo "   Shared.md matches A: NO"
A sync.disconnect >/dev/null; Bb sync.disconnect >/dev/null
