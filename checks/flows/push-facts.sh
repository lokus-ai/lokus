#!/bin/zsh
# Flow: a team's backend pushes customer facts to the relay; they land in every device's notes.
# Usage: checks/flows/push-facts.sh   (run from the repo root after `cargo build`)
set -u; ROOT=$PWD; SCRATCH=$(mktemp -d)
T=$SCRATCH/push; B=$ROOT/target/debug; mkdir -p $T/a $T/b $T/c
# Only this flow's own relay is ever stopped: a relay someone else is running is left alone.
LOKUS_DEV_TOKENS="ta:alice:alice@x.io,tb:bob:bob@x.io,tc:carol:carol@x.io" LOKUS_DATA=$T/relay.sqlite PORT=8798 $B/lokus-server > $T/relay.log 2>&1 & RELAY=$!
sleep 1; U=http://127.0.0.1:8798; H='content-type: application/json'
W=$(curl -s -X POST $U/v1/workspaces -H "authorization: Bearer ta" -H "$H" -d '{"name":"Team"}' | jq -r .id)
IB=$(curl -s -X POST $U/v1/workspaces/$W/invites -H "authorization: Bearer ta" -H "$H" -d '{"role":"editor"}' | jq -r .code)
IC=$(curl -s -X POST $U/v1/workspaces/$W/invites -H "authorization: Bearer ta" -H "$H" -d '{"role":"viewer"}' | jq -r .code)
curl -s -X POST $U/v1/invites/$IB/accept -H "authorization: Bearer tb" >/dev/null; curl -s -X POST $U/v1/invites/$IC/accept -H "authorization: Bearer tc" >/dev/null
start() { $B/lokus sync --vault $T/$1 server=$U workspace=$W token=$2 >> $T/$1.log 2>&1 & echo $! > $T/$1.pid; }
push() { curl -s -w ' %{http_code}' -X POST $U/v1/ingest -H "authorization: Bearer $1" -H "$H" -d "$2"; }
prop() { grep "^$2:" "$1" 2>/dev/null | head -1; }

echo "--- 1. only an owner can make a key"
echo "bob (editor) asks: $(curl -s -o /dev/null -w '%{http_code}' -X POST $U/v1/workspaces/$W/keys -H 'authorization: Bearer tb' -H "$H" -d '{"label":"x"}')"
MADE=$(curl -s -X POST $U/v1/workspaces/$W/keys -H "authorization: Bearer ta" -H "$H" -d '{"label":"billing backend"}'); K=$(echo $MADE | jq -r .key); KID=$(echo $MADE | jq -r .id)
echo "alice (owner) gets a key starting: ${K:0:6}   the relay lists it without the key: $(curl -s $U/v1/workspaces/$W/keys -H 'authorization: Bearer ta' | jq -c '.[0] | keys')"

echo "--- 2. a fact pushed while no device is running waits"
echo "push: $(push $K '{"customer":"acme.com","name":"Acme","set":{"plan":"Growth","mrr":900,"renewal":"2027-02-01"}}')"
echo "waiting on the relay: $(sqlite3 $T/relay.sqlite 'select count(*) from inbox')"

echo "--- 3. devices start; the fact becomes a customer note on all of them"
start a ta; start b tb; start c tc; sleep 5
for d in a b c; do echo "$d: $(prop $T/$d/customers/Acme.md type) | $(prop $T/$d/customers/Acme.md plan) | $(prop $T/$d/customers/Acme.md mrr) | $(prop $T/$d/customers/Acme.md domain)"; done
echo "left on the relay: $(sqlite3 $T/relay.sqlite 'select count(*) from inbox')   written once, not once per device: $(ls $T/a/customers | tr '\n' ' ')"

