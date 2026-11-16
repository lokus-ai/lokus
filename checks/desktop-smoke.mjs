/** @part-of checks */
// Start the built app and use it the way a person would, through its dev channel, on whatever
// computer this runs on (Windows, Linux or a Mac): open a folder, write a note, then keep a team
// folder in step with a teammate through a real relay started here. Pictures and logs are kept
// in desktop-smoke/. Every check runs even after one fails, so one run says everything.
//
//   VITE_LOKUS_DEV_CHANNEL=1 pnpm tauri build --debug --no-bundle
//   cargo build -p lokus-cli -p lokus-server
//   node checks/desktop-smoke.mjs
//
// With a program after it, it only starts that program (the installed app, which has no dev
// channel) and says whether it is still open half a minute later, with a picture:
//   node checks/desktop-smoke.mjs "C:\\Users\\me\\AppData\\Local\\Lokus\\Lokus.exe"
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { repoRoot } from './lib.mjs'

const win = process.platform === 'win32'
const built = path.join(process.env.CARGO_TARGET_DIR ?? path.join(repoRoot, 'target'), 'debug')
const exe = (name) => path.join(built, name + (win ? '.exe' : ''))
const out = path.join(repoRoot, 'desktop-smoke')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lk-'))
const [own, mine, theirs] = ['own', 'mine', 'theirs'].map((n) => path.join(tmp, n))
for (const dir of [out, own, mine, theirs]) fs.mkdirSync(dir, { recursive: true })
const env = { ...process.env, LOKUS_DEV_PORT: '47631', LOKUS_DEV_SOCK: path.join(tmp, 'dev.sock') }
const relay = 'http://127.0.0.1:8797'

const running = []
function start(name, args, extra = {}, log = name) {
  const file = fs.openSync(path.join(out, `${log}.log`), 'a')
  const child = spawn(exe(name), args, { env: { ...env, ...extra }, stdio: ['ignore', file, file] })
  running.push(child)
  return child
}
const startRelay = () =>
  start('lokus-server', [], {
    LOKUS_DEV_TOKENS: 'ta:alice:alice@x.io,tb:bob:bob@x.io',
    LOKUS_DATA: path.join(tmp, 'relay.sqlite'),
    PORT: '8797',
  })
