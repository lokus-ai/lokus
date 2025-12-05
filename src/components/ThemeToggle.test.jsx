import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeToggle from './ui/ThemeToggle'

// 1. Mock the hook so we can control it and spy on functions
const mockSetMode = vi.fn()
const mockSetAccent = vi.fn()

vi.mock('../hooks/theme.jsx', () => ({
    useTheme: () => ({
        mode: 'light',
        accent: 'violet',
        setMode: mockSetMode,
        setAccent: mockSetAccent
    })
}))

describe('ThemeToggle Component', () => {
    it('renders the toggle button with current mode', () => {
        render(<ThemeToggle />)

        // Check if button exists and displays correct text
        // This verifies the UI is rendering correctly based on state
        const button = screen.getByRole('button', { name: /Light/i })
        expect(button).toBeInTheDocument()
    })

    it('calls setMode when clicked', () => {
        render(<ThemeToggle />)

        const button = screen.getByRole('button', { name: /Light/i })

        // 2. Simulate a real user click
        fireEvent.click(button)

        // 3. Verify the "wiring": Did the click trigger the function?
        expect(mockSetMode).toHaveBeenCalledWith('dark')
    })

    it('renders accent color buttons', () => {
        render(<ThemeToggle />)

        // Check if we have the color swatches
        // We can find them by their title attribute
        const blueButton = screen.getByTitle('blue')
        expect(blueButton).toBeInTheDocument()
    })

    it('calls setAccent when a color is clicked', () => {
        render(<ThemeToggle />)

        const blueButton = screen.getByTitle('blue')

        // Simulate click on blue swatch
        fireEvent.click(blueButton)

        // Verify it sent the right command
        expect(mockSetAccent).toHaveBeenCalledWith('blue')
    })
})
