// Shared by the background page and the panel.
async function countActiveNote() {
  const { unit } = await lokus.settings.get();
  const { text } = await lokus.run("editor.state");
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const count = unit === "characters" ? body.length : (body.match(/\S+/g) ?? []).length;
  return { count, unit };
}
