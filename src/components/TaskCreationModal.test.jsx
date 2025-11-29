import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TaskCreationModal from './TaskCreationModal'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn()
}))

describe('TaskCreationModal Component', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onCreateTask: vi.fn()
    }

    beforeEach(() => {
        vi.clearAllMocks()
        // Mock global workspace path
        globalThis.__LOKUS_WORKSPACE_PATH__ = '/test/workspace'
    })

    it('loads boards on open', async () => {
        invoke.mockResolvedValue([
            { name: 'Board 1', path: '/path/board1.kanban' },
            { name: 'Board 2', path: '/path/board2.kanban' }
        ])

        render(<TaskCreationModal {...defaultProps} />)

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('list_kanban_boards', { workspacePath: '/test/workspace' })
        })

        expect(screen.getByText('Board 1')).toBeInTheDocument()
        expect(screen.getByText('Board 2')).toBeInTheDocument()
    })

    it('creates task in default column', async () => {
        invoke.mockImplementation((cmd) => {
            if (cmd === 'list_kanban_boards') return Promise.resolve([{ name: 'Board 1', path: '/path/board1.kanban' }])
            if (cmd === 'open_kanban_board') return Promise.resolve({
                columns: {
                    'col1': { name: 'To-Do', order: 0 }
                }
            })
            if (cmd === 'add_card_to_board') return Promise.resolve()
            return Promise.resolve()
        })

        render(<TaskCreationModal {...defaultProps} />)

        const input = screen.getByPlaceholderText('Task name...')
        fireEvent.change(input, { target: { value: 'New Task' } })

        // Select board (click or Enter)
        await waitFor(() => screen.getByText('Board 1'))

        // Simulate Enter key on task input while board is selected (default behavior)
        fireEvent.keyDown(input, { key: 'Enter' })

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('add_card_to_board', {
                boardPath: '/path/board1.kanban',
                columnId: 'col1',
                title: 'New Task',
                description: null,
                tags: [],
                priority: 'normal'
            })
        })

        expect(defaultProps.onCreateTask).toHaveBeenCalled()
        expect(defaultProps.onClose).toHaveBeenCalled()
    })

    it('allows selecting specific column', async () => {
        invoke.mockImplementation((cmd) => {
            if (cmd === 'list_kanban_boards') return Promise.resolve([{ name: 'Board 1', path: '/path/board1.kanban' }])
            if (cmd === 'open_kanban_board') return Promise.resolve({
                columns: {
                    'col1': { name: 'To-Do', order: 0 },
                    'col2': { name: 'Doing', order: 1 }
                }
            })
            if (cmd === 'add_card_to_board') return Promise.resolve()
            return Promise.resolve()
        })

        render(<TaskCreationModal {...defaultProps} />)

        const input = screen.getByPlaceholderText('Task name...')
        fireEvent.change(input, { target: { value: 'New Task' } })

        await waitFor(() => screen.getByText('Board 1'))

        // Press Tab to show columns
        fireEvent.keyDown(screen.getByText('Board 1').closest('div'), { key: 'Tab' })

        await waitFor(() => {
            expect(screen.getByText('Doing')).toBeInTheDocument()
        })

        // Click on 'Doing' column
        fireEvent.click(screen.getByText('Doing'))

        await waitFor(() => {
            expect(invoke).toHaveBeenCalledWith('add_card_to_board', expect.objectContaining({
                columnId: 'col2'
            }))
        })
    })
})
