import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PluginPanel from './PluginPanel'

describe('PluginPanel Component', () => {
    const mockPlugins = [
        {
            id: 'plugin-1',
            enabled: true,
            ui: {
                panels: [
                    { id: 'panel-1', title: 'Panel 1', type: 'react-component', component: 'TestComponent' }
                ]
            }
        },
        {
            id: 'plugin-2',
            enabled: true,
            ui: {
                panels: [
                    { id: 'panel-2', title: 'Panel 2', type: 'webview', url: 'https://example.com' }
                ]
            }
        }
    ]

    it('renders nothing if no plugins available', () => {
        const { container } = render(<PluginPanel plugins={[]} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders active panel content', () => {
        render(
            <PluginPanel
                plugins={mockPlugins}
                activePanel="panel-1"
            />
        )

        expect(screen.getByText('Panel 1')).toBeInTheDocument()
        expect(screen.getByText('Plugin Component: TestComponent')).toBeInTheDocument()
    })

    it('renders webview panel', () => {
        render(
            <PluginPanel
                plugins={mockPlugins}
                activePanel="panel-2"
            />
        )

        expect(screen.getByText('Panel 2')).toBeInTheDocument()
        expect(screen.getByText('Webview: https://example.com')).toBeInTheDocument()
    })

    it('handles panel navigation', () => {
        const onPanelChange = vi.fn()
        render(
            <PluginPanel
                plugins={mockPlugins}
                activePanel="panel-1"
                onPanelChange={onPanelChange}
            />
        )

        const nextBtn = screen.getByTitle('Next panel')
        fireEvent.click(nextBtn)

        expect(onPanelChange).toHaveBeenCalledWith('panel-2')
    })

    it('handles collapse toggle', () => {
        const onToggleCollapse = vi.fn()
        render(
            <PluginPanel
                plugins={mockPlugins}
                activePanel="panel-1"
                collapsed={false}
                onToggleCollapse={onToggleCollapse}
            />
        )

        const collapseBtn = screen.getByTitle('Collapse panel')
        fireEvent.click(collapseBtn)

        expect(onToggleCollapse).toHaveBeenCalled()
    })

    it('handles close', () => {
        const onPanelClose = vi.fn()
        render(
            <PluginPanel
                plugins={mockPlugins}
                activePanel="panel-1"
                onPanelClose={onPanelClose}
            />
        )

        const closeBtn = screen.getByTitle('Close panel')
        fireEvent.click(closeBtn)

        expect(onPanelClose).toHaveBeenCalled()
    })
})
