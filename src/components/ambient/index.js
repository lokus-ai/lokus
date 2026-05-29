/**
 * Ambient resurfacing surface — public exports.
 *
 * The "Connected notes" panel (the product differentiator): graph-based related-note
 * resurfacing (Layer A, $0/offline) with a pluggable seam for local semantic Layer B.
 * Mount `AmbientNotesPanel` in the workspace and feed it `workspacePath` + the active
 * note's `noteName`/`notePath`. See AmbientNotesPanel.jsx for props.
 */

export { default as AmbientNotesPanel } from './AmbientNotesPanel.jsx';
export { default as ResurfacingProvider, DEFAULT_LIMIT } from './ResurfacingProvider.js';
