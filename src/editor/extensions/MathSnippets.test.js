import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { lokusSchema } from '../schema/lokus-schema.js'
import {
    createMathSnippetsPlugins,
    insertMathSnippet,
    MathSnippetsPluginKey,
    parseTemplate,
} from './MathSnippets'
import { mathSnippets, mathSnippetCategories, getAllMathSnippets, searchMathSnippets } from '../lib/math-snippets-data'

describe('MathSnippets Extension (ProseMirror)', () => {
  let view

  beforeEach(() => {
    const state = EditorState.create({
      schema: lokusSchema,
      plugins: createMathSnippetsPlugins(lokusSchema),
    })
    view = new EditorView(document.createElement('div'), { state })
  })

  afterEach(() => {
    view.destroy()
  })

  it('should create plugins array', () => {
    const plugins = createMathSnippetsPlugins(lokusSchema)
    expect(Array.isArray(plugins)).toBe(true)
    expect(plugins.length).toBe(3) // inputRules + decoration plugin + keymap
  })

  it('should export MathSnippetsPluginKey', () => {
    expect(MathSnippetsPluginKey).toBeDefined()
  })

  it('should have initial snippet state as inactive', () => {
    const pluginState = MathSnippetsPluginKey.getState(view.state)
    expect(pluginState).toBeDefined()
    expect(pluginState.snippet.active).toBe(false)
    expect(pluginState.snippet.placeholders).toEqual([])
    expect(pluginState.snippet.currentIndex).toBe(0)
    expect(pluginState.snippet.basePos).toBe(0)
  })

  describe('insertMathSnippet command', () => {
    it('should insert a math snippet by name', () => {
      const result = insertMathSnippet(view, 'frac')
      expect(result).toBe(true)

      // The snippet text should be in the document
      const text = view.state.doc.textContent
      expect(text).toContain('\\frac')
    })

    it('should return false for unknown snippet', () => {
      const result = insertMathSnippet(view, 'nonexistent_snippet_xyz')
      expect(result).toBe(false)
    })

    it('should activate snippet mode when placeholders exist', () => {
      insertMathSnippet(view, 'frac')
      const pluginState = MathSnippetsPluginKey.getState(view.state)
      expect(pluginState.snippet.active).toBe(true)
      expect(pluginState.snippet.placeholders.length).toBeGreaterThan(0)
    })
  })

  describe('parseTemplate', () => {
    it('should parse template with placeholders', () => {
      const result = parseTemplate('$\\frac{${1:num}}{${2:den}}$')
      expect(result.text).toBe('$\\frac{num}{den}$')
      expect(result.placeholders.length).toBe(2)
      expect(result.placeholders[0].index).toBe(1)
      expect(result.placeholders[0].defaultText).toBe('num')
      expect(result.placeholders[1].index).toBe(2)
      expect(result.placeholders[1].defaultText).toBe('den')
    })

    it('should parse template without placeholders', () => {
      const result = parseTemplate('$\\pi$')
      expect(result.text).toBe('$\\pi$')
      expect(result.placeholders.length).toBe(0)
    })

    it('should sort placeholders by index', () => {
      const result = parseTemplate('${2:b} ${1:a}')
      expect(result.placeholders[0].index).toBe(1)
      expect(result.placeholders[1].index).toBe(2)
    })
  })
})

