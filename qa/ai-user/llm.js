/**
 * LLM wiring for the AI user.
 *
 * Uses the Anthropic Messages API directly (fetch, no SDK dep) when
 * ANTHROPIC_API_KEY is set. Without a key it falls back to a documented
 * deterministic stub persona so the loop + reporting still run end-to-end.
 *
 *   env: ANTHROPIC_API_KEY  — enables real LLM decisions
 *        QA_LLM_MODEL       — model id (default claude-sonnet-5)
 */

const MODEL = process.env.QA_LLM_MODEL || 'claude-sonnet-5';

export function llmAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `You are a QA agent using the Lokus note-taking desktop app like a real human user, through a fixed action API.
Each turn you get: your goal, a screenshot, a DOM summary (visible interactive elements), recent console errors, and the result of your last action.
Decide ONE next action and reply with ONLY a JSON object (no markdown fences):

{"thought": "why", "action": "<name>", "args": {…}}

Actions:
- {"action":"click_text","args":{"text":"Create New Workspace"}} — click by visible text
- {"action":"new_note","args":{"name":"my-note"}} — create note via the New File button
- {"action":"type","args":{"text":"# Hello\\nworld"}} — type into the editor like a human ("\\n" = Enter)
- {"action":"press","args":{"keys":"ControlOrMeta+z"}}
- {"action":"open_slash_menu"} — type "/" and inspect the menu
- {"action":"choose_slash_item","args":{"query":"head"}}
- {"action":"link","args":{"target":"Other Note"}} — type [[Other Note]] with the suggestion popup
- {"action":"save"} — Cmd+S
- {"action":"split_pane"} / {"action":"graph_hotkey"} — real menu-accelerator shortcuts
- {"action":"force_reload"} — simulate quitting and reopening the app
- {"action":"report_issue","args":{"title":"…","expected":"…","actual":"…","severity":"blocker|major|minor"}} — file a bug the moment you SEE something broken, confusing, or surprising (data loss, blank screens, dead buttons, console errors, misleading UI). Be specific.
- {"action":"done","args":{"summary":"what you accomplished + overall impressions"}}

Rules:
- Act like a curious NON-TECHNICAL user: follow the goal, but poke at what looks off.
- ALWAYS verify outcomes: after typing, does the text appear? after reload, did it survive? If not → report_issue.
- Report every real problem you observe, then continue. Finish with "done" before you run out of steps.`;

export async function decideWithLLM({ goal, stepNum, maxSteps, observation, screenshotB64, history }) {
  const content = [
    {
      type: 'text',
      text:
        `GOAL: ${goal}\n\nStep ${stepNum}/${maxSteps}.\n\n` +
        `DOM SUMMARY:\n${JSON.stringify(observation.dom, null, 1).slice(0, 6000)}\n\n` +
        `RECENT CONSOLE ERRORS:\n${JSON.stringify(observation.consoleErrors.slice(-5))}\n\n` +
        `LAST ACTION RESULT: ${observation.lastResult}\n\n` +
        `ACTION HISTORY:\n${history.map((h) => `${h.n}. ${h.action} ${h.detail || ''} -> ${h.result}`).join('\n').slice(0, 3000)}\n\n` +
        `Reply with the JSON action only.`,
    },
  ];
  if (screenshotB64) {
    content.unshift({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: screenshotB64 },
    });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data.content?.find((b) => b.type === 'text')?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`LLM returned no JSON action: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

/**
 * Stub persona — used when no API key is present. A deterministic
 * "brand-new user" script driven by the same observations, so the agent loop,
 * verification, and reporting run identically. Documented in QA-SYSTEM.md.
 */
export function makeStubPersona() {
  let phase = 0;
  return function decide({ observation }) {
    const dom = observation.dom;
    // React to what we see, like the LLM would.
    if (dom.windowHidden) {
      return {
        thought: 'The window disappeared and nothing brings it back.',
        action: 'report_issue',
        args: {
          title: 'Window vanished during normal use',
          expected: 'The app window stays visible or can be restored',
          actual: 'Window is hidden with no way back',
          severity: 'blocker',
        },
      };
    }
    const script = [
      { action: 'new_note', args: { name: 'welcome' } },
      { action: 'type', args: { text: '# My first note\nTrying out Lokus today.' } },
      { action: 'read_editor' },
      { action: 'save' },
      { action: 'new_note', args: { name: 'second-note' } },
      { action: 'type', args: { text: 'This links back to ' } },
      { action: 'link', args: { target: 'welcome' } },
      { action: 'open_slash_menu' },
      { action: 'choose_slash_item', args: { query: 'head' } },
      { action: 'type', args: { text: 'Made with the slash menu' } },
      // The stub user "forgets" to save — then the app restarts.
      { action: 'force_reload' },
      { action: 'read_editor' },
      { action: '__verify_after_reload' },
      { action: 'done', args: { summary: 'Set up a vault, wrote two notes with a heading and a link, app restarted mid-session.' } },
    ];
    const step = script[Math.min(phase, script.length - 1)];
    phase++;
    if (step.action === '__verify_after_reload') {
      const lost = !dom.editorText || !dom.editorText.includes('slash menu');
      if (lost) {
        return {
          thought: 'My unsaved note text is gone after the restart.',
          action: 'report_issue',
          args: {
            title: 'Unsaved note content lost after app restart',
            expected: 'A notes app should not lose what I typed (autosave)',
            actual: `After the app restarted, the editor shows: "${(dom.editorText || '<empty>').slice(0, 80)}" — my slash-menu heading is gone`,
            severity: 'blocker',
          },
        };
      }
      return { thought: 'Content survived.', action: 'done', args: { summary: 'All content survived the restart.' } };
    }
    return { thought: `scripted step ${phase}`, ...step };
  };
}
