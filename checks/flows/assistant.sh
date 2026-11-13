#!/bin/zsh
# Flow: the assistant end to end, against a stand-in provider and tool server
# (checks/flows/mock-ai.py), so it needs no key and costs nothing. The mock
# scripts the model: search, read, edit a note, call the tool server, answer.
# Usage: checks/flows/assistant.sh        (from the repo root, after `cargo build -p lokus-cli`)
set -u; PORT=8798; U=http://127.0.0.1:$PORT; V=$(mktemp -d)
python3 checks/flows/mock-ai.py $PORT & MOCK=$!; trap "kill $MOCK" EXIT; sleep 1
reset() { printf '# Plan\r\n\r\nLaunch: TBD\r\nOwner: Sam\r\n' > $V/Plan.md; }
ask() { target/debug/lokus ai --vault $V q="when is launch?" base_url=$U mcp=$U/mcp "$@"; }
steps() { jq -c 'select(.type=="tool_done") | [.id, (if .ok then "ok" else .result end)]' | tr '\n' ' '; }
reset; echo "1. Claude format, nobody to approve: $(ANTHROPIC_API_KEY=k ask | steps)"
echo "   note unchanged: $(grep -ac 'Launch: TBD' $V/Plan.md)"
echo "2. Claude format, approved: $(ANTHROPIC_API_KEY=k ask approve=true | jq -rs '[.[] | select(.type=="text") | .delta] | join("")')"
print -r -- "   note edited, line endings kept: $(od -c $V/Plan.md | sed -n 2p)"
reset; echo "3. OpenAI format, approved: $(OPENAI_API_KEY=k ask approve=true provider=openai model=mock-model | jq -rs '[.[] | select(.type=="text") | .delta] | join("")')   note: $(grep -a Launch $V/Plan.md | tr -d '\r')"
echo "4. a refused key: $(ANTHROPIC_API_KEY=wrong ask 2>&1 | jq -c .code)   no key: $(env -u ANTHROPIC_API_KEY target/debug/lokus ai --vault $V q=hi base_url=$U 2>&1 | jq -c .code)"
echo "5. what was sent: $(curl -s $U/seen | jq -c '.[1] | {path, has_key: (.key != null), fields: (.body | keys), tools: (.body.tools | length)}')"
