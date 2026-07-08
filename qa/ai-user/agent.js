/**
 * The agentic "AI user": an observe→decide→act loop over the LokusDriver.
 *
 * Given a goal ("you're a brand-new user, set up a vault and write two
 * notes…"), each step it looks at a screenshot + DOM summary, picks ONE
 * action, executes it through the same human-level API the scripted journeys
 * use, and files issues (report_issue) for anything broken/confusing.
 * Every step is logged with a screenshot.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { decideWithLLM, makeStubPersona, llmAvailable } from './llm.js';

export const AI_GOAL =
  "You're a brand-new non-technical user of Lokus (a markdown notes app). " +
  'Set up your workspace and write your first two notes: one with a big heading, one that links to the other. ' +
  'Save one of them, then the app will restart at some point — check nothing you wrote was lost. ' +
  'Report anything confusing, broken, or surprising along the way.';

export async function runAiUser(driver, rec, { maxSteps = 18, goal = AI_GOAL } = {}) {
  const useLLM = llmAvailable();
  const stub = useLLM ? null : makeStubPersona();
  const history = [];
  let lastResult = 'session started';

  await rec.step('ai:goal', `${goal} (decider: ${useLLM ? 'anthropic-llm' : 'stub-persona'})`);
  await driver.createVault('ai-user');

  for (let stepNum = 1; stepNum <= maxSteps; stepNum++) {
    const shotFile = await driver.screenshot(`ai-step-${stepNum}`);
    const observation = {
      dom: await driver.domSummary(),
      consoleErrors: rec.consoleErrors,
      lastResult,
    };

    let decision;
    try {
      if (useLLM) {
        const b64 = shotFile
          ? readFileSync(join(rec.dir, shotFile)).toString('base64')
          : null;
        decision = await decideWithLLM({
          goal,
          stepNum,
          maxSteps,
          observation,
          screenshotB64: b64,
          history,
        });
      } else {
        decision = stub({ observation });
      }
    } catch (err) {
      await rec.step('ai:decider-error', String(err).slice(0, 300));
      break;
    }

    await rec.step(`ai:${decision.action}`, `${JSON.stringify(decision.args || {})} — ${decision.thought || ''}`.slice(0, 300));

    if (decision.action === 'done') {
      rec.pass('AI user finished', decision.args?.summary || '');
      break;
    }

    try {
      lastResult = await executeAction(driver, rec, decision);
    } catch (err) {
      lastResult = `ACTION FAILED: ${String(err).slice(0, 300)}`;
      const shot = await driver.screenshot(`ai-action-failed-${stepNum}`);
      // A failing basic action is itself a finding for a "real user can't do X" class of bug.
      rec.aiIssue({
        title: `Action "${decision.action}" failed for the AI user`,
        expected: `A user can ${decision.action} ${JSON.stringify(decision.args || {})}`,
        actual: lastResult,
        screenshot: shot,
        severity: 'major',
      });
    }
    history.push({ n: stepNum, action: decision.action, detail: JSON.stringify(decision.args || {}), result: String(lastResult).slice(0, 120) });
  }
}

async function executeAction(d, rec, { action, args = {} }) {
  switch (action) {
    case 'click_text':
      await d.clickText(args.text);
      return `clicked "${args.text}"`;
    case 'click_selector':
      await d.click(args.selector);
      return `clicked ${args.selector}`;
    case 'new_note': {
      const f = await d.newNote(args.name || 'untitled');
      return `created note ${f}, editor open`;
    }
    case 'type': {
      const parts = String(args.text ?? '').split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) await d.type(parts[i]);
        if (i < parts.length - 1) await d.press('Enter');
      }
      const st = await d.readEditor();
      return `typed; editor now: "${(st?.text || '').slice(0, 100)}"`;
    }
    case 'press':
      await d.press(args.keys);
      return `pressed ${args.keys}`;
    case 'open_slash_menu': {
      const m = await d.openSlashMenu();
      return `slash menu open=${m.open}, items=${JSON.stringify(m.items.slice(0, 8))}`;
    }
    case 'choose_slash_item':
      await d.chooseSlashItem(args.query || '');
      return `chose slash item "${args.query}"`;
    case 'link': {
      const r = await d.link(args.target || '');
      const st = await d.readEditor();
      return `link inserted (popup=${r.popupOpen}); wikiLinks=${JSON.stringify(st?.wikiLinks)}`;
    }
    case 'save': {
      await d.save();
      const disk = await d.diskState();
      return `saved; files on disk: ${Object.keys(disk).join(', ') || '(none)'}`;
    }
    case 'split_pane': {
      const h = await d.splitPane();
      return `split emitted (handled by ${h} listeners)`;
    }
    case 'graph_hotkey': {
      const h = await d.graphHotkey();
      const dom = await d.domSummary();
      return `graph hotkey emitted (handled=${h}); editorPresent=${dom.editorPresent}`;
    }
    case 'force_reload': {
      await d.forceReload();
      const st = await d.readEditor();
      return `app restarted; editor now: "${(st?.text || '<empty/no editor>').slice(0, 100)}"`;
    }
    case 'read_editor': {
      const st = await d.readEditor();
      return st
        ? `editor: text="${st.text.slice(0, 150)}", headings=${JSON.stringify(st.headings)}, wikiLinks=${JSON.stringify(st.wikiLinks)}`
        : 'no editor on screen';
    }
    case 'report_issue': {
      const shot = await d.screenshot(`issue-${(args.title || 'x').slice(0, 30)}`);
      rec.aiIssue({
        title: args.title || 'AI-reported issue',
        expected: args.expected || '',
        actual: args.actual || '',
        severity: args.severity || 'minor',
        screenshot: shot,
      });
      return `issue filed: ${args.title}`;
    }
    default:
      return `unknown action "${action}" — ignored`;
  }
}
