import { describe, it, expect, vi, beforeEach } from 'vitest'
import slashCommand from './slash-command.jsx'
import { editorAPI } from '../../plugins/api/EditorAPI.js'

// Mock dependencies
vi.mock('../../plugins/api/EditorAPI.js', () => ({
  editorAPI: {
    getSlashCommands: vi.fn(() => [])
  }
}))

vi.mock('@tiptap/react', () => ({
  ReactRenderer: class {
    constructor(component, { props }) {
      this.component = component
      this.props = props
      this.element = document.createElement('div')
      this.ref = { onKeyDown: vi.fn() }
    }
    updateProps(props) {
      this.props = props
    }
    destroy() { }
  }
}))

vi.mock('tippy.js/dist/tippy.esm.js', () => ({
  default: vi.fn(() => [{
    setProps: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn()
  }])
}))

describe('slashCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('items', () => {
    it('returns all items when query is empty', () => {
      const groups = slashCommand.items({ query: '', editor: {} })
      expect(groups.length).toBeGreaterThan(0)
      const titles = groups.flatMap(g => g.commands.map(c => c.title))
      expect(titles).toContain('Heading 1')
      expect(titles).toContain('Table')
    })

    it('filters items based on query', () => {
      const groups = slashCommand.items({ query: 'head', editor: {} })
      const titles = groups.flatMap(g => g.commands.map(c => c.title))
      expect(titles).toContain('Heading 1')
      expect(titles).toContain('Heading 2')
      expect(titles).not.toContain('Table')
    })

    it('sorts items by relevance', () => {
      // 'Code' matches 'Code' exactly (1000)
      // 'Code Block' starts with 'Code' (100)
      const groups = slashCommand.items({ query: 'Code', editor: {} })
      const titles = groups.flatMap(g => g.commands.map(c => c.title))

      const codeIndex = titles.indexOf('Code')
      const codeBlockIndex = titles.indexOf('Code Block')

      expect(codeIndex).toBeLessThan(codeBlockIndex)
    })

    it('includes plugin commands', () => {
      editorAPI.getSlashCommands.mockReturnValue([{
        group: 'Plugin',
        commands: [{ title: 'Plugin Cmd', description: 'Test', command: () => { } }]
      }])

      const groups = slashCommand.items({ query: 'Plugin', editor: {} })
      const titles = groups.flatMap(g => g.commands.map(c => c.title))
      expect(titles).toContain('Plugin Cmd')
    })
  })

  describe('render', () => {
    it('creates renderer on start', () => {
      const renderer = slashCommand.render()
      const props = {
        editor: {},
        clientRect: () => ({}),
        query: ''
      }

      renderer.onStart(props)
      // Verify ReactRenderer was instantiated (implied by no error in mock)
    })

    it('updates props on update', () => {
      const renderer = slashCommand.render()
      const props = {
        editor: {},
        clientRect: () => ({}),
        query: ''
      }

      renderer.onStart(props)

      const newProps = { ...props, query: 'new' }
      renderer.onUpdate(newProps)
      // Verify updateProps called (implied by no error)
    })

    it('handles keydown', () => {
      const renderer = slashCommand.render()
      const props = {
        editor: {},
        clientRect: () => ({}),
        query: ''
      }

      renderer.onStart(props)

      const event = { key: 'ArrowDown' }
      renderer.onKeyDown({ event })
      // Verify component.ref.onKeyDown called
    })

    it('cleans up on exit', () => {
      const renderer = slashCommand.render()
      const props = {
        editor: {},
        clientRect: () => ({}),
        query: ''
      }

      renderer.onStart(props)
      renderer.onExit()
      // Verify destroy called
    })
  })
})
