import { describe, it, expect, beforeEach } from 'vitest';
import {
  setTabModel,
  getTabModel,
  deleteTabModel,
  moveTabModel,
  renameTabModel,
  clearAllModels,
  clearGroupModels,
  setSavedDoc,
  getSavedDoc,
} from './tabModels';

// Dirty checks compare document IDENTITY only, so plain objects stand in
// for ProseMirror docs here (EditorState is equally opaque to the registry).
const docA = { text: 'a' };
const docB = { text: 'b' };
const stateA = { doc: docA };
const stateB = { doc: docB };

describe('tabModels savedDoc registry (O(1) dirty identity)', () => {
  beforeEach(() => {
    clearAllModels();
  });

  it('load sets savedDoc → typing (new doc) reports dirty → save updates savedDoc → clean', () => {
    // Load: the parsed doc becomes the saved doc.
    setTabModel('g1', '/a.md', stateA, 0);
    setSavedDoc('g1', '/a.md', docA);

    // No edit yet: the view's doc IS the saved doc → clean.
    expect(getTabModel('g1', '/a.md').state.doc !== getSavedDoc('g1', '/a.md')).toBe(false);

    // Typing produces a new doc object → identity differs → dirty.
    setTabModel('g1', '/a.md', stateB, 0);
    expect(getTabModel('g1', '/a.md').state.doc !== getSavedDoc('g1', '/a.md')).toBe(true);

    // Save: the written doc becomes the new saved doc → clean again.
    setSavedDoc('g1', '/a.md', docB);
    expect(getTabModel('g1', '/a.md').state.doc !== getSavedDoc('g1', '/a.md')).toBe(false);
  });

  it('getSavedDoc returns null for unknown tabs', () => {
    expect(getSavedDoc('g1', '/ghost.md')).toBeNull();
  });

  it('deleteTabModel also drops the savedDoc', () => {
    setTabModel('g1', '/a.md', stateA, 0);
    setSavedDoc('g1', '/a.md', docA);
    deleteTabModel('g1', '/a.md');
    expect(getTabModel('g1', '/a.md')).toBeNull();
    expect(getSavedDoc('g1', '/a.md')).toBeNull();
  });

  it('moveTabModel carries the savedDoc to the target group', () => {
    setTabModel('g1', '/a.md', stateA, 0);
    setSavedDoc('g1', '/a.md', docA);
    moveTabModel('g1', 'g2', '/a.md');
    expect(getSavedDoc('g1', '/a.md')).toBeNull();
    expect(getSavedDoc('g2', '/a.md')).toBe(docA);
  });

  it('renameTabModel re-keys the savedDoc in every group', () => {
    setTabModel('g1', '/a.md', stateA, 0);
    setSavedDoc('g1', '/a.md', docA);
    setTabModel('g2', '/a.md', stateB, 0);
    setSavedDoc('g2', '/a.md', docB);

    renameTabModel('/a.md', '/b.md');

    expect(getSavedDoc('g1', '/a.md')).toBeNull();
    expect(getSavedDoc('g1', '/b.md')).toBe(docA);
    expect(getSavedDoc('g2', '/b.md')).toBe(docB);
  });

  it('clearGroupModels drops models and savedDocs of one group only', () => {
    setTabModel('g1', '/a.md', stateA, 0);
    setSavedDoc('g1', '/a.md', docA);
    setTabModel('g2', '/b.md', stateB, 0);
    setSavedDoc('g2', '/b.md', docB);

    clearGroupModels('g1');

    expect(getSavedDoc('g1', '/a.md')).toBeNull();
    expect(getSavedDoc('g2', '/b.md')).toBe(docB);
  });

  it('clearAllModels drops everything', () => {
    setTabModel('g1', '/a.md', stateA, 0);
    setSavedDoc('g1', '/a.md', docA);
    clearAllModels();
    expect(getTabModel('g1', '/a.md')).toBeNull();
    expect(getSavedDoc('g1', '/a.md')).toBeNull();
  });
});
