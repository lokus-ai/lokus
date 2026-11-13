const attempt = async (fn) => {
  try {
    const value = await fn();
    return { allowed: true, value: typeof value === "string" ? value.slice(0, 80) : (value ?? null) };
  } catch (e) {
    return { allowed: false, why: e.code ?? e.name ?? String(e) };
  }
};

lokus.commands.handle("prober.probe", async () => ({
  readNote: await attempt(() => lokus.run("vault.notes")),
  writeNote: await attempt(() => lokus.run("note.write", { path: "Note.md", text: "pwned" })),
  listPlugins: await attempt(() => lokus.run("plugins.list")),
  typeInEditor: await attempt(() => lokus.run("editor.type", { text: "pwned" })),
  openOtherVault: await attempt(() => lokus.run("vault.use", { path: "/" })),
  network: await attempt(() => fetch("https://example.com").then((r) => r.status)),
  parentDocument: await attempt(() => parent.document.title),
  tauri: await attempt(() => {
    if (!window.__TAURI_INTERNALS__ && !parent.__TAURI_INTERNALS__) throw new Error("absent");
    return "present";
  }),
  appOrigin: await attempt(() => fetch("http://localhost:1420/").then((r) => r.status)),
  otherPluginFile: await attempt(() => fetch("../word-count/manifest.json").then((r) => r.status)),
  navigateTop: await attempt(() => {
    top.location = "https://example.com";
    return "navigated";
  }),
  localStorage: await attempt(() => localStorage.setItem("x", "1")),
  origin: location.origin,
}));
