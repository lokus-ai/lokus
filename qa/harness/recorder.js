/**
 * Recorder — collects steps, screenshots, console errors, and findings for one
 * journey (scripted or AI-driven). The reporter turns these into MD/HTML.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export class Recorder {
  constructor(runDir, journeyId) {
    this.journeyId = journeyId;
    this.dir = join(runDir, 'shots');
    this.steps = [];       // { n, action, detail, screenshot, ts }
    this.findings = [];    // { kind: 'fail'|'crash'|'ai-issue', title, expected, actual, screenshot, steps, consoleErrors, severity }
    this.consoleErrors = [];
    this.passes = [];      // { title, detail }
    this.shotCounter = 0;
    this.status = 'pass';  // pass | fail | crash
  }

  async init() {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async step(action, detail = '') {
    const n = this.steps.length + 1;
    this.steps.push({ n, action, detail, ts: Date.now() });
    return n;
  }

  attachShotToLastStep(file) {
    if (this.steps.length) this.steps[this.steps.length - 1].screenshot = file;
  }

  shotName(label) {
    this.shotCounter++;
    const safe = String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    return `${this.journeyId}-${String(this.shotCounter).padStart(2, '0')}-${safe}.png`;
  }

  console(entry) {
    this.consoleErrors.push(entry);
  }

  pass(title, detail = '') {
    this.passes.push({ title, detail });
  }

  fail({ title, expected, actual, screenshot = null, severity = 'major' }) {
    this.status = this.status === 'crash' ? 'crash' : 'fail';
    this.findings.push({
      kind: 'fail',
      title,
      expected,
      actual,
      screenshot,
      severity,
      steps: this.steps.map((s) => ({ ...s })),
      consoleErrors: this.consoleErrors.slice(-10),
    });
  }

  crash({ title, actual, screenshot = null }) {
    this.status = 'crash';
    this.findings.push({
      kind: 'crash',
      title,
      expected: 'App keeps working without unhandled errors',
      actual,
      screenshot,
      severity: 'blocker',
      steps: this.steps.map((s) => ({ ...s })),
      consoleErrors: this.consoleErrors.slice(-10),
    });
  }

  aiIssue({ title, expected, actual, screenshot = null, severity = 'minor' }) {
    if (this.status === 'pass') this.status = 'fail';
    this.findings.push({
      kind: 'ai-issue',
      title,
      expected,
      actual,
      screenshot,
      severity,
      steps: this.steps.map((s) => ({ ...s })),
      consoleErrors: this.consoleErrors.slice(-10),
    });
  }

  /** expect(cond, title, expected, actual, screenshot) — soft assertion that records a finding on failure. */
  expect(cond, title, expected, actual, screenshot = null) {
    if (cond) this.pass(title, expected);
    else this.fail({ title, expected, actual, screenshot });
    return cond;
  }

  toJSON() {
    return {
      journeyId: this.journeyId,
      status: this.status,
      steps: this.steps,
      passes: this.passes,
      findings: this.findings,
      consoleErrors: this.consoleErrors,
    };
  }
}