echo "--- 4. a change arrives live and leaves its history"
echo "push: $(push $K '{"customer":"acme.com","set":{"plan":"Scale","mrr":1200}}')"; sleep 4
echo "alice: $(prop $T/a/customers/Acme.md plan) | $(prop $T/a/customers/Acme.md mrr)   bob: $(prop $T/b/customers/Acme.md mrr)"
echo "history on bob: $(grep -h '^title:' $T/b/customers/Acme/*.md 2>/dev/null | sort | tr '\n' '|')"

echo "--- 5. things that happen, a conversation and a person"
push $K '{"items":[
 {"customer":"acme.com","source":"linear","event":{"id":"ENG-7","kind":"issue","title":"Export fails over 50k rows","status":"todo","from":"Dana Whitlock"}},
 {"customer":"acme.com","source":"slack","event":{"id":"m1","kind":"message","thread":"export","channel":"#acme","direction":"in","from":"Dana Whitlock","text":"Any update on the export?"}},
 {"customer":"acme.com","person":{"name":"Dana Whitlock","email":"dana@acme.com","role":"Head of Ops"}}]}' >/dev/null; sleep 4
echo "carol (viewer) has: $(cd $T/c && find customers people -name '*.md' | sort | tr '\n' ' ')"
echo "the message: $(prop $T/c/customers/Acme/slack-m1.md direction) | $(prop $T/c/customers/Acme/slack-m1.md thread) | $(tail -1 $T/c/customers/Acme/slack-m1.md)"

echo "--- 6. the same thing sent again changes nothing; a new status moves it on"
N1=$(find $T/a -name '*.md' -not -path '*/.lokus/*' | wc -l | tr -d ' ')
push $K '{"customer":"acme.com","source":"linear","event":{"id":"ENG-7","kind":"issue","title":"Export fails over 50k rows","status":"todo","from":"Dana Whitlock"}}' >/dev/null; sleep 3
push $K '{"customer":"acme.com","source":"linear","event":{"id":"ENG-7","kind":"issue","title":"Export fails over 50k rows","status":"done","from":"Dana Whitlock"}}' >/dev/null; sleep 4
echo "notes before and after: $N1 and $(find $T/a -name '*.md' -not -path '*/.lokus/*' | wc -l | tr -d ' ')   status on bob: $(prop $T/b/customers/Acme/linear-ENG-7.md status)"

echo "--- 7. what the door refuses"
echo "no key: $(push nope '{"customer":"x"}')"
echo "a sign-in instead of a key: $(push ta '{"customer":"x"}')"
echo "no customer named: $(push $K '{"set":{"plan":"x"}}')"
echo "a path as a name: $(push $K '{"customer":"../../outside","event":{"id":"../../x","title":"t"}}')"; sleep 4
echo "nothing left the vault: $(ls $SCRATCH/push | tr '\n' ' ')   it became: $(ls $T/a/customers | grep -v Acme | tr '\n' ' ')"
echo "a fact that makes no sense is dropped, not retried: $(push $K '{"customer":"acme.com","event":{"kind":"nonsense","title":"t"}}')"; sleep 4
echo "relay inbox now: $(sqlite3 $T/relay.sqlite 'select count(*) from inbox')   a device said: $(grep -h fact_refused $T/*.log | head -1)"
echo "carol (viewer) tries to take facts: $(curl -s -o /dev/null -w '%{http_code}' -X POST $U/v1/workspaces/$W/inbox/claim -H 'authorization: Bearer tc' -H "$H" -d '{"device":"x"}')"

echo "--- 8. a removed key stops working"
curl -s -X DELETE $U/v1/workspaces/$W/keys/$KID -H "authorization: Bearer ta" | jq -c .
echo "push with it: $(push $K '{"customer":"acme.com","set":{"plan":"Hacked"}}')"; sleep 2; echo "plan is still: $(prop $T/a/customers/Acme.md plan)"
echo "the record: $(curl -s $U/v1/workspaces/$W/audit -H 'authorization: Bearer ta' | jq -c '[.[] | select(.action | startswith("key")) | .action]')"

for p in a b c; do kill $(cat $T/$p.pid) 2>/dev/null; done; kill $RELAY 2>/dev/null
