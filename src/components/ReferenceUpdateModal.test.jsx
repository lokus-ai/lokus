import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReferenceUpdateModal from './ReferenceUpdateModal.jsx'

describe('ReferenceUpdateModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    oldPath: '/workspace/old-file.md',
    newPath: '/workspace/new-file.md',
    affectedFiles: [],
    isProcessing: false,
    result: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.__LOKUS_WORKSPACE_PATH__ = '/workspace'
  })

  afterEach(() => {
    delete globalThis.__LOKUS_WORKSPACE_PATH__
  })

  describe('rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<ReferenceUpdateModal {...defaultProps} isOpen={false} />)

      expect(screen.queryByText('Update References')).not.toBeInTheDocument()
    })

    it('should render when isOpen is true', () => {
      render(<ReferenceUpdateModal {...defaultProps} />)

      // Header has the title "Update References"
      expect(screen.getByRole('heading', { name: 'Update References' })).toBeInTheDocument()
    })

    it('should display old and new paths', () => {
      render(<ReferenceUpdateModal {...defaultProps} />)

      expect(screen.getByText('old-file.md')).toBeInTheDocument()
      expect(screen.getByText('new-file.md')).toBeInTheDocument()
    })

    it('should show relative paths', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        oldPath="/workspace/folder/old.md"
        newPath="/workspace/folder/new.md"
      />)

      expect(screen.getByText('folder/old.md')).toBeInTheDocument()
      expect(screen.getByText('folder/new.md')).toBeInTheDocument()
    })

    it('should show "No references found" when affectedFiles is empty', () => {
      render(<ReferenceUpdateModal {...defaultProps} affectedFiles={[]} />)

      expect(screen.getByText('No references found to update')).toBeInTheDocument()
    })

    it('should show file count in header', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[
          { filePath: '/workspace/file1.md' },
          { filePath: '/workspace/file2.md' },
        ]}
      />)

      expect(screen.getByText('2 files will be updated')).toBeInTheDocument()
    })

    it('should use singular form for one file', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[{ filePath: '/workspace/file1.md' }]}
      />)

      expect(screen.getByText('1 file will be updated')).toBeInTheDocument()
    })
  })

  describe('affected files list', () => {
    const filesWithRefs = [
      {
        filePath: '/workspace/doc1.md',
        references: [
          { fullMatch: '[[old-file]]' },
          { fullMatch: '[[old-file|alias]]' },
        ],
      },
      {
        filePath: '/workspace/doc2.md',
        references: [{ fullMatch: '![[old-file.png]]' }],
      },
    ]

    it('should display affected files', () => {
      render(<ReferenceUpdateModal {...defaultProps} affectedFiles={filesWithRefs} />)

      expect(screen.getByText('doc1.md')).toBeInTheDocument()
      expect(screen.getByText('doc2.md')).toBeInTheDocument()
    })

    it('should show reference count badge', () => {
      render(<ReferenceUpdateModal {...defaultProps} affectedFiles={filesWithRefs} />)

      expect(screen.getByText('2')).toBeInTheDocument() // doc1.md has 2 refs
      expect(screen.getByText('1')).toBeInTheDocument() // doc2.md has 1 ref
    })

    it('should show total references count', () => {
      render(<ReferenceUpdateModal {...defaultProps} affectedFiles={filesWithRefs} />)

      expect(screen.getByText(/3 total/)).toBeInTheDocument()
    })

    it('should expand file to show references on click', async () => {
      render(<ReferenceUpdateModal {...defaultProps} affectedFiles={filesWithRefs} />)

      // Click to expand
      fireEvent.click(screen.getByText('doc1.md'))

      await waitFor(() => {
        expect(screen.getByText('[[old-file]]')).toBeInTheDocument()
        expect(screen.getByText('[[old-file|alias]]')).toBeInTheDocument()
      })
    })

    it('should handle files with many references', () => {
      const manyRefs = {
        filePath: '/workspace/file.md',
        references: Array(10).fill(null).map((_, i) => ({ fullMatch: `[[ref${i}]]` })),
      }

      render(<ReferenceUpdateModal {...defaultProps} affectedFiles={[manyRefs]} />)

      // Click to expand
      fireEvent.click(screen.getByText('file.md'))

      // Should show "+5 more..." since only first 5 are shown
      expect(screen.getByText('+5 more...')).toBeInTheDocument()
    })

    it('should handle string paths as affectedFiles', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={['/workspace/file1.md', '/workspace/file2.md']}
      />)

      expect(screen.getByText('file1.md')).toBeInTheDocument()
      expect(screen.getByText('file2.md')).toBeInTheDocument()
    })
  })

  describe('buttons', () => {
    it('should have Update References button', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[{ filePath: '/workspace/file.md' }]}
      />)

      // Button contains "Update References" text
      expect(screen.getByRole('button', { name: 'Update References' })).toBeInTheDocument()
    })

    it('should have Skip button', () => {
      render(<ReferenceUpdateModal {...defaultProps} />)

      expect(screen.getByText('Skip')).toBeInTheDocument()
    })

    it('should call onConfirm(true) when Update References is clicked', async () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[{ filePath: '/workspace/file.md' }]}
      />)

      fireEvent.click(screen.getByRole('button', { name: 'Update References' }))

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(true)
    })

    it('should call onConfirm(false) when Skip is clicked', () => {
      render(<ReferenceUpdateModal {...defaultProps} />)

      fireEvent.click(screen.getByText('Skip'))

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(false)
    })

    it('should disable Update References button when no affected files', () => {
      render(<ReferenceUpdateModal {...defaultProps} affectedFiles={[]} />)

      const button = screen.getByRole('button', { name: 'Update References' })
      expect(button).toBeDisabled()
    })

    it('should disable buttons when processing', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[{ filePath: '/workspace/file.md' }]}
        isProcessing={true}
      />)

      expect(screen.getByText('Skip')).toBeDisabled()
      expect(screen.getByText('Updating...')).toBeInTheDocument()
    })
  })

  describe('processing state', () => {
    it('should show processing indicator', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        isProcessing={true}
      />)

      expect(screen.getByText('Updating references...')).toBeInTheDocument()
    })

    it('should hide close button when processing', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        isProcessing={true}
      />)

      // The X button should not be visible
      const closeButtons = screen.queryAllByRole('button')
      const xButton = closeButtons.find(btn =>
        btn.querySelector('svg.lucide-x')
      )
      expect(xButton).toBeUndefined()
    })

    it('should prevent backdrop click when processing', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        isProcessing={true}
      />)

      // Find backdrop and click it
      const backdrop = document.querySelector('.bg-black\\/50')
      fireEvent.click(backdrop)

      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })
  })

  describe('result state', () => {
    const successResult = {
      updated: 3,
      files: ['/workspace/file1.md', '/workspace/file2.md', '/workspace/file3.md'],
    }

    it('should show success message', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        result={successResult}
      />)

      expect(screen.getByText(/Updated 3 files successfully/)).toBeInTheDocument()
    })

    it('should show Done button instead of Skip/Update', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        result={successResult}
      />)

      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Update References' })).not.toBeInTheDocument()
    })

    it('should call onClose when Done is clicked', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        result={successResult}
      />)

      fireEvent.click(screen.getByText('Done'))

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('should show checkmarks on updated files', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[
          { filePath: '/workspace/file1.md' },
          { filePath: '/workspace/file2.md' },
        ]}
        result={{
          updated: 2,
          files: ['/workspace/file1.md', '/workspace/file2.md'],
        }}
      />)

      // Should have green check icons
      const checks = document.querySelectorAll('.text-green-500')
      expect(checks.length).toBeGreaterThan(0)
    })

    it('should use singular form for one updated file', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        result={{ updated: 1, files: ['/workspace/file.md'] }}
      />)

      expect(screen.getByText(/Updated 1 file successfully/)).toBeInTheDocument()
    })

    it('should show "Update complete" in header', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        result={successResult}
      />)

      expect(screen.getByText('Update complete')).toBeInTheDocument()
    })
  })

  describe('keyboard shortcuts', () => {
    it('should close on Escape key', () => {
      render(<ReferenceUpdateModal {...defaultProps} />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('should confirm on Enter key when files exist', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[{ filePath: '/workspace/file.md' }]}
      />)

      fireEvent.keyDown(window, { key: 'Enter' })

      expect(defaultProps.onConfirm).toHaveBeenCalledWith(true)
    })

    it('should NOT confirm on Enter key when no files', () => {
      render(<ReferenceUpdateModal {...defaultProps} affectedFiles={[]} />)

      fireEvent.keyDown(window, { key: 'Enter' })

      expect(defaultProps.onConfirm).not.toHaveBeenCalled()
    })

    it('should NOT respond to keyboard when processing', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        isProcessing={true}
      />)

      fireEvent.keyDown(window, { key: 'Escape' })
      fireEvent.keyDown(window, { key: 'Enter' })

      expect(defaultProps.onClose).not.toHaveBeenCalled()
      expect(defaultProps.onConfirm).not.toHaveBeenCalled()
    })

    it('should NOT confirm on Shift+Enter', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[{ filePath: '/workspace/file.md' }]}
      />)

      fireEvent.keyDown(window, { key: 'Enter', shiftKey: true })

      expect(defaultProps.onConfirm).not.toHaveBeenCalled()
    })
  })

  describe('backdrop interaction', () => {
    it('should close when clicking backdrop', () => {
      render(<ReferenceUpdateModal {...defaultProps} />)

      const backdrop = document.querySelector('.bg-black\\/50')
      fireEvent.click(backdrop)

      expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('should NOT close backdrop when processing', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        isProcessing={true}
      />)

      const backdrop = document.querySelector('.bg-black\\/50')
      fireEvent.click(backdrop)

      expect(defaultProps.onClose).not.toHaveBeenCalled()
    })
  })

  describe('close button', () => {
    it('should have close button in header', () => {
      render(<ReferenceUpdateModal {...defaultProps} />)

      // Find the X icon button
      const closeButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-x') ||
        btn.innerHTML.includes('lucide-x')
      )
      expect(closeButton).toBeTruthy()
    })

    it('should call onClose when close button clicked', () => {
      render(<ReferenceUpdateModal {...defaultProps} />)

      // Click the first close-like button
      const buttons = screen.getAllByRole('button')
      const closeBtn = buttons.find(b => b.querySelector('.lucide-x'))
      if (closeBtn) {
        fireEvent.click(closeBtn)
        expect(defaultProps.onClose).toHaveBeenCalled()
      }
    })
  })

  describe('keyboard hints', () => {
    it('should show keyboard hints when not processing/result', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[{ filePath: '/workspace/file.md' }]}
      />)

      // Check for the specific keyboard hint text
      expect(screen.getByText(/Enter/)).toBeInTheDocument()
      expect(screen.getByText(/Esc/)).toBeInTheDocument()
    })

    it('should NOT show keyboard hints when processing', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[{ filePath: '/workspace/file.md' }]}
        isProcessing={true}
      />)

      // When processing, the hints disappear
      const hintsSection = screen.queryByText(/to skip/)
      expect(hintsSection).not.toBeInTheDocument()
    })

    it('should NOT show keyboard hints when result is shown', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        result={{ updated: 1, files: [] }}
      />)

      // When result is shown, Done button replaces hints
      const hintsSection = screen.queryByText(/to skip/)
      expect(hintsSection).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle missing oldPath', () => {
      render(<ReferenceUpdateModal {...defaultProps} oldPath={null} />)

      // Should not crash - header should still render
      expect(screen.getByRole('heading', { name: 'Update References' })).toBeInTheDocument()
    })

    it('should handle missing newPath', () => {
      render(<ReferenceUpdateModal {...defaultProps} newPath={null} />)

      // Should not crash - header should still render
      expect(screen.getByRole('heading', { name: 'Update References' })).toBeInTheDocument()
    })

    it('should handle paths not in workspace', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        oldPath="/other/path/file.md"
        newPath="/other/path/renamed.md"
      />)

      // Should show full paths
      expect(screen.getByText('/other/path/file.md')).toBeInTheDocument()
    })

    it('should handle affectedFiles with different shapes', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[
          { filePath: '/workspace/file1.md' },
          { path: '/workspace/file2.md' },
          '/workspace/file3.md',
        ]}
      />)

      expect(screen.getByText('file1.md')).toBeInTheDocument()
      expect(screen.getByText('file2.md')).toBeInTheDocument()
      expect(screen.getByText('file3.md')).toBeInTheDocument()
    })

    it('should handle files with title property', () => {
      render(<ReferenceUpdateModal
        {...defaultProps}
        affectedFiles={[
          { filePath: '/workspace/file1.md', title: 'Custom Title' },
        ]}
      />)

      expect(screen.getByText('Custom Title')).toBeInTheDocument()
    })
  })
})
