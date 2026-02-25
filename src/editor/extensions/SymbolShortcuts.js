/**
 * SymbolShortcuts Extension (raw ProseMirror)
 *
 * Provides quick symbol input using :shortcode: syntax (like emoji shortcodes)
 * Example: :theta: -> θ, :arrow: -> →, :inf: -> ∞
 *
 * Supports:
 * - Greek letters (lowercase and uppercase)
 * - Math symbols (arrows, operators, relations)
 * - Logic symbols (quantifiers, set operations)
 * - Common symbols (check, star, etc.)
 * - Custom user-defined symbols via preferences
 */

import { InputRule } from 'prosemirror-inputrules'
import { inputRules } from 'prosemirror-inputrules'

// Built-in symbols organized by category
const BUILTIN_SYMBOLS = {
  // Greek lowercase
  'alpha': '\u03B1',
  'beta': '\u03B2',
  'gamma': '\u03B3',
  'delta': '\u03B4',
  'epsilon': '\u03B5',
  'zeta': '\u03B6',
  'eta': '\u03B7',
  'theta': '\u03B8',
  'iota': '\u03B9',
  'kappa': '\u03BA',
  'lambda': '\u03BB',
  'mu': '\u03BC',
  'nu': '\u03BD',
  'xi': '\u03BE',
  'omicron': '\u03BF',
  'pi': '\u03C0',
  'rho': '\u03C1',
  'sigma': '\u03C3',
  'tau': '\u03C4',
  'upsilon': '\u03C5',
  'phi': '\u03C6',
  'chi': '\u03C7',
  'psi': '\u03C8',
  'omega': '\u03C9',

  // Greek uppercase
  'Alpha': '\u0391',
  'Beta': '\u0392',
  'Gamma': '\u0393',
  'Delta': '\u0394',
  'Epsilon': '\u0395',
  'Zeta': '\u0396',
  'Eta': '\u0397',
  'Theta': '\u0398',
  'Iota': '\u0399',
  'Kappa': '\u039A',
  'Lambda': '\u039B',
  'Mu': '\u039C',
  'Nu': '\u039D',
  'Xi': '\u039E',
  'Omicron': '\u039F',
  'Pi': '\u03A0',
  'Rho': '\u03A1',
  'Sigma': '\u03A3',
  'Tau': '\u03A4',
  'Upsilon': '\u03A5',
  'Phi': '\u03A6',
  'Chi': '\u03A7',
  'Psi': '\u03A8',
  'Omega': '\u03A9',

  // Arrows
  'arrow': '\u2192',
  'rightarrow': '\u2192',
  'larrow': '\u2190',
  'leftarrow': '\u2190',
  'uarrow': '\u2191',
  'uparrow': '\u2191',
  'darrow': '\u2193',
  'downarrow': '\u2193',
  'lrarrow': '\u2194',
  'leftrightarrow': '\u2194',
  'implies': '\u21D2',
  'Rightarrow': '\u21D2',
  'iff': '\u21D4',
  'Leftrightarrow': '\u21D4',
  'mapsto': '\u21A6',
  'to': '\u2192',

  // Comparison & Relations
  'neq': '\u2260',
  'noteq': '\u2260',
  'leq': '\u2264',
  'le': '\u2264',
  'geq': '\u2265',
  'ge': '\u2265',
  'approx': '\u2248',
  'equiv': '\u2261',
  'sim': '\u223C',
  'simeq': '\u2243',
  'propto': '\u221D',
  'll': '\u226A',
  'gg': '\u226B',

  // Operators
  'pm': '\u00B1',
  'plusminus': '\u00B1',
  'mp': '\u2213',
  'times': '\u00D7',
  'div': '\u00F7',
  'cdot': '\u00B7',
  'dot': '\u00B7',
  'star': '\u2605',
  'circ': '\u2218',
  'bullet': '\u2022',
  'oplus': '\u2295',
  'otimes': '\u2297',
  'dagger': '\u2020',
  'ddagger': '\u2021',

  // Calculus & Analysis
  'inf': '\u221E',
  'infty': '\u221E',
  'infinity': '\u221E',
  'partial': '\u2202',
  'nabla': '\u2207',
  'grad': '\u2207',
  'sqrt': '\u221A',
  'cbrt': '\u221B',
  'sum': '\u2211',
  'prod': '\u220F',
  'integral': '\u222B',
  'int': '\u222B',
  'iint': '\u222C',
  'iiint': '\u222D',
  'oint': '\u222E',
  'prime': '\u2032',
  'dprime': '\u2033',
  'tprime': '\u2034',

  // Logic & Set Theory
  'forall': '\u2200',
  'exists': '\u2203',
  'nexists': '\u2204',
  'in': '\u2208',
  'notin': '\u2209',
  'ni': '\u220B',
  'subset': '\u2282',
  'supset': '\u2283',
  'subseteq': '\u2286',
  'supseteq': '\u2287',
  'cup': '\u222A',
  'union': '\u222A',
  'cap': '\u2229',
  'intersect': '\u2229',
  'intersection': '\u2229',
  'emptyset': '\u2205',
  'empty': '\u2205',
  'and': '\u2227',
  'land': '\u2227',
  'or': '\u2228',
  'lor': '\u2228',
  'not': '\u00AC',
  'neg': '\u00AC',
  'lnot': '\u00AC',
  'therefore': '\u2234',
  'because': '\u2235',
  'qed': '\u220E',

  // Greek-like math symbols
  'ell': '\u2113',
  'hbar': '\u210F',
  'Re': '\u211C',
  'Im': '\u2111',
  'wp': '\u2118',
  'aleph': '\u2135',

  // Misc Math
  'degree': '\u00B0',
  'deg': '\u00B0',
  'angle': '\u2220',
  'measuredangle': '\u2221',
  'perp': '\u22A5',
  'parallel': '\u2225',
  'cong': '\u2245',
  'triangle': '\u25B3',
  'square': '\u25A1',
  'diamond': '\u25C7',
  'lfloor': '\u230A',
  'rfloor': '\u230B',
  'lceil': '\u2308',
  'rceil': '\u2309',
  'langle': '\u27E8',
  'rangle': '\u27E9',

  // Fractions & Numbers
  'half': '\u00BD',
  'third': '\u2153',
  'quarter': '\u00BC',
  'twothirds': '\u2154',
  'threequarters': '\u00BE',

  // Common symbols
  'check': '\u2713',
  'checkmark': '\u2713',
  'cross': '\u2717',
  'xmark': '\u2717',
  'heart': '\u2665',
  'spade': '\u2660',
  'club': '\u2663',
  'ellipsis': '\u2026',
  'dots': '\u2026',
  'ldots': '\u2026',
  'cdots': '\u22EF',
  'vdots': '\u22EE',
  'ddots': '\u22F1',

  // Legal/Copyright
  'tm': '\u2122',
  'trademark': '\u2122',
  'copyright': '\u00A9',
  'registered': '\u00AE',
  'section': '\u00A7',
  'paragraph': '\u00B6',

  // Currency
  'euro': '\u20AC',
  'pound': '\u00A3',
  'yen': '\u00A5',
  'cent': '\u00A2',
  'rupee': '\u20B9',
  'bitcoin': '\u20BF',
}

