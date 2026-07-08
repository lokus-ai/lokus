/**
 * QA reporter — turns recorder results into:
 *   - results.json  (machine-readable)
 *   - report.md     (human summary, screenshots referenced)
 *   - report.html   (self-contained: screenshots embedded as base64)
 */

import { promises as fs } from 'fs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STATUS_EMOJI = { pass: '✅', fail: '❌', crash: '💥' };

export async function writeReport({ runDir, meta, results }) {
  const summary = {
    pass: results.filter((r) => r.status === 'pass').length,
    fail: results.filter((r) => r.status === 'fail').length,
    crash: results.filter((r) => r.status === 'crash').length,
    findings: results.reduce((n, r) => n + r.findings.length, 0),
  };

  await fs.writeFile(join(runDir, 'results.json'), JSON.stringify({ meta, summary, results }, null, 2));
  await fs.writeFile(join(runDir, 'report.md'), renderMarkdown({ meta, summary, results }));
  await fs.writeFile(join(runDir, 'report.html'), renderHtml({ runDir, meta, summary, results }));
  return summary;
}

function renderMarkdown({ meta, summary, results }) {
  const lines = [];
  lines.push(`# Lokus AI-QA Report`);
  lines.push('');
  lines.push(`- **Run**: ${meta.startedAt} · runner: ${meta.runner} · AI decider: ${meta.aiDecider}`);
  lines.push(`- **Result**: ${summary.pass} pass · ${summary.fail} fail · ${summary.crash} crash · ${summary.findings} findings`);
  lines.push('');

  for (const group of ['crash', 'fail', 'pass']) {
    const items = results.filter((r) => r.status === group);
    if (!items.length) continue;
    lines.push(`## ${STATUS_EMOJI[group]} ${group.toUpperCase()} (${items.length})`);
    lines.push('');
    for (const r of items) {
      lines.push(`### ${STATUS_EMOJI[r.status]} ${r.title}`);
      if (r.expected) lines.push(`> Expected overall: ${r.expected}`);
      lines.push('');
      if (r.passes.length) {
        for (const p of r.passes) lines.push(`- ✅ ${p.title}`);
        lines.push('');
      }
      for (const f of r.findings) {
        lines.push(`#### 🐞 ${f.title} \`${f.severity}\``);
        lines.push('');
        lines.push(`- **Expected:** ${f.expected}`);
        lines.push(`- **Actual:** ${f.actual}`);
        if (f.screenshot) lines.push(`- **Screenshot:** ![${f.title}](shots/${f.screenshot})`);
        if (f.consoleErrors?.length) {
          lines.push(`- **Console errors:**`);
          for (const e of f.consoleErrors.slice(-5)) lines.push(`  - \`${e.type}\` ${e.text.slice(0, 200)}`);
        }
        lines.push(`- **Repro steps:**`);
        for (const s of f.steps) {
          lines.push(`  ${s.n}. \`${s.action}\` ${s.detail}`);
        }
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}

function shotB64(runDir, file) {
  const p = join(runDir, 'shots', file);
  if (!existsSync(p)) return null;
  return readFileSync(p).toString('base64');
}

function renderHtml({ runDir, meta, summary, results }) {
  const groups = ['crash', 'fail', 'pass'];
  const badge = (s) =>
    `<span class="badge ${s}">${STATUS_EMOJI[s]} ${s}</span>`;

  const sections = groups
    .map((g) => {
      const items = results.filter((r) => r.status === g);
      if (!items.length) return '';
      return `
  <h2>${STATUS_EMOJI[g]} ${g.toUpperCase()} <span class="count">(${items.length})</span></h2>
  ${items
    .map(
      (r) => `
  <details ${g !== 'pass' ? 'open' : ''} class="journey ${g}">
    <summary>${badge(r.status)} <strong>${esc(r.title)}</strong> <span class="jid">${esc(r.journeyId)}</span></summary>
    ${r.expected ? `<p class="expected-overall">Expected: ${esc(r.expected)}</p>` : ''}
    ${r.passes.map((p) => `<div class="pass-line">✅ ${esc(p.title)}</div>`).join('')}
    ${r.findings
      .map((f) => {
        const b64 = f.screenshot ? shotB64(runDir, f.screenshot) : null;
        return `
    <div class="finding sev-${esc(f.severity)}">
      <h4>🐞 ${esc(f.title)} <span class="sev">${esc(f.severity)}</span></h4>
      <table>
        <tr><th>Expected</th><td>${esc(f.expected)}</td></tr>
        <tr><th>Actual</th><td>${esc(f.actual)}</td></tr>
      </table>
      ${b64 ? `<img alt="screenshot" src="data:image/png;base64,${b64}">` : ''}
      ${
        f.consoleErrors?.length
          ? `<div class="console"><strong>Console:</strong><pre>${esc(
              f.consoleErrors.slice(-5).map((e) => `[${e.type}] ${e.text.slice(0, 300)}`).join('\n')
            )}</pre></div>`
          : ''
      }
      <details><summary>Repro steps (${f.steps.length})</summary><ol>
        ${f.steps.map((s) => `<li><code>${esc(s.action)}</code> ${esc(s.detail)}</li>`).join('')}
      </ol></details>
    </div>`;
      })
      .join('')}
    <details class="steps-all"><summary>Full step log (${r.steps.length})</summary><ol>
      ${r.steps
        .map((s) => {
          const b64 = s.screenshot ? shotB64(runDir, s.screenshot) : null;
          return `<li><code>${esc(s.action)}</code> ${esc(s.detail)}${
            b64 ? `<br><img class="steplet" src="data:image/png;base64,${b64}">` : ''
          }</li>`;
        })
        .join('')}
    </ol></details>
  </details>`
    )
    .join('')}`;
    })
    .join('\n');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Lokus AI-QA Report</title>
<style>
  body{font:14px/1.5 -apple-system,system-ui,sans-serif;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#1a1a1a;background:#fafafa}
  h1{margin-bottom:.2rem} .meta{color:#666;margin-bottom:1.5rem}
  .totals span{margin-right:1rem;font-weight:600}
  .badge{padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;text-transform:uppercase}
  .badge.pass{background:#d9f2e3;color:#0a7d3e}.badge.fail{background:#fde2e2;color:#b91c1c}.badge.crash{background:#3b0764;color:#fff}
  .journey{background:#fff;border:1px solid #e3e3e3;border-radius:10px;margin:.7rem 0;padding:.6rem 1rem}
  .journey.fail{border-left:4px solid #dc2626}.journey.crash{border-left:4px solid #3b0764}.journey.pass{border-left:4px solid #16a34a}
  summary{cursor:pointer} .jid{color:#999;font-size:12px;margin-left:.5rem}
  .finding{border:1px solid #f1caca;background:#fff7f7;border-radius:8px;padding:.7rem 1rem;margin:.7rem 0}
  .finding h4{margin:.1rem 0 .5rem} .sev{font-size:11px;background:#b91c1c;color:#fff;border-radius:8px;padding:1px 7px;margin-left:6px}
  .sev-minor .sev{background:#a16207}.sev-major .sev{background:#c2410c}
  table{border-collapse:collapse;margin:.4rem 0}th{color:#555;text-align:left;padding:2px 10px 2px 0;vertical-align:top;white-space:nowrap}td{padding:2px 0}
  img{max-width:100%;border:1px solid #ddd;border-radius:6px;margin:.5rem 0}
  img.steplet{max-width:420px}
  pre{background:#111;color:#eee;padding:.6rem;border-radius:6px;overflow-x:auto;font-size:12px;white-space:pre-wrap}
  .pass-line{color:#0a7d3e;font-size:13px;margin:2px 0}
  .expected-overall{color:#555;font-style:italic}
  .count{color:#999;font-size:14px}
</style></head><body>
<h1>Lokus AI-QA Report</h1>
<p class="meta">${esc(meta.startedAt)} · runner: ${esc(meta.runner)} · AI decider: ${esc(meta.aiDecider)} · vault root: <code>${esc(meta.runRoot)}</code></p>
<p class="totals"><span>✅ ${summary.pass} pass</span><span>❌ ${summary.fail} fail</span><span>💥 ${summary.crash} crash</span><span>🐞 ${summary.findings} findings</span></p>
${sections}
</body></html>`;
}