function lokus(command, args = {}) {
  const said = execFileSync(exe('lokus'), ['app', command, '--json', JSON.stringify(args)], { env, encoding: 'utf8' })
  try {
    return JSON.parse(said)
  } catch {
    return said
  }
}
async function ask(token, method, where, body) {
  const got = await fetch(relay + where, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  if (!got.ok) throw new Error(`${method} ${where} answered ${got.status}`)
  return got.json().catch(() => null)
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
async function until(test, seconds = 20) {
  const end = Date.now() + seconds * 1000
  for (;;) {
    try {
      if (await test()) return
    } catch {}
    if (Date.now() > end) throw new Error(`not within ${seconds} seconds`)
    await sleep(100)
  }
}
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8')
const has = (file, words) => () => read(file).includes(words)

function picture(name) {
  const file = path.join(out, `${name}.png`)
  try {
    if (win) {
      const shot = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $p=New-Object System.Drawing.Bitmap $b.Width,$b.Height; [System.Drawing.Graphics]::FromImage($p).CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size); $p.Save('${file}')`
      execFileSync('powershell', ['-NoProfile', '-Command', shot])
    } else if (process.platform === 'linux') execFileSync('import', ['-window', 'root', file])
    else lokus('window.snapshot', { path: file })
  } catch (e) {
    console.log(`      (no picture "${name}": ${String(e.message).split('\n')[0]})`)
  }
}

let failed = 0
async function check(what, run) {
  const began = Date.now()
  try {
    await run()
    console.log(`ok    ${what}  (${((Date.now() - began) / 1000).toFixed(1)} s)`)
  } catch (e) {
    failed += 1
    console.log(`FAIL  ${what}: ${String(e.message).split('\n')[0]}`)
  }
}

/** Every file under a folder with what is in it, the app's own `.lokus` left out. */
function files(root, under = '') {
  return fs.readdirSync(path.join(root, under), { withFileTypes: true }).flatMap((item) => {
    const rel = under ? `${under}/${item.name}` : item.name
    if (item.name.startsWith('.')) return []
    return item.isDirectory() ? files(root, rel) : [`${rel} ${fs.readFileSync(path.join(root, rel)).toString('base64')}`]
  })
}

const installed = process.argv[2]
if (installed) {
  const log = fs.openSync(path.join(out, 'installed.log'), 'a')
  const app = spawn(installed, process.argv.slice(3), { stdio: ['ignore', log, log] })
  app.on('error', (e) => console.log(`FAIL  ${installed} could not be started: ${e.message}`))
  await sleep(30000)
  picture('installed')
  const open = app.exitCode === null && app.pid !== undefined
  app.kill()
  console.log(open ? `ok    ${installed} opened and stayed open` : `FAIL  ${installed} closed by itself (${app.exitCode}); see desktop-smoke/installed.log`)
  process.exit(open ? 0 : 1)
}

try {
  let server = startRelay()
  await until(async () => (await fetch(`${relay}/health`)).ok)
  const app = start('lokus-desktop', [])
  await until(() => {
    if (app.exitCode !== null) throw new Error('gone')
    return lokus('app.state')
  }, 120).catch(() => {
    throw new Error(app.exitCode === null ? 'Lokus did not open its dev channel within two minutes' : `Lokus exited with ${app.exitCode} before it was ready`)
  })
  await sleep(3000)
  picture('1-started')

  console.log(`--- a folder of one's own (${process.platform} ${os.release()})`)
  lokus('vault.open', { path: own })
  await check('a note made in the app is written to disk', async () => {
    lokus('note.create', { path: 'Hello.md', text: '# Hello\n\nWritten by the smoke test.' })
    await until(has(path.join(own, 'Hello.md'), 'Written by the smoke test'))
  })
  await check('the window shows it, laid out', async () => {
    let seen
    await until(() => JSON.stringify((seen = lokus('ui.measure', { selector: 'body' }))).includes('Hello'))
    fs.writeFileSync(path.join(out, 'window.json'), JSON.stringify(seen, null, 2))
    if (!(seen.window?.width >= 400)) throw new Error(`the window is ${seen.window?.width} wide`)
  })
  await check('it reads back and is found by search', async () => {
    if (!JSON.stringify(lokus('note.read', { path: 'Hello.md' })).includes('Written by the smoke test')) throw new Error('read back differs')
    await until(() => JSON.stringify(lokus('search.query', { q: 'smoke' })).includes('Hello'))
  })
  await check('this computer reaches the hosted relay over https', async () => {
    const said = execFileSync(exe('lokus'), ['release.list', 'server=https://relay.lokusmd.com'], { encoding: 'utf8' })
    if (!/\d+\.\d+\.\d+/.test(said)) throw new Error(`it answered ${said.slice(0, 120)}`)
  })
  picture('2-note-made')

  console.log('--- a team folder, kept in step with a teammate through the relay')
  const team = (await ask('ta', 'POST', '/v1/workspaces', { name: 'Team' })).id
  const invite = (await ask('ta', 'POST', `/v1/workspaces/${team}/invites`, { role: 'editor' })).code
  await ask('tb', 'POST', `/v1/invites/${invite}/accept`)
  lokus('vault.open', { path: mine })
  lokus('sync.connect', { server: relay, workspace: team, token: 'ta' })
  const teammate = () => start('lokus', ['sync', '--vault', theirs, `server=${relay}`, `workspace=${team}`, 'token=tb'], {}, 'teammate')
  let other = teammate()
  const connected = () => lokus('app.state').sync?.status === 'online'
  await check('the app connects to the team', () => until(connected))

  const plan = 'Projects/Plan.md'
  await check('a note made in the app, in a folder, reaches the teammate', async () => {
    lokus('note.create', { path: plan, text: '# Plan\n\nline one\n' })
    await until(has(path.join(theirs, plan), 'line one'))
  })
  await check('a note the teammate writes reaches the app', async () => {
    fs.mkdirSync(path.join(theirs, 'Notes'), { recursive: true })
    fs.writeFileSync(path.join(theirs, 'Notes', 'From a teammate.md'), 'written on the other computer\n')
    await until(has(path.join(mine, 'Notes', 'From a teammate.md'), 'other computer'))
    if (!JSON.stringify(lokus('note.read', { path: 'Notes/From a teammate.md' })).includes('other computer')) throw new Error('the app cannot read it')
  })
  await check('typing in the app reaches the teammate as it is typed', async () => {
    lokus('note.open', { path: plan })
    await until(() => lokus('editor.state').text?.includes('line one'))
    lokus('editor.select', { anchor: 999 })
    lokus('editor.type', { text: 'typed in the window' })
    await until(has(path.join(theirs, plan), 'typed in the window'), 10)
  })
  await check("the teammate's change shows in the open note", async () => {
    fs.appendFileSync(path.join(theirs, plan), '\nadded by the teammate\n')
    await until(() => lokus('editor.state').text.includes('added by the teammate'), 10)
  })
  await check('a name with accents, signs and another script crosses both ways', async () => {
    lokus('note.create', { path: 'Notes/Café ☕ 日本語.md', text: 'ça marche\n' })
    await until(has(path.join(theirs, 'Notes', 'Café ☕ 日本語.md'), 'ça marche'))
    fs.writeFileSync(path.join(theirs, 'Notes', 'Übung & Zoë.md'), 'grüße\n')
    await until(has(path.join(mine, 'Notes', 'Übung & Zoë.md'), 'grüße'))
  })
  await check('a picture the teammate adds arrives byte for byte', async () => {
    const bytes = Buffer.from(Array.from({ length: 300000 }, (_, i) => (i * 7919 + (i >> 8)) & 255))
    fs.mkdirSync(path.join(theirs, 'img'))
    fs.writeFileSync(path.join(theirs, 'img', 'photo.png'), bytes)
    await until(() => fs.readFileSync(path.join(mine, 'img', 'photo.png')).equals(bytes))
  })
  await check('a rename by the teammate is followed', async () => {
    fs.renameSync(path.join(theirs, 'Notes', 'From a teammate.md'), path.join(theirs, 'Notes', 'Renamed.md'))
    await until(() => fs.existsSync(path.join(mine, 'Notes', 'Renamed.md')) && !fs.existsSync(path.join(mine, 'Notes', 'From a teammate.md')))
  })
  await check('a note deleted in the app leaves the teammate', async () => {
    lokus('note.create', { path: 'Doomed.md', text: 'short-lived\n' })
    await until(() => fs.existsSync(path.join(theirs, 'Doomed.md')))
    lokus('note.delete', { path: 'Doomed.md' })
    await until(() => !fs.existsSync(path.join(theirs, 'Doomed.md')))
  })
  await check('the relay goes away, both keep writing, and they meet again with nothing pressed', async () => {
    server.kill()
    await until(() => !connected())
    lokus('editor.select', { anchor: 0 })
    lokus('editor.type', { text: 'typed while offline\n' })
    fs.writeFileSync(path.join(theirs, 'Offline.md'), 'written while offline\n')
    await sleep(1500)
    server = startRelay()
    await until(has(path.join(theirs, plan), 'typed while offline'), 60)
    await until(has(path.join(mine, 'Offline.md'), 'written while offline'), 60)
    if (!connected()) throw new Error('the app does not say it is connected again')
  })
  await check('the teammate was away, and catches up on coming back', async () => {
    other.kill()
    await sleep(500)
    lokus('note.create', { path: 'While away.md', text: 'made while the teammate was off\n' })
    await sleep(1500)
    other = teammate()
    await until(has(path.join(theirs, 'While away.md'), 'teammate was off'), 30)
  })
  await check('both folders end up the same, file for file', async () => {
    let a, b
    await until(() => (a = files(mine).sort().join('\n')) === (b = files(theirs).sort().join('\n')), 15).catch(() => {
      const names = (all) => all.split('\n').map((line) => line.replace(/ [^ ]*$/, ''))
      throw new Error(`app has [${names(a).join(', ')}], teammate has [${names(b).join(', ')}] (or the same names with other words)`)
    })
  })
  picture('3-team')
  fs.writeFileSync(path.join(out, 'state.json'), JSON.stringify(lokus('app.state'), null, 2))
} catch (e) {
  failed += 1
  console.log(`FAIL  ${e.message}`)
} finally {
  for (const child of running) child.kill()
}
console.log(failed ? `${failed} failed; logs and pictures are in desktop-smoke/` : `Lokus runs on ${process.platform}: every check passed.`)
process.exit(failed ? 1 : 0)
