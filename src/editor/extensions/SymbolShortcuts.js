/**
 * SymbolShortcuts Extension
 *
 * Provides quick symbol input using :shortcode: syntax (like emoji shortcodes)
 * Example: :theta: → θ, :arrow: → →, :inf: → ∞
 *
 * Supports:
 * - Greek letters (lowercase and uppercase)
 * - Math symbols (arrows, operators, relations)
 * - Logic symbols (quantifiers, set operations)
 * - Common symbols (check, star, etc.)
 * - Custom user-defined symbols via preferences
 */

import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

// Built-in symbols organized by category
const BUILTIN_SYMBOLS = {
  // Greek lowercase
  'alpha': 'α',
  'beta': 'β',
  'gamma': 'γ',
  'delta': 'δ',
  'epsilon': 'ε',
  'zeta': 'ζ',
  'eta': 'η',
  'theta': 'θ',
  'iota': 'ι',
  'kappa': 'κ',
  'lambda': 'λ',
  'mu': 'μ',
  'nu': 'ν',
  'xi': 'ξ',
  'omicron': 'ο',
  'pi': 'π',
  'rho': 'ρ',
  'sigma': 'σ',
  'tau': 'τ',
  'upsilon': 'υ',
  'phi': 'φ',
  'chi': 'χ',
  'psi': 'ψ',
  'omega': 'ω',

  // Greek uppercase
  'Alpha': 'Α',
  'Beta': 'Β',
  'Gamma': 'Γ',
  'Delta': 'Δ',
  'Epsilon': 'Ε',
  'Zeta': 'Ζ',
  'Eta': 'Η',
  'Theta': 'Θ',
  'Iota': 'Ι',
  'Kappa': 'Κ',
  'Lambda': 'Λ',
  'Mu': 'Μ',
  'Nu': 'Ν',
  'Xi': 'Ξ',
  'Omicron': 'Ο',
  'Pi': 'Π',
  'Rho': 'Ρ',
  'Sigma': 'Σ',
  'Tau': 'Τ',
  'Upsilon': 'Υ',
  'Phi': 'Φ',
  'Chi': 'Χ',
  'Psi': 'Ψ',
  'Omega': 'Ω',

  // Arrows
  'arrow': '→',
  'rightarrow': '→',
  'larrow': '←',
  'leftarrow': '←',
  'uarrow': '↑',
  'uparrow': '↑',
  'darrow': '↓',
  'downarrow': '↓',
  'lrarrow': '↔',
  'leftrightarrow': '↔',
  'implies': '⇒',
  'Rightarrow': '⇒',
  'iff': '⇔',
  'Leftrightarrow': '⇔',
  'mapsto': '↦',
  'to': '→',

  // Comparison & Relations
  'neq': '≠',
  'noteq': '≠',
  'leq': '≤',
  'le': '≤',
  'geq': '≥',
  'ge': '≥',
  'approx': '≈',
  'equiv': '≡',
  'sim': '∼',
  'simeq': '≃',
  'propto': '∝',
  'll': '≪',
  'gg': '≫',

  // Operators
  'pm': '±',
  'plusminus': '±',
  'mp': '∓',
  'times': '×',
  'div': '÷',
  'cdot': '·',
  'dot': '·',
  'star': '★',
  'circ': '∘',
  'bullet': '•',
  'oplus': '⊕',
  'otimes': '⊗',
  'dagger': '†',
  'ddagger': '‡',

  // Calculus & Analysis
  'inf': '∞',
  'infty': '∞',
  'infinity': '∞',
  'partial': '∂',
  'nabla': '∇',
  'grad': '∇',
  'sqrt': '√',
  'cbrt': '∛',
  'sum': '∑',
  'prod': '∏',
  'integral': '∫',
  'int': '∫',
  'iint': '∬',
  'iiint': '∭',
  'oint': '∮',
  'prime': '′',
  'dprime': '″',
  'tprime': '‴',

  // Logic & Set Theory
  'forall': '∀',
  'exists': '∃',
  'nexists': '∄',
  'in': '∈',
  'notin': '∉',
  'ni': '∋',
  'subset': '⊂',
  'supset': '⊃',
  'subseteq': '⊆',
  'supseteq': '⊇',
  'cup': '∪',
  'union': '∪',
  'cap': '∩',
  'intersect': '∩',
  'intersection': '∩',
  'emptyset': '∅',
  'empty': '∅',
  'and': '∧',
  'land': '∧',
  'or': '∨',
  'lor': '∨',
  'not': '¬',
  'neg': '¬',
  'lnot': '¬',
  'therefore': '∴',
  'because': '∵',
  'qed': '∎',

  // Greek-like math symbols
  'ell': 'ℓ',
  'hbar': 'ℏ',
  'Re': 'ℜ',
  'Im': 'ℑ',
  'wp': '℘',
  'aleph': 'ℵ',

  // Misc Math
  'degree': '°',
  'deg': '°',
  'angle': '∠',
  'measuredangle': '∡',
  'perp': '⊥',
  'parallel': '∥',
  'cong': '≅',
  'triangle': '△',
  'square': '□',
  'diamond': '◇',
  'lfloor': '⌊',
  'rfloor': '⌋',
  'lceil': '⌈',
  'rceil': '⌉',
  'langle': '⟨',
  'rangle': '⟩',

  // Fractions & Numbers
  'half': '½',
  'third': '⅓',
  'quarter': '¼',
  'twothirds': '⅔',
  'threequarters': '¾',

  // Common symbols
  'check': '✓',
  'checkmark': '✓',
  'cross': '✗',
  'xmark': '✗',
  'star': '★',
  'heart': '♥',
  'spade': '♠',
  'club': '♣',
  'diamond': '♦',
  'ellipsis': '…',
  'dots': '…',
  'ldots': '…',
  'cdots': '⋯',
  'vdots': '⋮',
  'ddots': '⋱',

  // Legal/Copyright
  'tm': '™',
  'trademark': '™',
  'copyright': '©',
  'registered': '®',
  'section': '§',
  'paragraph': '¶',

  // Currency
  'euro': '€',
  'pound': '£',
  'yen': '¥',
  'cent': '¢',
  'rupee': '₹',
  'bitcoin': '₿',
}

export const SymbolShortcuts = Extension.create({
  name: 'symbolShortcuts',

  addOptions() {
    return {
      customSymbols: {}, // User-defined symbols from preferences
    }
  },

  addInputRules() {
    return [
      new InputRule({
        // Match :word: pattern (letters and numbers allowed in name)
        find: /:([a-zA-Z][a-zA-Z0-9]*):$/,
        handler: ({ range, match, chain }) => {
          const word = match[1]
          const allSymbols = { ...BUILTIN_SYMBOLS, ...this.options.customSymbols }
          const symbol = allSymbols[word]

          if (!symbol) return false

          chain()
            .deleteRange(range)
            .insertContent(symbol)
            .run()

          return true
        },
      }),
    ]
  },
})

// Export the symbols map for use in preferences UI
export const getBuiltinSymbols = () => ({ ...BUILTIN_SYMBOLS })

export default SymbolShortcuts
