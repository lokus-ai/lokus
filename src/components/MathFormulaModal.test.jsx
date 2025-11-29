import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MathFormulaModal from './MathFormulaModal'
import katex from 'katex'

// Mock katex
vi.mock('katex', () => ({
    default: {
        renderToString: vi.fn((tex) => `<span class="katex">${tex}</span>`)
    }
}))

describe('MathFormulaModal Component', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        onInsert: vi.fn(),
        mode: 'inline'
    }

    it('renders correctly', () => {
        render(<MathFormulaModal {...defaultProps} />)
        expect(screen.getByText('Insert Inline Math')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('x^2 + y^2 = r^2')).toBeInTheDocument()
    })

    it('updates preview when typing', () => {
        render(<MathFormulaModal {...defaultProps} />)

        const textarea = screen.getByPlaceholderText('x^2 + y^2 = r^2')
        fireEvent.change(textarea, { target: { value: 'E=mc^2' } })

        expect(katex.renderToString).toHaveBeenCalledWith('E=mc^2', expect.any(Object))
        expect(screen.getByText('Preview')).toBeInTheDocument()
    })

    it('inserts formula on button click', () => {
        render(<MathFormulaModal {...defaultProps} />)

        const textarea = screen.getByPlaceholderText('x^2 + y^2 = r^2')
        fireEvent.change(textarea, { target: { value: 'E=mc^2' } })

        fireEvent.click(screen.getByText('Insert Formula'))

        expect(defaultProps.onInsert).toHaveBeenCalledWith({
            formula: 'E=mc^2',
            mode: 'inline'
        })
    })

    it('handles examples', () => {
        render(<MathFormulaModal {...defaultProps} />)

        // Click on an example (e.g., Square)
        const exampleBtn = screen.getByTitle('x^2')
        fireEvent.click(exampleBtn)

        expect(screen.getByDisplayValue('x^2')).toBeInTheDocument()
    })

    it('shows error for invalid latex', () => {
        katex.renderToString.mockImplementationOnce(() => {
            throw new Error('Parse Error')
        })

        render(<MathFormulaModal {...defaultProps} />)

        const textarea = screen.getByPlaceholderText('x^2 + y^2 = r^2')
        fireEvent.change(textarea, { target: { value: '\\invalid' } })

        expect(screen.getByText('Parse Error')).toBeInTheDocument()
        expect(screen.getByText('Insert Formula')).toBeDisabled()
    })
})
