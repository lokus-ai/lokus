import clientNodeImports from './00-client-node-imports.js';
import autosave from './01-autosave-data-loss.js';
import heading from './02-heading-input-rule.js';
import savePersists from './03-save-persists-to-disk.js';
import slashMenu from './04-slash-menu.js';
import wikilink from './05-wikilink.js';
import splitUndo from './06-split-pane-undo.js';
import graphHotkey from './07-graph-hotkey.js';
import windowLifecycle from './08-window-lifecycle.js';
import tabIsolation from './09-tab-isolation.js';

export const journeys = [
  clientNodeImports,
  autosave,
  heading,
  savePersists,
  slashMenu,
  wikilink,
  splitUndo,
  graphHotkey,
  windowLifecycle,
  tabIsolation,
];
