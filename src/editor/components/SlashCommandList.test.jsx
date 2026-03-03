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
    // The real CommandItem renders with className prop. We preserve it so the
    // test can check for the selection highlight class.
    CommandItem: ({ children, onSelect, className, ...props }) => (
        <div
            data-testid="command-item"
            className={className || ''}
            onClick={() => onSelect && onSelect(props.value?.toLowerCase())}
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

    it('handles keyboard navigation via ref — first item is selected initially', () => {
        const ref = React.createRef()
        render(<SlashCommandList items={mockItems} command={mockCommand} ref={ref} />)

        // Initial selection: first item has the highlight class, others do not
        let items = screen.getAllByTestId('command-item')
        expect(items[0].className).toContain('bg-app-accent')
        expect(items[1].className).not.toContain('bg-app-accent')

        // ArrowDown moves selection to second item
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowDown', preventDefault: vi.fn() } })
        })

        items = screen.getAllByTestId('command-item')
        expect(items[0].className).not.toContain('bg-app-accent')
        expect(items[1].className).toContain('bg-app-accent') // Heading 1

        // ArrowDown again moves to third item (Code Block in Advanced group)
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowDown', preventDefault: vi.fn() } })
        })

        items = screen.getAllByTestId('command-item')
        expect(items[2].className).toContain('bg-app-accent') // Code Block

        // ArrowUp moves back to Heading 1
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowUp', preventDefault: vi.fn() } })
        })

        items = screen.getAllByTestId('command-item')
        expect(items[1].className).toContain('bg-app-accent')
    })

    it('loops navigation', () => {
        const ref = React.createRef()
        render(<SlashCommandList items={mockItems} command={mockCommand} ref={ref} />)

        // ArrowUp from first item should wrap to last
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowUp', preventDefault: vi.fn() } })
        })

        let items = screen.getAllByTestId('command-item')
        expect(items[2].className).toContain('bg-app-accent') // Last item (Code Block)

        // ArrowDown from last item should wrap to first
        act(() => {
            ref.current.onKeyDown({ event: { key: 'ArrowDown', preventDefault: vi.fn() } })
        })

        items = screen.getAllByTestId('command-item')
        expect(items[0].className).toContain('bg-app-accent') // First item (Text)
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

    it('resets selection to first item when items change', () => {
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
        // After re-render with new items, the first (and only) item is selected
        expect(items[0].className).toContain('bg-app-accent')
    })
})
