import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import React from 'react';

import Editor from './Editor.jsx';

const DEFAULTS = {
  fontSize: 16, fontFamily: 'ui-sans-serif', lineHeight: 1.7, letterSpacing: 0.003,
  fontWeight: 400, boldWeight: 700,
  h1Size: 2.0, h2Size: 1.6, h3Size: 1.3, h1Weight: 700, h2Weight: 600, h3Weight: 600,
  textColor: 'inherit', headingColor: 'inherit', linkColor: 'inherit', linkHoverColor: 'inherit',
  codeColor: 'inherit', codeBackground: '#f5f5f5', blockquoteColor: 'inherit', blockquoteBorder: '#e5e5e5',
  paragraphSpacing: 1, listSpacing: 0.25, indentSize: 2,
  bulletStyle: '•', checkboxStyle: '☑',
  highlightColor: '#fff3cd', highlightTextColor: 'inherit',
  codeBlockBg: '#f8f9fa', codeBlockBorder: '#e9ecef', codeBlockBorderWidth: 1,
  codeBlockBorderRadius: 8, codeBlockPadding: 16, codeBlockFont: 'ui-monospace',
  codeBlockFontSize: 14, codeBlockLineHeight: 1.5,
  linkUnderline: 'hover', linkUnderlineThickness: 1, linkUnderlineOffset: 2,
  strikethroughColor: '#6c757d', strikethroughThickness: 2, underlineColor: 'inherit', underlineThickness: 1,
  boldColor: 'inherit', italicColor: 'inherit',
  blockquoteBorderWidth: 4, blockquotePadding: 16, blockquoteStyle: 'solid',
  tableBorder: '#dee2e6', tableBorderWidth: 1, tableHeaderBg: null, tableCellPadding: 12,
  selectionColor: 'rgba(99, 102, 241, 0.2)',
};

const setup = (props = {}) => {
  const onChange = vi.fn();
  const utils = render(
    <Editor settings={DEFAULTS} onChange={onChange} {...props} />
  );
  return { onChange, ...utils };
};

afterEach(cleanup);

/**
 * Labels are scoped to their group eyebrow, not globally unique — "Font" under Typeface and
 * "Font" under Code blocks are both correct names for what they control. Query inside a group.
 */
const group = (name) => {
  const eyebrow = screen.getByText(name, { selector: 'h2' });
  return within(eyebrow.parentElement);
};

describe('Editor preferences', () => {
  it('renders every setting on one page — no disclosure triangles to hunt through', () => {
    const { container } = setup();
    // The old page hid 9 of 10 groups behind accordions; everything is visible now.
    expect(screen.getByText('Presets')).toBeTruthy();
    expect(screen.getByText('Typeface')).toBeTruthy();
    expect(screen.getByText('Headings')).toBeTruthy();
    expect(screen.getByText('Tables')).toBeTruthy();
    expect(container.querySelectorAll('input[type="range"]').length).toBe(27);
    expect(container.querySelectorAll('input[type="color"]').length).toBe(19);
  });

  it('gives every slider and select a label its control points at', () => {
    const { container } = setup();
    const fields = container.querySelectorAll('input[type="range"], input[type="color"], select');
    for (const field of fields) {
      expect(field.id, `${field.type} has no id`).toBeTruthy();
      expect(container.querySelector(`label[for="${field.id}"]`), `no label for ${field.id}`).toBeTruthy();
    }
  });

  it('writes one setting at a time through onChange', () => {
    const { onChange, container } = setup();
    const fontSize = container.querySelector('input[type="range"]');
    fireEvent.change(fontSize, { target: { value: '20' } });
    expect(onChange).toHaveBeenCalledWith('fontSize', 20);
  });

  it('prints slider values without floating point noise', () => {
    setup({ settings: { ...DEFAULTS, letterSpacing: 0.015000000000000001 } });
    expect(screen.getByText('0.015em')).toBeTruthy();
  });

  it('routes the font family through the parent, which also persists it to config', () => {
    const onFontFamilyChange = vi.fn();
    const { onChange } = setup({ onFontFamilyChange });
    fireEvent.change(group('Typeface').getByLabelText('Font'), { target: { value: 'Inter' } });
    expect(onFontFamilyChange).toHaveBeenCalledWith('Inter');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reads the selection colour out of rgba and writes it back as rgba', () => {
    const { onChange } = setup();
    const selection = group('Marks').getByLabelText('Selection');
    expect(selection.value).toBe('#6366f1');
    fireEvent.change(selection, { target: { value: '#ff8800' } });
    expect(onChange).toHaveBeenCalledWith('selectionColor', 'rgba(255, 136, 0, 0.2)');
  });

  it('shows a colour left at a token as that token, not as a fake hex', () => {
    setup();
    // textColor is `inherit`; the swatch falls back to black but the value stays honest.
    expect(group('Typeface').getByLabelText('Text colour').value).toBe('#000000');
    expect(screen.getAllByText('inherit').length).toBeGreaterThan(0);
  });

  it('applies a preset by name', () => {
    const onApplyPreset = vi.fn();
    setup({ onApplyPreset });
    fireEvent.click(screen.getByText('Compact'));
    expect(onApplyPreset).toHaveBeenCalledWith('compact');
  });

  it('marks the selected list symbol as the checked radio', () => {
    const { onChange } = setup();
    const bullets = screen.getByRole('radiogroup', { name: 'Bullet' });
    const [dot, circle] = bullets.querySelectorAll('[role="radio"]');
    expect(dot.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(circle);
    expect(onChange).toHaveBeenCalledWith('bulletStyle', '◦');
  });

  it('offers restore-defaults inline, not floating over the content', () => {
    const onReset = vi.fn();
    const { container } = setup({ onReset });
    expect(container.querySelector('.sticky, .fixed')).toBeNull();
    fireEvent.click(screen.getByText('Restore defaults'));
    expect(onReset).toHaveBeenCalled();
  });

  it('has no save action — liveEditorSettings broadcasts and persists on its own', () => {
    setup();
    expect(screen.queryByText('Save changes')).toBeNull();
    expect(screen.queryByText('Saving…')).toBeNull();
    // The page must not promise a commit step that no longer exists.
    expect(screen.queryByText(/save to keep/i)).toBeNull();
  });
});
