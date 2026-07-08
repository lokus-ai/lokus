/**
 * QA-only browser shim for `fs/promises` (enabled via QA_FS_SHIM=1 in vite).
 *
 * Why it exists: the editor's AI action context statically imports
 * src/mcp-server/utils/graphIndex.js, which imports Node's fs/promises — that
 * module cannot exist in a webview, so opening ANY note crashes the editor
 * view ("View crashed"). Journey 00-client-node-imports reports that real bug.
 * This shim only keeps module evaluation from throwing so the REST of the app
 * can be tested; every call rejects at runtime like it would in the webview.
 */

const reject = (name) => async () => {
  throw new Error(`[QA shim] fs/promises.${name} is not available in the browser`);
};

export const readFile = reject('readFile');
export const writeFile = reject('writeFile');
export const readdir = reject('readdir');
export const stat = reject('stat');
export const mkdir = reject('mkdir');
export const access = reject('access');
export const unlink = reject('unlink');
export const rename = reject('rename');
export const rm = reject('rm');
export const copyFile = reject('copyFile');

export default {
  readFile,
  writeFile,
  readdir,
  stat,
  mkdir,
  access,
  unlink,
  rename,
  rm,
  copyFile,
};
