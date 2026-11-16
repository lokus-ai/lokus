// Drives the published Windows copy through its own update, by its own buttons.
import { writeFileSync } from "node:fs";
const FROM = process.env.FROM, TO = process.env.TO;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function connect(within) {
  const until = Date.now() + within;
  while (Date.now() < until) {
    try {
      const list = await (await fetch("http://127.0.0.1:9222/json")).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
        let id = 0, open = true;
        const waiting = new Map();
        ws.onmessage = (m) => { const d = JSON.parse(m.data); waiting.get(d.id)?.(d); waiting.delete(d.id); };
        ws.onclose = () => { open = false; for (const w of waiting.values()) w({ closed: true }); };
        const send = (method, params = {}) => new Promise((ok) => { if (!open) return ok({ closed: true }); const n = ++id; waiting.set(n, ok); ws.send(JSON.stringify({ id: n, method, params })); });
        const run = async (expression) => {
          const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
          if (r.closed) throw new Error("closed");
          if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
          return r.result?.result?.value;
        };
        const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); if (r.result?.data) writeFileSync(`out/${name}.png`, Buffer.from(r.result.data, "base64")); };
        return { send, run, shot, url: page.url, isOpen: () => open };
      }
    } catch {}
    await sleep(500);
  }
  throw new Error("the app's window did not appear");
}
const about = (c) => c.run("window.__TAURI_INTERNALS__.invoke('app_about').then(JSON.stringify)");
const button = (label) => `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)} && b.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()`;

let c = await connect(60000);
log("window", c.url);
let a;
for (let i = 0; i < 40 && !a; i++) { a = await about(c).catch(() => null); if (!a) await sleep(500); }
log("about before", a);
if (JSON.parse(a).version !== FROM) throw new Error(`expected ${FROM} to be running`);
let at = null;
for (let i = 0; i < 120 && !at; i++) { at = await c.run(button("Update now")).catch(() => null); if (!at) await sleep(500); }
if (!at) { await c.shot("no-offer"); log(await c.run("document.body.innerText.slice(0, 1500)")); throw new Error("no update was offered"); }
log("offered:", (await c.run("document.body.innerText")).split("\n").filter((l) => /update|version|alpha/i.test(l)).slice(0, 8).join(" | "));
await c.shot("1-offered");
const { x, y } = JSON.parse(at);
await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
log("clicked Update now");
let said = "", shots = 0;
const began = Date.now();
while (c.isOpen() && Date.now() - began < 300000) {
  const text = await c.run("[...document.querySelectorAll('button, .update-card, [class*=update]')].map((e) => e.textContent.trim()).filter(Boolean).join(' | ').slice(0, 300)").catch(() => null);
  if (text === null) break;
  if (text !== said) { said = text; log("card:", text); if (shots++ < 6) await c.shot(`2-progress-${shots}`); }
  const restart = await c.run(button("Restart now")).catch(() => null);
  if (restart) {
    await c.shot("3-ready");
    const p = JSON.parse(restart);
    await c.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await c.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
    log("clicked Restart now");
    await sleep(3000);
  }
  await sleep(300);
}
log("the old copy closed after", Math.round((Date.now() - began) / 1000), "s");
await sleep(2000);
c = await connect(240000);
a = null;
for (let i = 0; i < 60 && !a; i++) { a = await about(c).catch(() => null); if (!a) await sleep(500); }
log("about after", a);
await sleep(8000);
await c.shot("4-after");
log("screen after:", (await c.run("document.body.innerText")).split("\n").filter(Boolean).slice(0, 25).join(" | "));
const again = await c.run("window.__TAURI_INTERNALS__.invoke('update_check', { server: 'https://relay.lokusmd.com' }).then(JSON.stringify)").catch((e) => String(e));
log("update check after:", again);
writeFileSync("out/result.json", JSON.stringify({ before: FROM, after: JSON.parse(a), again }, null, 1));
if (JSON.parse(a).version !== TO) throw new Error(`expected ${TO} after the update, got ${a}`);
log("PASS: the published copy updated itself from", FROM, "to", TO);
process.exit(0);
