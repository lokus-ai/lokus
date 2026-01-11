/**
 * Tests for CreateTemplate Component
 * Tests duplicate detection, HTML conversion, and template creation flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateTemplate from '../../../src/components/CreateTemplate.jsx';

// Create mock functions that we can reference later
const mockCreateTemplate = vi.fn().mockResolvedValue({});
const mockGetCategories = vi.fn().mockReturnValue([
  { id: 'work', name: 'Work' },
  { id: 'personal', name: 'Personal' }
]);

// Mock dependencies
vi.mock('../../../src/hooks/useTemplates.js', () => ({
  useTemplates: () => ({
    createTemplate: mockCreateTemplate,
    getCategories: mockGetCategories,
    templates: [
      { id: 'existing-template', name: 'Existing Template' },
      { id: 'another-one', name: 'Another One' }
    ]
  })
}));

vi.mock('../../../src/core/markdown/compiler.js', () => ({
  getMarkdownCompiler: () => ({
    process: (text) => Promise.resolve(text)
  })
}));

vi.mock('../../../src/core/templates/html-to-markdown.js', () => ({
  htmlToMarkdown: {
    convert: (html) => html.replace(/<[^>]*>/g, '') // Simple HTML strip for testing
  }
}));

vi.mock('../../../src/services/platform/PlatformService.js', () => ({
  default: {
    getModifierSymbol: () => 'Cmd',
    isMobile: () => false
  }
}));

describe('CreateTemplate', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    initialContent: '',
    onSaved: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockCreateTemplate.mockResolvedValue({});
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate template names', async () => {
      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      fireEvent.change(nameInput, { target: { value: 'Existing Template' } });

      await waitFor(() => {
        expect(screen.getByText(/already exists and will be overwritten/i)).toBeInTheDocument();
      });
    });

    it('should change button to "Overwrite Template" for duplicates', async () => {
      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      fireEvent.change(nameInput, { target: { value: 'Existing Template' } });

      await waitFor(() => {
        expect(screen.getByText(/Overwrite Template/i)).toBeInTheDocument();
      });
    });

    it('should apply yellow styling to duplicate warning', async () => {
      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      fireEvent.change(nameInput, { target: { value: 'Existing Template' } });

      await waitFor(() => {
        expect(nameInput.className).toContain('border-yellow');
      });
    });

    it('should not show warning for unique names', async () => {
      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      fireEvent.change(nameInput, { target: { value: 'Unique New Template' } });

      await waitFor(() => {
        expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
      });
    });

    it('should generate correct template ID from name', () => {
      // Test ID generation logic
      const generateId = (name) => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };

      expect(generateId('Simple')).toBe('simple');
      expect(generateId('With Spaces')).toBe('with-spaces');
      expect(generateId('Special!@#Chars')).toBe('special-chars');
      expect(generateId('Multiple   Spaces')).toBe('multiple-spaces');
    });
  });

  describe('HTML to Markdown Conversion', () => {
    it('should convert HTML content to markdown on open', async () => {
      const htmlContent = '<h1>Title</h1><p>Content with <strong>bold</strong></p>';

      render(
        <CreateTemplate
          {...defaultProps}
          initialContent={htmlContent}
        />
      );

      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /Template Content/i });
        expect(textarea.value).not.toContain('<h1>');
        expect(textarea.value).not.toContain('<strong>');
      });
    });

    it('should detect HTML by presence of tags', async () => {
      const htmlContent = '<p>Test</p>';
      render(
        <CreateTemplate
          {...defaultProps}
          initialContent={htmlContent}
        />
      );

      // Conversion should be triggered
      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /Template Content/i });
        expect(textarea.value).toBeTruthy();
      });
    });

    it('should not convert plain text', async () => {
      const plainText = 'Just plain text without HTML';
      render(
        <CreateTemplate
          {...defaultProps}
          initialContent={plainText}
        />
      );

      await waitFor(() => {
        const textarea = screen.getByRole('textbox', { name: /Template Content/i });
        expect(textarea.value).toBe(plainText);
      });
    });
  });

  describe('Form Validation', () => {
    it('should disable save button when name is empty', () => {
      render(<CreateTemplate {...defaultProps} />);

      const saveButton = screen.getByText(/Save Template/i);
      expect(saveButton).toBeDisabled();
    });

    it('should disable save button when content is empty', () => {
      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      fireEvent.change(nameInput, { target: { value: 'Template Name' } });

      const saveButton = screen.getByText(/Save Template/i);
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when both name and content provided', async () => {
      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      const contentTextarea = screen.getByRole('textbox', { name: /Template Content/i });

      fireEvent.change(nameInput, { target: { value: 'Template Name' } });
      fireEvent.change(contentTextarea, { target: { value: 'Template Content' } });

      await waitFor(() => {
        const saveButton = screen.getByText(/Save Template/i);
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Overwrite Confirmation', () => {
    it('should show confirmation dialog for duplicate', async () => {
      global.confirm = vi.fn(() => true);

      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      const contentTextarea = screen.getByRole('textbox', { name: /Template Content/i });

      fireEvent.change(nameInput, { target: { value: 'Existing Template' } });
      fireEvent.change(contentTextarea, { target: { value: 'Content' } });

      const saveButton = await screen.findByText(/Overwrite Template/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith(
          expect.stringContaining('already exists')
        );
      });
    });

    it('should not save if user cancels overwrite', async () => {
      global.confirm = vi.fn(() => false);

      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      const contentTextarea = screen.getByRole('textbox', { name: /Template Content/i });

      fireEvent.change(nameInput, { target: { value: 'Existing Template' } });
      fireEvent.change(contentTextarea, { target: { value: 'Content' } });

      const saveButton = await screen.findByText(/Overwrite Template/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockCreateTemplate).not.toHaveBeenCalled();
      });
    });

    it('should save if user confirms overwrite', async () => {
      global.confirm = vi.fn(() => true);

      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      const contentTextarea = screen.getByRole('textbox', { name: /Template Content/i });

      fireEvent.change(nameInput, { target: { value: 'Existing Template' } });
      fireEvent.change(contentTextarea, { target: { value: 'Content' } });

      const saveButton = await screen.findByText(/Overwrite Template/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockCreateTemplate).toHaveBeenCalled();
      });
    });
  });

  describe('Template Creation', () => {
    it('should create template with correct data', async () => {
      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      const contentTextarea = screen.getByRole('textbox', { name: /Template Content/i });

      fireEvent.change(nameInput, { target: { value: 'New Template' } });
      fireEvent.change(contentTextarea, { target: { value: '# Content' } });

      const saveButton = await screen.findByText(/Save Template/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockCreateTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'new-template',
            name: 'New Template',
            content: '# Content',
            category: 'Personal'
          })
        );
      });
    });

    it('should call onSaved and onClose after successful save', async () => {
      render(<CreateTemplate {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText(/Daily Standup Notes/i);
      const contentTextarea = screen.getByRole('textbox', { name: /Template Content/i });

      fireEvent.change(nameInput, { target: { value: 'Template' } });
      fireEvent.change(contentTextarea, { target: { value: 'Content' } });

      const saveButton = await screen.findByText(/Save Template/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(defaultProps.onSaved).toHaveBeenCalled();
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('UI Information', () => {
    it('should show Command Palette shortcut info', () => {
      render(<CreateTemplate {...defaultProps} />);

      expect(screen.getByText(/Command Palette/i)).toBeInTheDocument();
    });
  });
});
