import { describe, it, expect, beforeEach } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import SymbolShortcuts, { getBuiltinSymbols } from './SymbolShortcuts'

describe('SymbolShortcuts Extension', () => {
  let editor

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit,
        SymbolShortcuts.configure({ customSymbols: {} })
      ],
      content: '<p></p>'
    })
  })

  it('should have correct name', () => {
    expect(SymbolShortcuts.name).toBe('symbolShortcuts')
  })

  it('should have input rules defined', () => {
    expect(SymbolShortcuts.config.addInputRules).toBeDefined()
  })

  describe('getBuiltinSymbols', () => {
    const symbols = getBuiltinSymbols()

    it('should export builtin symbols', () => {
      expect(typeof symbols).toBe('object')
      expect(Object.keys(symbols).length).toBeGreaterThan(100)
    })

    // Greek lowercase
    it('should have Greek lowercase letters', () => {
      expect(symbols.alpha).toBe('α')
      expect(symbols.beta).toBe('β')
      expect(symbols.gamma).toBe('γ')
      expect(symbols.delta).toBe('δ')
      expect(symbols.epsilon).toBe('ε')
      expect(symbols.zeta).toBe('ζ')
      expect(symbols.eta).toBe('η')
      expect(symbols.theta).toBe('θ')
      expect(symbols.iota).toBe('ι')
      expect(symbols.kappa).toBe('κ')
      expect(symbols.lambda).toBe('λ')
      expect(symbols.mu).toBe('μ')
      expect(symbols.nu).toBe('ν')
      expect(symbols.xi).toBe('ξ')
      expect(symbols.omicron).toBe('ο')
      expect(symbols.pi).toBe('π')
      expect(symbols.rho).toBe('ρ')
      expect(symbols.sigma).toBe('σ')
      expect(symbols.tau).toBe('τ')
      expect(symbols.upsilon).toBe('υ')
      expect(symbols.phi).toBe('φ')
      expect(symbols.chi).toBe('χ')
      expect(symbols.psi).toBe('ψ')
      expect(symbols.omega).toBe('ω')
    })

    // Greek uppercase
    it('should have Greek uppercase letters', () => {
      expect(symbols.Alpha).toBe('Α')
      expect(symbols.Beta).toBe('Β')
      expect(symbols.Gamma).toBe('Γ')
      expect(symbols.Delta).toBe('Δ')
      expect(symbols.Theta).toBe('Θ')
      expect(symbols.Lambda).toBe('Λ')
      expect(symbols.Pi).toBe('Π')
      expect(symbols.Sigma).toBe('Σ')
      expect(symbols.Phi).toBe('Φ')
      expect(symbols.Psi).toBe('Ψ')
      expect(symbols.Omega).toBe('Ω')
    })

    // Arrows
    it('should have arrow symbols', () => {
      expect(symbols.arrow).toBe('→')
      expect(symbols.rightarrow).toBe('→')
      expect(symbols.larrow).toBe('←')
      expect(symbols.leftarrow).toBe('←')
      expect(symbols.uarrow).toBe('↑')
      expect(symbols.darrow).toBe('↓')
      expect(symbols.lrarrow).toBe('↔')
      expect(symbols.implies).toBe('⇒')
      expect(symbols.iff).toBe('⇔')
      expect(symbols.mapsto).toBe('↦')
      expect(symbols.to).toBe('→')
    })

    // Comparison & Relations
    it('should have comparison and relation symbols', () => {
      expect(symbols.neq).toBe('≠')
      expect(symbols.leq).toBe('≤')
      expect(symbols.geq).toBe('≥')
      expect(symbols.approx).toBe('≈')
      expect(symbols.equiv).toBe('≡')
      expect(symbols.sim).toBe('∼')
      expect(symbols.propto).toBe('∝')
      expect(symbols.ll).toBe('≪')
      expect(symbols.gg).toBe('≫')
    })

    // Operators
    it('should have operator symbols', () => {
      expect(symbols.pm).toBe('±')
      expect(symbols.times).toBe('×')
      expect(symbols.div).toBe('÷')
      expect(symbols.cdot).toBe('·')
      expect(symbols.oplus).toBe('⊕')
      expect(symbols.otimes).toBe('⊗')
    })

    // Calculus & Analysis
    it('should have calculus symbols', () => {
      expect(symbols.inf).toBe('∞')
      expect(symbols.infty).toBe('∞')
      expect(symbols.partial).toBe('∂')
      expect(symbols.nabla).toBe('∇')
      expect(symbols.sqrt).toBe('√')
      expect(symbols.sum).toBe('∑')
      expect(symbols.prod).toBe('∏')
      expect(symbols.integral).toBe('∫')
      expect(symbols.int).toBe('∫')
      expect(symbols.iint).toBe('∬')
      expect(symbols.iiint).toBe('∭')
      expect(symbols.oint).toBe('∮')
      expect(symbols.prime).toBe('′')
    })

    // Logic & Set Theory
    it('should have logic and set theory symbols', () => {
      expect(symbols.forall).toBe('∀')
      expect(symbols.exists).toBe('∃')
      expect(symbols.nexists).toBe('∄')
      expect(symbols.in).toBe('∈')
      expect(symbols.notin).toBe('∉')
      expect(symbols.subset).toBe('⊂')
      expect(symbols.supset).toBe('⊃')
      expect(symbols.subseteq).toBe('⊆')
      expect(symbols.supseteq).toBe('⊇')
      expect(symbols.cup).toBe('∪')
      expect(symbols.cap).toBe('∩')
      expect(symbols.emptyset).toBe('∅')
      expect(symbols.and).toBe('∧')
      expect(symbols.or).toBe('∨')
      expect(symbols.not).toBe('¬')
      expect(symbols.therefore).toBe('∴')
      expect(symbols.because).toBe('∵')
      expect(symbols.qed).toBe('∎')
    })

    // Greek-like math symbols
    it('should have Greek-like math symbols', () => {
      expect(symbols.ell).toBe('ℓ')
      expect(symbols.hbar).toBe('ℏ')
      expect(symbols.Re).toBe('ℜ')
      expect(symbols.Im).toBe('ℑ')
      expect(symbols.aleph).toBe('ℵ')
    })

    // Misc Math
    it('should have miscellaneous math symbols', () => {
      expect(symbols.degree).toBe('°')
      expect(symbols.angle).toBe('∠')
      expect(symbols.perp).toBe('⊥')
      expect(symbols.parallel).toBe('∥')
      expect(symbols.triangle).toBe('△')
      expect(symbols.lfloor).toBe('⌊')
      expect(symbols.rfloor).toBe('⌋')
      expect(symbols.lceil).toBe('⌈')
      expect(symbols.rceil).toBe('⌉')
      expect(symbols.langle).toBe('⟨')
      expect(symbols.rangle).toBe('⟩')
    })

    // Fractions
    it('should have fraction symbols', () => {
      expect(symbols.half).toBe('½')
      expect(symbols.third).toBe('⅓')
      expect(symbols.quarter).toBe('¼')
      expect(symbols.twothirds).toBe('⅔')
      expect(symbols.threequarters).toBe('¾')
    })

    // Common symbols
    it('should have common symbols', () => {
      expect(symbols.check).toBe('✓')
      expect(symbols.cross).toBe('✗')
      expect(symbols.heart).toBe('♥')
      expect(symbols.ellipsis).toBe('…')
      expect(symbols.cdots).toBe('⋯')
      expect(symbols.vdots).toBe('⋮')
      expect(symbols.ddots).toBe('⋱')
    })

    // Legal/Copyright
    it('should have legal symbols', () => {
      expect(symbols.tm).toBe('™')
      expect(symbols.copyright).toBe('©')
      expect(symbols.registered).toBe('®')
      expect(symbols.section).toBe('§')
      expect(symbols.paragraph).toBe('¶')
    })

    // Currency
    it('should have currency symbols', () => {
      expect(symbols.euro).toBe('€')
      expect(symbols.pound).toBe('£')
      expect(symbols.yen).toBe('¥')
      expect(symbols.cent).toBe('¢')
      expect(symbols.rupee).toBe('₹')
      expect(symbols.bitcoin).toBe('₿')
    })
  })

  describe('Custom Symbols', () => {
    it('should accept custom symbols in configuration', () => {
      const customEditor = new Editor({
        extensions: [
          StarterKit,
          SymbolShortcuts.configure({
            customSymbols: {
              'mySymbol': '★',
              'custom': '♦'
            }
          })
        ],
        content: '<p></p>'
      })

      // Verify extension was configured
      const ext = customEditor.extensionManager.extensions.find(
        e => e.name === 'symbolShortcuts'
      )
      expect(ext.options.customSymbols).toEqual({
        'mySymbol': '★',
        'custom': '♦'
      })

      customEditor.destroy()
    })
  })

  describe('Input Rule Pattern', () => {
    it('should have correct regex pattern for :word:', () => {
      const inputRules = SymbolShortcuts.config.addInputRules()
      expect(inputRules).toHaveLength(1)

      const rule = inputRules[0]
      expect(rule.find).toBeDefined()

      // Test the regex pattern
      const regex = rule.find

      // Valid patterns
      expect(regex.test(':theta:')).toBe(true)
      expect(regex.test(':alpha:')).toBe(true)
      expect(regex.test(':pm:')).toBe(true)
      expect(regex.test(':arrow:')).toBe(true)
      expect(regex.test(':test123:')).toBe(true)

      // Invalid patterns (should not match)
      expect(regex.test(':123:')).toBe(false) // starts with number
      expect(regex.test(':::')).toBe(false) // empty
      expect(regex.test('::')).toBe(false) // no content
      expect(regex.test('theta')).toBe(false) // no colons
      expect(regex.test(':theta')).toBe(false) // missing end colon
      expect(regex.test('theta:')).toBe(false) // missing start colon
    })
  })
})
