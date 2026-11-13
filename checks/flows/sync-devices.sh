#!/bin/zsh
# Flow: three devices with different roles sync folders through a real relay.
# Usage: checks/flows/sync-devices.sh   (run from the repo root after `cargo build`)
set -u; ROOT=$PWD; SCRATCH=$(mktemp -d)
T=$SCRATCH/sync; B=$ROOT/target/debug; rm -rf $T; mkdir -p $T/a $T/b $T/c
pkill -f lokus-server; LOKUS_DEV_TOKENS="ta:alice:alice@x.io,tb:bob:bob@x.io,tc:carol:carol@x.io" LOKUS_DATA=$T/relay.sqlite PORT=8799 $B/lokus-server > $T/relay.log 2>&1 &
sleep 1; U=http://127.0.0.1:8799; H='content-type: application/json'
W=$(curl -s -X POST $U/v1/workspaces -H "authorization: Bearer ta" -H "$H" -d '{"name":"Team"}' | jq -r .id)
IB=$(curl -s -X POST $U/v1/workspaces/$W/invites -H "authorization: Bearer ta" -H "$H" -d '{"role":"editor"}' | jq -r .code)
IC=$(curl -s -X POST $U/v1/workspaces/$W/invites -H "authorization: Bearer ta" -H "$H" -d '{"role":"viewer"}' | jq -r .code)
curl -s -X POST $U/v1/invites/$IB/accept -H "authorization: Bearer tb" >/dev/null; curl -s -X POST $U/v1/invites/$IC/accept -H "authorization: Bearer tc" >/dev/null
start() { $B/lokus sync --vault $T/$1 server=$U workspace=$W token=$2 >> $T/$1.log 2>&1 & echo $! > $T/$1.pid; }
show() { cat "$1" 2>/dev/null | tr '\n' '|' || echo "(missing)"; }
start a ta; start b tb; start c tc; sleep 1.5
echo "--- 1. alice writes a note"; mkdir -p $T/a/Projects; printf '# Plan\n\nline one\nline two\nline three\n' > $T/a/Projects/Plan.md; sleep 2.5; echo "bob:   $(show $T/b/Projects/Plan.md)"; echo "carol: $(show $T/c/Projects/Plan.md)"
echo "--- 2. bob goes offline; both edit different lines; bob also adds a note"; kill $(cat $T/b.pid); sleep 0.5
printf '# Plan\n\nline ONE (alice)\nline two\nline three\n' > $T/a/Projects/Plan.md; printf '# Plan\n\nline one\nline two\nline three (bob, offline)\n' > $T/b/Projects/Plan.md; printf 'written offline\n' > $T/b/Offline.md; sleep 1.5; start b tb; sleep 3.5
echo "alice: $(show $T/a/Projects/Plan.md)"; echo "bob:   $(show $T/b/Projects/Plan.md)"; echo "alice got bob's offline note: $(show $T/a/Offline.md)"
echo "--- 3. bob renames one note and deletes another"; mv $T/b/Projects/Plan.md $T/b/Projects/Roadmap.md; rm $T/b/Offline.md; sleep 3; echo "alice has: $(cd $T/a && find . -name '*.md' -not -path './.lokus/*' | sort | tr '\n' ' ')"; echo "alice trash: $(cd $T/a && find .lokus/trash -name '*.md' 2>/dev/null | sed 's|.*/||' | tr '\n' ' ')"
echo "--- 4. the viewer tries to edit"; printf 'carol was here\n' >> $T/c/Projects/Roadmap.md; sleep 2.5; echo "alice sees carol's edit: $(grep -c carol $T/a/Projects/Roadmap.md)"; tail -1 $T/c.log
echo "--- 5. a bad token"; $B/lokus sync --vault $T/c server=$U workspace=$W token=nope 2>&1 | jq -c .
echo "--- 6. same-line edits made at the same moment"; printf '# Plan\n\nline ONE (alice) + A\nline two\nline three (bob, offline)\n' > $T/a/Projects/Roadmap.md; printf '# Plan\n\nline ONE (alice) + B\nline two\nline three (bob, offline)\n' > $T/b/Projects/Roadmap.md; sleep 3; echo "alice: $(show $T/a/Projects/Roadmap.md)"; echo "bob:   $(show $T/b/Projects/Roadmap.md)"; cmp -s $T/a/Projects/Roadmap.md $T/b/Projects/Roadmap.md && echo "identical on both: yes" || echo "identical on both: NO"
echo "--- alice's log"; jq -c . $T/a.log | tail -8; echo "relay rows: $(sqlite3 $T/relay.sqlite 'select count(*) from updates')"
for p in a b c; do kill $(cat $T/$p.pid) 2>/dev/null; done; pkill -f lokus-server
