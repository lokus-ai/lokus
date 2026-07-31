import { describe, it, expect, afterEach } from 'vitest';
import { beginDragGuard } from './dragGuard';

afterEach(() => {
  document.body.style.userSelect = '';
  document.body.style.webkitUserSelect = '';
  document.body.style.cursor = '';
});

describe('beginDragGuard', () => {
  it('locks text selection off for the duration of a drag', () => {
    const end = beginDragGuard();
    expect(document.body.style.userSelect).toBe('none');
    end();
    expect(document.body.style.userSelect).not.toBe('none');
  });

  it('pins the cursor so it does not flicker to an I-beam mid-drag', () => {
    const end = beginDragGuard('row-resize');
    expect(document.body.style.cursor).toBe('row-resize');
    end();
    expect(document.body.style.cursor).not.toBe('row-resize');
  });

  it('defaults to a column cursor', () => {
    const end = beginDragGuard();
    expect(document.body.style.cursor).toBe('col-resize');
    end();
  });

  it('restores the PREVIOUS values, not hardcoded defaults', () => {
    document.body.style.cursor = 'wait';
    document.body.style.userSelect = 'text';

    const end = beginDragGuard('col-resize');
    expect(document.body.style.cursor).toBe('col-resize');

    end();
    expect(document.body.style.cursor).toBe('wait');
    expect(document.body.style.userSelect).toBe('text');
  });

  it('clears a selection that started before the guard ran', () => {
    const p = document.createElement('p');
    p.textContent = 'some text that got swept by the drag';
    document.body.appendChild(p);

    const range = document.createRange();
    range.selectNodeContents(p);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    expect(sel.rangeCount).toBe(1);

    beginDragGuard()();
    expect(window.getSelection().rangeCount).toBe(0);

    document.body.removeChild(p);
  });

  it('is safe to nest without stranding the body locked', () => {
    const outer = beginDragGuard('col-resize');
    const inner = beginDragGuard('row-resize');
    inner();
    outer();
    expect(document.body.style.userSelect).not.toBe('none');
  });
});
