#!/usr/bin/env node
/**
 * Lokus AI-QA runner — `npm run qa`
 *
 *   node qa/run.js                 # scripted journeys + AI user + monkey pass
 *   node qa/run.js --journeys      # scripted journeys only
 *   node qa/run.js --ai            # AI user + monkey only
 *   node qa/run.js --filter 01     # only journeys whose id matches
 *   node qa/run.js --update-baseline   # accept current failures as known
 *
 * Exit code: 1 if any journey fails/crashes that is NOT in qa/baseline.json
 * (CI-wireable: baseline holds the known bugs until they're fixed).
 */

import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { QaBackend } from './harness/backend.js';
import { LokusDriver, createQaContext } from './harness/driver.js';
import { Recorder } from './harness/recorder.js';
import { ensureDevServer } from './harness/server.js';
import { journeys } from './journeys/index.js';
import { runAiUser } from './ai-user/agent.js';
import { runMonkey } from './ai-user/monkey.js';
import { writeReport } from './reporter/report.js';
import { llmAvailable } from './ai-user/llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);

const runJourneys = !has('--ai');
const runAi = !has('--journeys');
const filter = arg('--filter');

async function main() {
  const startedAt = new Date().toISOString();
  const runDir = join(repoRoot, 'qa', 'reports', `run-${startedAt.replace(/[:.]/g, '-')}`);
  await fs.mkdir(runDir, { recursive: true });

  const server = await ensureDevServer({ cwd: repoRoot });
  const backend = new QaBackend();
  const runRoot = await backend.init();
  console.error(`[qa] vault sandbox: ${runRoot}`);

  const browser = await chromium.launch({ headless: !has('--headed') });
  const results = [];

  const runOne = async (id, title, expected, fn) => {
    console.error(`[qa] ▶ ${id} — ${title}`);
    const rec = new Recorder(runDir, id);
    await rec.init();
    backend.resetSession();
    const context = await createQaContext(browser, backend);
    const driver = new LokusDriver(context, backend, rec, { baseURL: server.url });
    try {
      await fn(driver, rec);
    } catch (err) {
      const shot = await driver.screenshot('crash').catch(() => null);
      rec.crash({
        title: `${id} crashed the harness/app`,
        actual: String(err?.stack || err).slice(0, 800),
        screenshot: shot,
      });
    } finally {
      await driver.dispose();
      await context.close().catch(() => {});
    }
    const json = rec.toJSON();
    json.title = title;
    json.expected = expected;
    results.push(json);
    console.error(`[qa]   ${json.status.toUpperCase()} (${json.findings.length} findings)`);
  };

  if (runJourneys) {
    for (const j of journeys) {
      if (filter && !j.id.includes(filter)) continue;
      await runOne(j.id, j.title, j.expected, (d, t) => j.run(d, t, { repoRoot }));
    }
  }

  if (runAi && !filter) {
    await runOne(
      'ai-user',
      'AI user: brand-new user sets up a vault and writes first notes',
      'A non-technical user can accomplish the basics without hitting anything broken, confusing, or lossy.',
      (d, t) => runAiUser(d, t)
    );
    await runOne(
      'ai-monkey',
      'Monkey/explorer: chaotic input must not crash or blank the app',
      'Huge pastes, rapid keys, weird unicode, and hotkey hammering never produce unhandled errors or a blank app.',
      (d, t) => runMonkey(d, t)
    );
  }

  const meta = {
    startedAt,
    runner: 'playwright-chromium + real vite frontend + disk-backed tauri mock (real temp vault folders)',
    aiDecider: llmAvailable() ? `anthropic:${process.env.QA_LLM_MODEL || 'claude-sonnet-5'}` : 'stub-persona (no ANTHROPIC_API_KEY)',
    runRoot,
    unknownInvokeCommands: [...backend.unknownCommands],
  };
  const summary = await writeReport({ runDir, meta, results });

  await browser.close();
  await server.stop();

  // ---- baseline / exit code ----
  const baselinePath = join(repoRoot, 'qa', 'baseline.json');
  const failing = results.filter((r) => r.status !== 'pass').map((r) => r.journeyId);
  if (has('--update-baseline')) {
    await fs.writeFile(baselinePath, JSON.stringify({ knownFailing: failing, updatedAt: startedAt }, null, 2));
    console.error(`[qa] baseline updated: ${failing.join(', ') || '(none)'}`);
  }
  const baseline = existsSync(baselinePath)
    ? JSON.parse(readFileSync(baselinePath, 'utf-8')).knownFailing || []
    : [];
  const newFailures = failing.filter((id) => !baseline.includes(id));

  console.log('');
  console.log(`Lokus AI-QA: ${summary.pass} pass · ${summary.fail} fail · ${summary.crash} crash · ${summary.findings} findings`);
  console.log(`Report: ${join(runDir, 'report.html')}`);
  console.log(`        ${join(runDir, 'report.md')}`);
  if (newFailures.length) {
    console.log(`NEW failures (not in baseline): ${newFailures.join(', ')}`);
  } else if (failing.length) {
    console.log(`All ${failing.length} failing journeys are known (qa/baseline.json).`);
  }
  process.exit(newFailures.length && !has('--update-baseline') ? 1 : 0);
}

main().catch((err) => {
  console.error('[qa] fatal:', err);
  process.exit(2);
});