describe('Math Snippets Data', () => {
  describe('mathSnippets object', () => {
    it('should export snippets object', () => {
      expect(typeof mathSnippets).toBe('object')
      expect(Object.keys(mathSnippets).length).toBeGreaterThan(50)
    })

    it('should have required properties for each snippet', () => {
      Object.entries(mathSnippets).forEach(([key, snippet]) => {
        expect(snippet).toHaveProperty('name')
        expect(snippet).toHaveProperty('category')
        expect(snippet).toHaveProperty('template')
        expect(snippet).toHaveProperty('preview')
        expect(typeof snippet.name).toBe('string')
        expect(typeof snippet.category).toBe('string')
        expect(typeof snippet.template).toBe('string')
        expect(typeof snippet.preview).toBe('string')
      })
    })
  })

  describe('Matrices & Vectors', () => {
    it('should have 2x2 matrix', () => {
      expect(mathSnippets.mat2).toBeDefined()
      expect(mathSnippets.mat2.name).toBe('2\u00D72 Matrix')
      expect(mathSnippets.mat2.category).toBe('matrices')
      expect(mathSnippets.mat2.template).toContain('pmatrix')
      expect(mathSnippets.mat2.template).toContain('${1:')
    })

    it('should have 3x3 matrix', () => {
      expect(mathSnippets.mat3).toBeDefined()
      expect(mathSnippets.mat3.template).toContain('pmatrix')
    })

    it('should have 4x4 matrix', () => {
      expect(mathSnippets.mat4).toBeDefined()
    })

    it('should have column vectors', () => {
      expect(mathSnippets.vec2).toBeDefined()
      expect(mathSnippets.vec3).toBeDefined()
      expect(mathSnippets.vec4).toBeDefined()
    })

    it('should have row vectors', () => {
      expect(mathSnippets.rvec2).toBeDefined()
      expect(mathSnippets.rvec3).toBeDefined()
    })

    it('should have determinants', () => {
      expect(mathSnippets.det2).toBeDefined()
      expect(mathSnippets.det2.template).toContain('vmatrix')
      expect(mathSnippets.det3).toBeDefined()
    })

    it('should have bracketed matrices', () => {
      expect(mathSnippets.bmat2).toBeDefined()
      expect(mathSnippets.bmat2.template).toContain('bmatrix')
      expect(mathSnippets.bmat3).toBeDefined()
    })

    it('should have augmented matrix', () => {
      expect(mathSnippets.augmat).toBeDefined()
      expect(mathSnippets.augmat.template).toContain('array')
    })

    it('should have identity matrices', () => {
      expect(mathSnippets.imat2).toBeDefined()
      expect(mathSnippets.imat3).toBeDefined()
    })
  })

  describe('Fractions & Roots', () => {
    it('should have fraction', () => {
      expect(mathSnippets.frac).toBeDefined()
      expect(mathSnippets.frac.template).toContain('\\frac')
      expect(mathSnippets.frac.template).toContain('${1:num}')
      expect(mathSnippets.frac.template).toContain('${2:den}')
    })

    it('should have display fraction', () => {
      expect(mathSnippets.dfrac).toBeDefined()
      expect(mathSnippets.dfrac.template).toContain('\\dfrac')
    })

    it('should have text fraction', () => {
      expect(mathSnippets.tfrac).toBeDefined()
      expect(mathSnippets.tfrac.template).toContain('\\tfrac')
    })

    it('should have square root', () => {
      expect(mathSnippets.sfrac).toBeDefined()
      expect(mathSnippets.sfrac.template).toContain('\\sqrt')
    })

    it('should have nth root', () => {
      expect(mathSnippets.nroot).toBeDefined()
      expect(mathSnippets.nroot.template).toContain('\\sqrt[')
    })

    it('should have continued fraction', () => {
      expect(mathSnippets.cfrac).toBeDefined()
      expect(mathSnippets.cfrac.template).toContain('\\cfrac')
    })
  })

  describe('Calculus', () => {
    it('should have definite integral', () => {
      expect(mathSnippets.intg).toBeDefined()
      expect(mathSnippets.intg.template).toContain('\\int_')
    })

    it('should have double integral', () => {
      expect(mathSnippets.iint).toBeDefined()
      expect(mathSnippets.iint.template).toContain('\\iint')
    })

    it('should have triple integral', () => {
      expect(mathSnippets.iiint).toBeDefined()
      expect(mathSnippets.iiint.template).toContain('\\iiint')
    })

    it('should have contour integral', () => {
      expect(mathSnippets.oint).toBeDefined()
      expect(mathSnippets.oint.template).toContain('\\oint')
    })

    it('should have indefinite integral', () => {
      expect(mathSnippets.uint).toBeDefined()
    })

    it('should have derivatives', () => {
      expect(mathSnippets.dv).toBeDefined()
      expect(mathSnippets.dv.template).toContain('\\frac{d')
      expect(mathSnippets.ddv).toBeDefined()
      expect(mathSnippets.ddv.template).toContain('d^2')
    })

    it('should have partial derivatives', () => {
      expect(mathSnippets.pdv).toBeDefined()
      expect(mathSnippets.pdv.template).toContain('\\partial')
      expect(mathSnippets.ppdv).toBeDefined()
      expect(mathSnippets.mpdv).toBeDefined()
    })

    it('should have limits', () => {
      expect(mathSnippets.lim).toBeDefined()
      expect(mathSnippets.lim.template).toContain('\\lim')
      expect(mathSnippets.limn).toBeDefined()
      expect(mathSnippets.limn.template).toContain('\\infty')
      expect(mathSnippets.liminf).toBeDefined()
      expect(mathSnippets.limsup).toBeDefined()
    })

    it('should have vector calculus operators', () => {
      expect(mathSnippets.grad).toBeDefined()
      expect(mathSnippets.grad.template).toContain('\\nabla')
      expect(mathSnippets.divg).toBeDefined()
      expect(mathSnippets.divg.template).toContain('\\cdot')
      expect(mathSnippets.curl).toBeDefined()
      expect(mathSnippets.curl.template).toContain('\\times')
      expect(mathSnippets.lapl).toBeDefined()
      expect(mathSnippets.lapl.template).toContain('\\nabla^2')
    })
  })

  describe('Sums & Products', () => {
    it('should have summation', () => {
      expect(mathSnippets.ssum).toBeDefined()
      expect(mathSnippets.ssum.template).toContain('\\sum_')
    })

    it('should have infinite sum', () => {
      expect(mathSnippets.ssuminf).toBeDefined()
      expect(mathSnippets.ssuminf.template).toContain('\\infty')
    })

    it('should have product', () => {
      expect(mathSnippets.prod).toBeDefined()
      expect(mathSnippets.prod.template).toContain('\\prod_')
    })

    it('should have big union and intersection', () => {
      expect(mathSnippets.bcup).toBeDefined()
      expect(mathSnippets.bcup.template).toContain('\\bigcup')
      expect(mathSnippets.bcap).toBeDefined()
      expect(mathSnippets.bcap.template).toContain('\\bigcap')
    })
  })

  describe('Subscripts & Superscripts', () => {
    it('should have subscript', () => {
      expect(mathSnippets.sub).toBeDefined()
      expect(mathSnippets.sub.template).toContain('_{')
    })

    it('should have superscript', () => {
      expect(mathSnippets.sup).toBeDefined()
      expect(mathSnippets.sup.template).toContain('^{')
    })

    it('should have combined sub/superscript', () => {
      expect(mathSnippets.subsup).toBeDefined()
      expect(mathSnippets.subsup.template).toContain('_{')
      expect(mathSnippets.subsup.template).toContain('^{')
    })
  })

  describe('Linear Algebra', () => {
    it('should have norm', () => {
      expect(mathSnippets.norm).toBeDefined()
      expect(mathSnippets.norm.template).toContain('\\|')
    })

    it('should have p-norm', () => {
      expect(mathSnippets.pnorm).toBeDefined()
    })

    it('should have absolute value', () => {
      expect(mathSnippets.abs).toBeDefined()
    })

    it('should have inner product', () => {
      expect(mathSnippets.inner).toBeDefined()
      expect(mathSnippets.inner.template).toContain('\\langle')
      expect(mathSnippets.inner.template).toContain('\\rangle')
    })

    it('should have outer product', () => {
      expect(mathSnippets.outer).toBeDefined()
      expect(mathSnippets.outer.template).toContain('\\otimes')
    })

    it('should have cross and dot products', () => {
      expect(mathSnippets.cross).toBeDefined()
      expect(mathSnippets.dot).toBeDefined()
    })

    it('should have transpose and inverse', () => {
      expect(mathSnippets.trans).toBeDefined()
      expect(mathSnippets.trans.template).toContain('\\top')
      expect(mathSnippets.inv).toBeDefined()
      expect(mathSnippets.inv.template).toContain('^{-1}')
    })

    it('should have trace, rank, diag', () => {
      expect(mathSnippets.trace).toBeDefined()
      expect(mathSnippets.rank).toBeDefined()
      expect(mathSnippets.diag).toBeDefined()
    })
  })

  describe('Statistics & Probability', () => {
    it('should have expectation', () => {
      expect(mathSnippets.expect).toBeDefined()
      expect(mathSnippets.expect.template).toContain('\\mathbb{E}')
    })

    it('should have variance and covariance', () => {
      expect(mathSnippets.vari).toBeDefined()
      expect(mathSnippets.cov).toBeDefined()
      expect(mathSnippets.corr).toBeDefined()
    })

    it('should have probability', () => {
      expect(mathSnippets.prob).toBeDefined()
      expect(mathSnippets.cprob).toBeDefined()
      expect(mathSnippets.cprob.template).toContain('\\mid')
    })

    it('should have normal distribution', () => {
      expect(mathSnippets.normal).toBeDefined()
      expect(mathSnippets.normal.template).toContain('\\mathcal{N}')
    })

    it('should have binomial coefficient', () => {
      expect(mathSnippets.binom).toBeDefined()
      expect(mathSnippets.binom.template).toContain('\\binom')
    })

    it('should have mean and standard deviation', () => {
      expect(mathSnippets.mean).toBeDefined()
      expect(mathSnippets.mean.template).toContain('\\overline')
      expect(mathSnippets.sdev).toBeDefined()
    })
  })

  describe('Set Theory', () => {
    it('should have set builder notation', () => {
      expect(mathSnippets.sset).toBeDefined()
      expect(mathSnippets.sset.template).toContain('\\mid')
    })

    it('should have number sets', () => {
      expect(mathSnippets.reals).toBeDefined()
      expect(mathSnippets.reals.template).toContain('\\mathbb{R}')
      expect(mathSnippets.complex).toBeDefined()
      expect(mathSnippets.complex.template).toContain('\\mathbb{C}')
      expect(mathSnippets.naturals).toBeDefined()
      expect(mathSnippets.naturals.template).toContain('\\mathbb{N}')
      expect(mathSnippets.integers).toBeDefined()
      expect(mathSnippets.integers.template).toContain('\\mathbb{Z}')
      expect(mathSnippets.rationals).toBeDefined()
      expect(mathSnippets.rationals.template).toContain('\\mathbb{Q}')
    })

    it('should have R^n', () => {
      expect(mathSnippets.realn).toBeDefined()
    })

    it('should have power set', () => {
      expect(mathSnippets.powset).toBeDefined()
      expect(mathSnippets.powset.template).toContain('\\mathcal{P}')
    })
  })

  describe('Physics', () => {
    it('should have unit vector', () => {
      expect(mathSnippets.vhat).toBeDefined()
      expect(mathSnippets.vhat.template).toContain('\\hat')
    })

    it('should have vector arrow', () => {
      expect(mathSnippets.varr).toBeDefined()
      expect(mathSnippets.varr.template).toContain('\\vec')
    })

    it('should have bold vector', () => {
      expect(mathSnippets.bfv).toBeDefined()
      expect(mathSnippets.bfv.template).toContain('\\mathbf')
    })

    it('should have bra-ket notation', () => {
      expect(mathSnippets.bra).toBeDefined()
      expect(mathSnippets.bra.template).toContain('\\langle')
      expect(mathSnippets.ket).toBeDefined()
      expect(mathSnippets.ket.template).toContain('\\rangle')
      expect(mathSnippets.braket).toBeDefined()
    })

    it('should have commutator and anti-commutator', () => {
      expect(mathSnippets.comm).toBeDefined()
      expect(mathSnippets.acomm).toBeDefined()
    })
  })

  describe('Chemistry', () => {
    it('should have isotope notation', () => {
      expect(mathSnippets.isotope).toBeDefined()
    })

    it('should have reaction arrows', () => {
      expect(mathSnippets.rxn).toBeDefined()
      expect(mathSnippets.rxn.template).toContain('\\rightarrow')
      expect(mathSnippets.eqrxn).toBeDefined()
      expect(mathSnippets.eqrxn.template).toContain('\\rightleftharpoons')
    })
  })

  describe('Common Equations', () => {
    it('should have quadratic formula', () => {
      expect(mathSnippets.quad).toBeDefined()
      expect(mathSnippets.quad.template).toContain('\\sqrt')
      expect(mathSnippets.quad.template).toContain('\\pm')
    })

    it('should have Taylor series', () => {
      expect(mathSnippets.taylor).toBeDefined()
      expect(mathSnippets.taylor.template).toContain('\\sum')
    })

    it('should have Euler formula', () => {
      expect(mathSnippets.euler).toBeDefined()
      expect(mathSnippets.euler.template).toContain('\\cos')
      expect(mathSnippets.euler.template).toContain('\\sin')
    })

    it('should have Pythagorean theorem', () => {
      expect(mathSnippets.pytho).toBeDefined()
    })
  })

  describe('Logic', () => {
    it('should have quantifiers', () => {
      expect(mathSnippets.fall).toBeDefined()
      expect(mathSnippets.fall.template).toContain('\\forall')
      expect(mathSnippets.exst).toBeDefined()
      expect(mathSnippets.exst.template).toContain('\\exists')
      expect(mathSnippets.nexst).toBeDefined()
      expect(mathSnippets.nexst.template).toContain('\\nexists')
    })
  })

  describe('Miscellaneous', () => {
    it('should have piecewise/cases', () => {
      expect(mathSnippets.cases).toBeDefined()
      expect(mathSnippets.cases.template).toContain('\\begin{cases}')
    })

    it('should have floor and ceiling', () => {
      expect(mathSnippets.floor).toBeDefined()
      expect(mathSnippets.floor.template).toContain('\\lfloor')
      expect(mathSnippets.ceil).toBeDefined()
      expect(mathSnippets.ceil.template).toContain('\\lceil')
    })

    it('should have cancel', () => {
      expect(mathSnippets.cancel).toBeDefined()
      expect(mathSnippets.cancel.template).toContain('\\cancel')
    })

    it('should have boxed', () => {
      expect(mathSnippets.boxed).toBeDefined()
      expect(mathSnippets.boxed.template).toContain('\\boxed')
    })

    it('should have underline and overline', () => {
      expect(mathSnippets.undl).toBeDefined()
      expect(mathSnippets.ovrl).toBeDefined()
    })

    it('should have underbraces and overbraces', () => {
      expect(mathSnippets.underbr).toBeDefined()
      expect(mathSnippets.underbr.template).toContain('\\underbrace')
      expect(mathSnippets.overbr).toBeDefined()
      expect(mathSnippets.overbr.template).toContain('\\overbrace')
    })

    it('should have text in math mode', () => {
      expect(mathSnippets.txt).toBeDefined()
      expect(mathSnippets.txt.template).toContain('\\text')
    })
  })

  describe('Template Placeholders', () => {
    it('should have valid placeholder syntax in all templates', () => {
      const placeholderRegex = /\$\{(\d+)(?::([^}]*))?\}/g

      Object.entries(mathSnippets).forEach(([key, snippet]) => {
        const matches = [...snippet.template.matchAll(placeholderRegex)]

        // Each template should have at least one placeholder or be a static template
        if (matches.length > 0) {
          // Check placeholder indices are valid numbers
          matches.forEach(match => {
            const index = parseInt(match[1], 10)
            expect(index).toBeGreaterThanOrEqual(1)
            expect(index).toBeLessThanOrEqual(20) // reasonable max
          })

          // Check indices are sequential starting from 1
          const indices = matches.map(m => parseInt(m[1], 10)).sort((a, b) => a - b)
          expect(indices[0]).toBe(1)
        }
      })
    })

    it('should wrap templates in $ for inline math', () => {
      Object.entries(mathSnippets).forEach(([key, snippet]) => {
        expect(snippet.template.startsWith('$')).toBe(true)
        expect(snippet.template.endsWith('$')).toBe(true)
      })
    })
  })
})

