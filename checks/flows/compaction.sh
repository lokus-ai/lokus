#!/bin/zsh
# Flow: compaction and the context meter in the real app, against the stand-in provider
# (checks/flows/mock-ai.py) with a made-up conversation and a 20,000-token limit.
# First, in another terminal, with nothing else on port 8798:
#   LOKUS_KEYCHAIN=io.lokus.flow-test ANTHROPIC_API_KEY=made-up LOKUS_CONTEXT_LIMIT=20000 pnpm dev
# Usage: checks/flows/compaction.sh        (from the repo root, after `cargo build -p lokus-cli`)
set -u; PORT=8798; U=http://127.0.0.1:$PORT
MOCK_TALK=1 MOCK_LIMIT=20000 python3 checks/flows/mock-ai.py $PORT >/dev/null 2>&1 & MOCK=$!; trap 'kill $MOCK' EXIT; sleep 1
app() { target/debug/lokus app "$@"; }
say() { app ai.ask text="$1" >/dev/null; }
noise() { printf 'Debugging log %s: the importer retry loop printed a stack trace for the flaky parser. %.0s' $1 {1..${2:-14}}; }
used() { app ai.state | jq -c '.usage.used'; }
talk() {
  app ai.new >/dev/null
  say "note We decided the Team plan price is \$18 per seat per month."
  say "note We decided the Enterprise plan price starts at \$4000 per year."
  for i in {1..$1}; do say "note Debugging round $i did not change anything. $(noise $i)"; done
}
summary() { app ai.state | jq -r '[.items[] | select(.kind=="summary") | .text] | join(" ") | gsub("\n"; " ") | .[0:150]'; }
app ai.configure provider=anthropic model=claude-opus-5-5 base_url=$U >/dev/null; app ai.open >/dev/null
talk 12; echo "1. a long conversation, as the provider counted it: $(used) of 20000"
app ai.compact note="keep the pricing decisions, drop the debugging" >/dev/null
echo "2. /compact keeping pricing: $(summary)"
say "What is the Team plan price per seat?"
echo "   the next request, as the provider counted it: $(used)   answer: $(app ai.state | jq -r '.items[-1].text')"
talk 12; app ai.compact note="keep the debugging findings, drop the pricing" >/dev/null
echo "3. /compact keeping debugging: $(summary)"
talk 12; for i in {13..24}; do say "note Late round $i. $(noise $i 40)"; done
echo "4. talked past 80% of the limit: compacted by itself $(app ai.state | jq -c '[.items[] | select(.kind=="summary") | .auto]'), now $(used), requests over the limit: $(curl -s $U/seen | jq '[.[] | select((.counted // 0) > 20000)] | length')"
say "What is the Team plan price per seat?"; echo "   answer: $(app ai.state | jq -r '.items[-1].text')"
