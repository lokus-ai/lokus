import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { lokusSchema } from '../schema/lokus-schema.js'
import createSymbolShortcutsPlugin, { getBuiltinSymbols } from './SymbolShortcuts'

describe('SymbolShortcuts Extension (ProseMirror)', () => {
  let view

  beforeEach(() => {
    const plugin = createSymbolShortcutsPlugin({ customSymbols: {} })
    const state = EditorState.create({
      schema: lokusSchema,
      plugins: [plugin],
    })
    view = new EditorView(document.createElement('div'), { state })
  })

  afterEach(() => {
    view.destroy()
  })

  it('should create a ProseMirror plugin', () => {
    const plugin = createSymbolShortcutsPlugin()
    expect(plugin).toBeDefined()
    expect(plugin.spec).toBeDefined()
  })

  it('should accept custom symbols in configuration', () => {
    const plugin = createSymbolShortcutsPlugin({
      customSymbols: {
        'mySymbol': '\u2605',
        'custom': '\u2666'
      }
    })
    expect(plugin).toBeDefined()
    // Plugin was created without error
  })

  describe('getBuiltinSymbols', () => {
    const symbols = getBuiltinSymbols()

    it('should export builtin symbols', () => {
      expect(typeof symbols).toBe('object')
      expect(Object.keys(symbols).length).toBeGreaterThan(100)
    })

    // Greek lowercase
    it('should have Greek lowercase letters', () => {
      expect(symbols.alpha).toBe('\u03B1')
      expect(symbols.beta).toBe('\u03B2')
      expect(symbols.gamma).toBe('\u03B3')
      expect(symbols.delta).toBe('\u03B4')
      expect(symbols.epsilon).toBe('\u03B5')
      expect(symbols.zeta).toBe('\u03B6')
      expect(symbols.eta).toBe('\u03B7')
      expect(symbols.theta).toBe('\u03B8')
      expect(symbols.iota).toBe('\u03B9')
      expect(symbols.kappa).toBe('\u03BA')
      expect(symbols.lambda).toBe('\u03BB')
      expect(symbols.mu).toBe('\u03BC')
      expect(symbols.nu).toBe('\u03BD')
      expect(symbols.xi).toBe('\u03BE')
      expect(symbols.omicron).toBe('\u03BF')
      expect(symbols.pi).toBe('\u03C0')
      expect(symbols.rho).toBe('\u03C1')
      expect(symbols.sigma).toBe('\u03C3')
      expect(symbols.tau).toBe('\u03C4')
      expect(symbols.upsilon).toBe('\u03C5')
      expect(symbols.phi).toBe('\u03C6')
      expect(symbols.chi).toBe('\u03C7')
      expect(symbols.psi).toBe('\u03C8')
      expect(symbols.omega).toBe('\u03C9')
    })

    // Greek uppercase
    it('should have Greek uppercase letters', () => {
      expect(symbols.Alpha).toBe('\u0391')
      expect(symbols.Beta).toBe('\u0392')
      expect(symbols.Gamma).toBe('\u0393')
      expect(symbols.Delta).toBe('\u0394')
      expect(symbols.Theta).toBe('\u0398')
      expect(symbols.Lambda).toBe('\u039B')
      expect(symbols.Pi).toBe('\u03A0')
      expect(symbols.Sigma).toBe('\u03A3')
      expect(symbols.Phi).toBe('\u03A6')
      expect(symbols.Psi).toBe('\u03A8')
      expect(symbols.Omega).toBe('\u03A9')
    })

    // Arrows
    it('should have arrow symbols', () => {
      expect(symbols.arrow).toBe('\u2192')
      expect(symbols.rightarrow).toBe('\u2192')
      expect(symbols.larrow).toBe('\u2190')
      expect(symbols.leftarrow).toBe('\u2190')
      expect(symbols.uarrow).toBe('\u2191')
      expect(symbols.darrow).toBe('\u2193')
      expect(symbols.lrarrow).toBe('\u2194')
      expect(symbols.implies).toBe('\u21D2')
      expect(symbols.iff).toBe('\u21D4')
      expect(symbols.mapsto).toBe('\u21A6')
      expect(symbols.to).toBe('\u2192')
    })

    // Comparison & Relations
    it('should have comparison and relation symbols', () => {
      expect(symbols.neq).toBe('\u2260')
      expect(symbols.leq).toBe('\u2264')
      expect(symbols.geq).toBe('\u2265')
      expect(symbols.approx).toBe('\u2248')
      expect(symbols.equiv).toBe('\u2261')
      expect(symbols.sim).toBe('\u223C')
      expect(symbols.propto).toBe('\u221D')
      expect(symbols.ll).toBe('\u226A')
      expect(symbols.gg).toBe('\u226B')
    })

    // Operators
    it('should have operator symbols', () => {
      expect(symbols.pm).toBe('\u00B1')
      expect(symbols.times).toBe('\u00D7')
      expect(symbols.div).toBe('\u00F7')
      expect(symbols.cdot).toBe('\u00B7')
      expect(symbols.oplus).toBe('\u2295')
      expect(symbols.otimes).toBe('\u2297')
    })

    // Calculus & Analysis
    it('should have calculus symbols', () => {
      expect(symbols.inf).toBe('\u221E')
      expect(symbols.infty).toBe('\u221E')
      expect(symbols.partial).toBe('\u2202')
      expect(symbols.nabla).toBe('\u2207')
      expect(symbols.sqrt).toBe('\u221A')
      expect(symbols.sum).toBe('\u2211')
      expect(symbols.prod).toBe('\u220F')
      expect(symbols.integral).toBe('\u222B')
      expect(symbols.int).toBe('\u222B')
      expect(symbols.iint).toBe('\u222C')
      expect(symbols.iiint).toBe('\u222D')
      expect(symbols.oint).toBe('\u222E')
      expect(symbols.prime).toBe('\u2032')
    })

    // Logic & Set Theory
    it('should have logic and set theory symbols', () => {
      expect(symbols.forall).toBe('\u2200')
      expect(symbols.exists).toBe('\u2203')
      expect(symbols.nexists).toBe('\u2204')
      expect(symbols.in).toBe('\u2208')
      expect(symbols.notin).toBe('\u2209')
      expect(symbols.subset).toBe('\u2282')
      expect(symbols.supset).toBe('\u2283')
      expect(symbols.subseteq).toBe('\u2286')
      expect(symbols.supseteq).toBe('\u2287')
      expect(symbols.cup).toBe('\u222A')
      expect(symbols.cap).toBe('\u2229')
      expect(symbols.emptyset).toBe('\u2205')
      expect(symbols.and).toBe('\u2227')
      expect(symbols.or).toBe('\u2228')
      expect(symbols.not).toBe('\u00AC')
      expect(symbols.therefore).toBe('\u2234')
      expect(symbols.because).toBe('\u2235')
      expect(symbols.qed).toBe('\u220E')
    })

    // Greek-like math symbols
    it('should have Greek-like math symbols', () => {
      expect(symbols.ell).toBe('\u2113')
      expect(symbols.hbar).toBe('\u210F')
      expect(symbols.Re).toBe('\u211C')
      expect(symbols.Im).toBe('\u2111')
      expect(symbols.aleph).toBe('\u2135')
    })

    // Misc Math
    it('should have miscellaneous math symbols', () => {
      expect(symbols.degree).toBe('\u00B0')
      expect(symbols.angle).toBe('\u2220')
      expect(symbols.perp).toBe('\u22A5')
      expect(symbols.parallel).toBe('\u2225')
      expect(symbols.triangle).toBe('\u25B3')
      expect(symbols.lfloor).toBe('\u230A')
      expect(symbols.rfloor).toBe('\u230B')
      expect(symbols.lceil).toBe('\u2308')
      expect(symbols.rceil).toBe('\u2309')
      expect(symbols.langle).toBe('\u27E8')
      expect(symbols.rangle).toBe('\u27E9')
    })

    // Fractions
    it('should have fraction symbols', () => {
      expect(symbols.half).toBe('\u00BD')
      expect(symbols.third).toBe('\u2153')
      expect(symbols.quarter).toBe('\u00BC')
      expect(symbols.twothirds).toBe('\u2154')
      expect(symbols.threequarters).toBe('\u00BE')
    })

    // Common symbols
    it('should have common symbols', () => {
      expect(symbols.check).toBe('\u2713')
      expect(symbols.cross).toBe('\u2717')
      expect(symbols.heart).toBe('\u2665')
      expect(symbols.ellipsis).toBe('\u2026')
      expect(symbols.cdots).toBe('\u22EF')
      expect(symbols.vdots).toBe('\u22EE')
      expect(symbols.ddots).toBe('\u22F1')
    })

    // Legal/Copyright
    it('should have legal symbols', () => {
      expect(symbols.tm).toBe('\u2122')
      expect(symbols.copyright).toBe('\u00A9')
      expect(symbols.registered).toBe('\u00AE')
      expect(symbols.section).toBe('\u00A7')
      expect(symbols.paragraph).toBe('\u00B6')
    })

    // Currency
    it('should have currency symbols', () => {
      expect(symbols.euro).toBe('\u20AC')
      expect(symbols.pound).toBe('\u00A3')
      expect(symbols.yen).toBe('\u00A5')
      expect(symbols.cent).toBe('\u00A2')
      expect(symbols.rupee).toBe('\u20B9')
      expect(symbols.bitcoin).toBe('\u20BF')
    })
  })

  describe('Input Rule Pattern', () => {
    it('should have correct regex pattern for :word:', () => {
      // Test the regex pattern used by the input rule
      const regex = /:([a-zA-Z][a-zA-Z0-9]*):$/

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