describe('mathSnippetCategories', () => {
  it('should have category metadata', () => {
    expect(mathSnippetCategories).toBeDefined()
    expect(typeof mathSnippetCategories).toBe('object')
  })

  it('should have required properties for each category', () => {
    Object.entries(mathSnippetCategories).forEach(([key, category]) => {
      expect(category).toHaveProperty('name')
      expect(category).toHaveProperty('icon')
      expect(typeof category.name).toBe('string')
      expect(typeof category.icon).toBe('string')
    })
  })

  it('should have all categories used by snippets', () => {
    const usedCategories = new Set(
      Object.values(mathSnippets).map(s => s.category)
    )

    usedCategories.forEach(cat => {
      expect(mathSnippetCategories[cat]).toBeDefined()
    })
  })
})

describe('getAllMathSnippets', () => {
  it('should return array of all snippets', () => {
    const all = getAllMathSnippets()
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBe(Object.keys(mathSnippets).length)
  })

  it('should include shortcut key in each item', () => {
    const all = getAllMathSnippets()
    all.forEach(item => {
      expect(item).toHaveProperty('shortcut')
      expect(typeof item.shortcut).toBe('string')
    })
  })
})

describe('searchMathSnippets', () => {
  it('should search by shortcut name', () => {
    const results = searchMathSnippets('mat')
    expect(results.length).toBeGreaterThan(0)
    results.forEach(r => {
      expect(
        r.shortcut.includes('mat') ||
        r.name.toLowerCase().includes('mat') ||
        r.category.includes('mat')
      ).toBe(true)
    })
  })

  it('should search by category', () => {
    const results = searchMathSnippets('matrices')
    expect(results.length).toBeGreaterThan(0)
  })

  it('should search by name', () => {
    const results = searchMathSnippets('fraction')
    expect(results.length).toBeGreaterThan(0)
  })

  it('should be case-insensitive', () => {
    const lower = searchMathSnippets('matrix')
    const upper = searchMathSnippets('MATRIX')
    expect(lower.length).toBe(upper.length)
  })

  it('should return empty array for no matches', () => {
    const results = searchMathSnippets('xyznonexistent123')
    expect(results).toEqual([])
  })
})
