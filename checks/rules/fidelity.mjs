/** @part-of checks */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Rule 3: reading a note and writing it back unchanged leaves the bytes identical. */
export function check(root) {
  if (!existsSync(path.join(root, 'crates/lokus-cli/Cargo.toml'))) {
    return ['crates/lokus-cli is missing, so the fidelity check cannot run']
  }
  const env = { ...process.env, PATH: `${process.env.PATH}:${path.join(os.homedir(), '.cargo/bin')}` }
  const run = spawnSync(
    'cargo',
    ['run', '-q', '-p', 'lokus-cli', '--', 'vault.fidelity', '--vault', 'checks/fixtures/vault'],
    { cwd: root, env, encoding: 'utf8' },
  )
  if (run.error) return [`could not run cargo: ${run.error.message}`]
  let report
  try {
    report = JSON.parse(run.stdout)
  } catch {
    return [`vault.fidelity did not print JSON (exit ${run.status}): ${(run.stderr || run.stdout).trim().slice(0, 400)}`]
  }
  const errors = (report.mismatches ?? []).map((item) => `not byte-identical: ${typeof item === 'string' ? item : JSON.stringify(item)}`)
  if (!report.checked) errors.push('vault.fidelity checked 0 files')
  if (run.status !== 0 && errors.length === 0) errors.push(`vault.fidelity exited ${run.status}`)
  return errors
}
