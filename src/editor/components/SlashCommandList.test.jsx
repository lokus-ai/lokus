import React, { act } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SlashCommandList from './SlashCommandList'

// Mock UI components
vi.mock('../../components/ui/command', () => ({
    Command: ({ children, ...props }) => <div data-testid="command" {...props}>{children}</div>,
    CommandList: React.forwardRef(({ children, ...props }, ref) => (
        <div data-testid="command-list" ref={ref} {...props}>{children}</div>
    )),
    CommandItem: ({ children, onSelect, ...props }) => (
        <div
            data-testid="command-item"
            onClick={() => onSelect(props.value?.toLowerCase())}
            {...props}
        >
            {children}
        </div>
    ),
    CommandGroup: ({ children, heading }) => (
        <div data-testid="command-group" title={heading}>
            {heading && <div>{heading}</div>}
            {children}
        </div>
    ),
    CommandEmpty: ({ children }) => <div data-testid="command-empty">{children}</div>,
    CommandSeparator: () => <div data-testid="command-separator" />
}))

describe('SlashCommandList', () => {
    const mockItems = [
        {
            group: 'Basic',
            commands: [
                { title: 'Text', description: 'Just plain text', icon: <span>T</span> },
                { title: 'Heading 1', description: 'Big heading', icon: <span>H1</span> }
            ]
        },
        {
            group: 'Advanced',
            commands: [
                { title: 'Code Block', description: 'Code snippet', icon: <span>C</span> }
            ]
        }
    ]

    const mockCommand = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders correctly with items', () => {
        render(<SlashCommandList items={mockItems} command={mockCommand} />)

        expect(screen.getByText('Basic')).toBeInTheDocument()
        expect(screen.getByText('Text')).toBeInTheDocument()
        expect(screen.getByText('Heading 1')).toBeInTheDocument()
        expect(screen.getByText('Advanced')).toBeInTheDocument()
        expect(screen.getByText('Code Block')).toBeInTheDocument()
    })

    it('shows empty state when no items', () => {
        render(<SlashCommandList items={[]} command={mockCommand} />)
        expect(screen.getByText('No results found.')).toBeInTheDocument()
    })

    it('handles keyboard navigation via ref', () => {
        const ref = React.createRef()
        render(<SlashCommandList items={mockItems} command={mockCommand} ref={ref} />)

        // Initial selection should be first item
        let items = screen.getAllByTestId('command-item')
        expect(items[0]).toHaveAttribute('aria-selected', 'true')
        expect(items[1]).toHaveAttribute('aria-selected', 'false')

        // ArrowDown
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowDown', preventDefault: vi.fn() } })
        })

        items = screen.getAllByTestId('command-item')
        expect(items[0]).toHaveAttribute('aria-selected', 'false')
        expect(items[1]).toHaveAttribute('aria-selected', 'true') // Heading 1

        // ArrowDown again (to Advanced group item)
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowDown', preventDefault: vi.fn() } })
        })

        items = screen.getAllByTestId('command-item')
        expect(items[2]).toHaveAttribute('aria-selected', 'true') // Code Block

        // ArrowUp (back to Heading 1)
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowUp', preventDefault: vi.fn() } })
        })

        items = screen.getAllByTestId('command-item')
        expect(items[1]).toHaveAttribute('aria-selected', 'true')
    })

    it('loops navigation', () => {
        const ref = React.createRef()
        render(<SlashCommandList items={mockItems} command={mockCommand} ref={ref} />)

        // ArrowUp from first item should go to last
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowUp', preventDefault: vi.fn() } })
        })

        let items = screen.getAllByTestId('command-item')
        expect(items[2]).toHaveAttribute('aria-selected', 'true') // Last item (Code Block)

        // ArrowDown from last item should go to first
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowDown', preventDefault: vi.fn() } })
        })

        items = screen.getAllByTestId('command-item')
        expect(items[0]).toHaveAttribute('aria-selected', 'true') // First item (Text)
    })

    it('triggers command on Enter', () => {
        const ref = React.createRef()
        render(<SlashCommandList items={mockItems} command={mockCommand} ref={ref} />)

        // Select second item
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowDown', preventDefault: vi.fn() } })
        })

        // Press Enter
        act(() => {
            ref.current.onKeyDown({ event: { key: 'Enter', preventDefault: vi.fn() } })
        })

        expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({ title: 'Heading 1' }))
    })

    it('triggers command on click', () => {
        render(<SlashCommandList items={mockItems} command={mockCommand} />)

        fireEvent.click(screen.getByText('Code Block'))

        expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({ title: 'Code Block' }))
    })

    it('updates selection when items change', () => {
        const { rerender } = render(<SlashCommandList items={mockItems} command={mockCommand} />)

        expect(screen.getByText('Text')).toBeInTheDocument()

        const newItems = [
            {
                group: 'New',
                commands: [
                    { title: 'New Item', description: 'New', icon: <span>N</span> }
                ]
            }
        ]

        rerender(<SlashCommandList items={newItems} command={mockCommand} />)

        expect(screen.getByText('New Item')).toBeInTheDocument()
        expect(screen.queryByText('Text')).not.toBeInTheDocument()

        const items = screen.getAllByTestId('command-item')
        expect(items[0]).toHaveAttribute('aria-selected', 'true')
    })
})