/**
 * Create the symbol shortcuts input rule.
 *
 * @param {Object} [customSymbols={}] - User-defined symbols from preferences
 * @returns {InputRule} A ProseMirror InputRule
 */
function createSymbolInputRule(customSymbols = {}) {
  // Match :word: pattern (letters and numbers allowed in name)
  return new InputRule(
    /:([a-zA-Z][a-zA-Z0-9]*):$/,
    (state, match, start, end) => {
      const word = match[1]
      const allSymbols = { ...BUILTIN_SYMBOLS, ...customSymbols }
      const symbol = allSymbols[word]

      if (!symbol) return null

      return state.tr.replaceWith(start, end, state.schema.text(symbol))
    }
  )
}

/**
 * Create the symbol shortcuts plugin.
 *
 * @param {Object} [config={}] - Configuration object
 * @param {Object} [config.customSymbols={}] - User-defined symbols
 * @returns {import('prosemirror-state').Plugin} A ProseMirror inputRules plugin
 */
export function createSymbolShortcutsPlugin(config = {}) {
  const { customSymbols = {} } = config
  return inputRules({ rules: [createSymbolInputRule(customSymbols)] })
}

// Export the symbols map for use in preferences UI
export const getBuiltinSymbols = () => ({ ...BUILTIN_SYMBOLS })

export default createSymbolShortcutsPlugin
