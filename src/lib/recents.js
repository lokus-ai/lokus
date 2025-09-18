const KEY = "lokus.recents";

export const readRecents = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
};

export const writeRecents = (list) => localStorage.setItem(KEY, JSON.stringify(list));

export const addRecent = (path) => {
  const name = path.split("/").filter(Boolean).pop() || path;
  const items = readRecents().filter((r) => r.path !== path);
  items.unshift({ name, path, at: Date.now() });
  writeRecents(items.slice(0, 12));
};

export const removeRecent = (path) => {
  const items = readRecents().filter((r) => r.path !== path);
  writeRecents(items);
};

export const shortenPath = (p, max = 96) => {
  if (!p || p.length <= max) return p || "";
  const head = Math.ceil((max - 3) * 0.6);
  const tail = max - 3 - head;
  return p.slice(0, head) + "..." + p.slice(-tail);
};