import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TagManagementModal from './TagManagementModal'
import { invoke } from '@tauri-apps/api/core'
import { noteMutationClient } from '../core/notes/NoteMutationClient'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))
vi.mock('../core/notes/NoteMutationClient', () => ({
    noteMutationClient: {
        writeNote: vi.fn().mockResolvedValue({ legacy: true })
    }
}))

describe('TagManagementModal Component', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        file: { path: '/test/note.md', name: 'note.md' },
        onTagsUpdated: vi.fn()
    }

    beforeEach(() => {
        vi.clearAllMocks()
        window.__WORKSPACE_PATH__ = '/test'
    })

    it('loads tags from file on open', async () => {
        invoke.mockResolvedValue('---\ntags: [tag1, tag2]\n---\nContent')

        render(<TagManagementModal {...defaultProps} />)

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('read_file_content', {
                workspacePath: '/test',
                path: '/test/note.md'
            })
        })

        expect(screen.getByText('tag1')).toBeInTheDocument()
        expect(screen.getByText('tag2')).toBeInTheDocument()
    })

    it('adds a new tag', async () => {
        invoke.mockResolvedValue('---\ntags: []\n---\nContent')

        render(<TagManagementModal {...defaultProps} />)

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('Loading tags...')).not.toBeInTheDocument()
        })

        const input = screen.getByPlaceholderText('Enter tag name...')
        fireEvent.change(input, { target: { value: 'new-tag' } })

        fireEvent.click(screen.getByText('Add'))

        expect(screen.getByText('new-tag')).toBeInTheDocument()
    })

    it('removes a tag', async () => {
        invoke.mockResolvedValue('---\ntags: [tag1]\n---\nContent')

        render(<TagManagementModal {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('tag1')).toBeInTheDocument()
        })

        const removeBtn = screen.getByText('tag1').querySelector('button')
        fireEvent.click(removeBtn)

        expect(screen.queryByText('tag1')).not.toBeInTheDocument()
    })

    it('saves changes to file', async () => {
        invoke.mockResolvedValue('---\ntags: [old]\n---\nContent')

        render(<TagManagementModal {...defaultProps} />)

        await waitFor(() => {
            expect(screen.getByText('old')).toBeInTheDocument()
        })

        // Add new tag
        const input = screen.getByPlaceholderText('Enter tag name...')
        fireEvent.change(input, { target: { value: 'new' } })
        fireEvent.click(screen.getByText('Add'))

        // Save
        fireEvent.click(screen.getByText('Save Changes'))

        await waitFor(() => {
            expect(noteMutationClient.writeNote).toHaveBeenCalledWith({
                workspacePath: '/test',
                path: '/test/note.md',
                content: expect.stringContaining('tags: ["old", "new"]'),
                baseContent: '---\ntags: [old]\n---\nContent',
                source: 'tag-management'
            })
        })

        expect(defaultProps.onTagsUpdated).toHaveBeenCalled()
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('handles empty frontmatter correctly', async () => {
        invoke.mockResolvedValue('Just content')

        render(<TagManagementModal {...defaultProps} />)

        const input = screen.getByPlaceholderText('Enter tag name...')
        fireEvent.change(input, { target: { value: 'tag1' } })
        fireEvent.click(screen.getByText('Add'))

        fireEvent.click(screen.getByText('Save Changes'))

        await waitFor(() => {
            expect(noteMutationClient.writeNote).toHaveBeenCalledWith({
                workspacePath: '/test',
                path: '/test/note.md',
                content: expect.stringContaining('---\ntags: ["tag1"]\n---\n\nJust content'),
                baseContent: 'Just content',
                source: 'tag-management'
            })
        })
    })
})
