// The background page: runs when one of the plugin's commands is first used.
// `__lokus.js` (the API) is loaded for you before this file.
const shared = document.createElement("script");
shared.src = "count.js";
document.head.append(shared);

lokus.commands.handle("word-count.count", async () => {
  const result = await countActiveNote();
  await lokus.notify(`${result.count} ${result.unit}`);
  return result;
});
