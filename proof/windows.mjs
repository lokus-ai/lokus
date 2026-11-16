// Drives the published Windows copy through its own update, by its own buttons.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const FROM = process.env.FROM, TO = process.env.TO, APP = process.env.APP_EXE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);
const ps = (command) => execFileSync("powershell", ["-NoProfile", "-Command", command], { encoding: "utf8" }).trim();
const press = (name, seconds, shot) => {
  try { return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "proof/click.ps1", "-Name", name, "-Seconds", String(seconds), "-Shot", shot ? `out\\${shot}.png` : ""], { encoding: "utf8" }).trim(); }
  catch (e) { log(String(e.stdout || e).slice(0, 1500)); return null; }
};
const version = () => ps(`(Get-Item '${APP}').VersionInfo.ProductVersion`);
const pids = () => ps("(Get-Process lokus-desktop -ErrorAction SilentlyContinue | ForEach-Object { $_.Id }) -join ','");
const screen = (name) => ps(`Add-Type -AssemblyName System.Windows.Forms, System.Drawing; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height; [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen(0, 0, 0, 0, $bmp.Size); $bmp.Save('out\\${name}.png')`);

// The window's own answer to "which version are you", when the window can be asked.
async function about() {
  try {
    const list = await (await fetch("http://127.0.0.1:9222/json")).json();
    const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
    const answer = new Promise((ok) => { ws.onmessage = (m) => ok(JSON.parse(m.data)); });
    ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: "window.__TAURI_INTERNALS__.invoke('app_about').then(JSON.stringify)", awaitPromise: true, returnByValue: true } }));
    const r = await Promise.race([answer, sleep(8000)]);
    ws.close();
    return r?.result?.result?.value ?? null;
  } catch { return null; }
}

const before = { file: version(), pids: pids(), about: await about() };
log("before", JSON.stringify(before));
if (before.file !== FROM) throw new Error(`expected ${FROM} installed`);
const offered = press("Update now", 90, "1-offered");
if (!offered) { screen("no-offer"); throw new Error("no update was offered"); }
log(offered);
const began = Date.now();
let after = null;
while (Date.now() - began < 420000) {
  await sleep(2000);
  const now = { file: version(), pids: pids() };
  if (now.pids && now.pids === before.pids && press("Restart now", 1, "")) log("pressed Restart now");
  if (now.file === TO && now.pids && now.pids !== before.pids) { after = now; break; }
  if ((Date.now() - began) % 20000 < 2100) log("waiting", JSON.stringify(now));
}
if (!after) { screen("stuck"); throw new Error(`still ${version()} with processes ${pids()} after 7 minutes`); }
log("the new copy is open after", Math.round((Date.now() - began) / 1000), "s", JSON.stringify(after));
await sleep(12000);
screen("4-after");
after.about = await about();
after.stillOffered = (() => { try { execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "proof/click.ps1", "-Name", "Update now", "-Seconds", "8", "-Look"]); return true; } catch (e) { log(String(e.stdout).slice(0, 600)); return false; } })();
log("after", JSON.stringify(after));
writeFileSync("out/result.json", JSON.stringify({ before, after }, null, 1));
if (after.stillOffered) throw new Error("the new copy still offers an update");
log("PASS: the published copy updated itself from", FROM, "to", TO, "and reopened");
process.exit(0);
