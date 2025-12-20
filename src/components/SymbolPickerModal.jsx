/**
 * Symbol Picker Modal
 * Shows all available symbol shortcuts (built-in + custom)
 * Triggered by Cmd+; (Mac) or Ctrl+; (Windows/Linux)
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search } from 'lucide-react';

// Built-in symbols organized by category
const SYMBOL_CATEGORIES = {
  'Greek (lowercase)': {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ',
    'epsilon': 'ε', 'zeta': 'ζ', 'eta': 'η', 'theta': 'θ',
    'iota': 'ι', 'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ',
    'nu': 'ν', 'xi': 'ξ', 'pi': 'π', 'rho': 'ρ',
    'sigma': 'σ', 'tau': 'τ', 'phi': 'φ', 'chi': 'χ',
    'psi': 'ψ', 'omega': 'ω',
  },
  'Greek (uppercase)': {
    'Alpha': 'Α', 'Beta': 'Β', 'Gamma': 'Γ', 'Delta': 'Δ',
    'Theta': 'Θ', 'Lambda': 'Λ', 'Pi': 'Π', 'Sigma': 'Σ',
    'Phi': 'Φ', 'Psi': 'Ψ', 'Omega': 'Ω',
  },
  'Arrows': {
    'arrow': '→', 'larrow': '←', 'uarrow': '↑', 'darrow': '↓',
    'lrarrow': '↔', 'implies': '⇒', 'iff': '⇔', 'mapsto': '↦',
  },
  'Math Operators': {
    'pm': '±', 'times': '×', 'div': '÷', 'dot': '·',
    'sqrt': '√', 'cbrt': '∛', 'sum': '∑', 'prod': '∏',
    'integral': '∫', 'partial': '∂', 'nabla': '∇', 'inf': '∞',
  },
  'Comparisons': {
    'neq': '≠', 'leq': '≤', 'geq': '≥', 'approx': '≈',
    'equiv': '≡', 'sim': '∼', 'll': '≪', 'gg': '≫',
  },
  'Logic & Sets': {
    'forall': '∀', 'exists': '∃', 'in': '∈', 'notin': '∉',
    'subset': '⊂', 'supset': '⊃', 'union': '∪', 'intersect': '∩',
    'and': '∧', 'or': '∨', 'not': '¬', 'emptyset': '∅',
    'therefore': '∴', 'because': '∵',
  },
  'Common': {
    'degree': '°', 'prime': '′', 'check': '✓', 'cross': '✗',
    'star': '★', 'bullet': '•', 'ellipsis': '…',
    'copyright': '©', 'trademark': '™', 'registered': '®',
  },
  'Fractions': {
    'half': '½', 'third': '⅓', 'quarter': '¼',
    'twothirds': '⅔', 'threequarters': '¾',
  },
};

export default function SymbolPickerModal({ isOpen, onClose, onInsert, customSymbols = {} }) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef(null);
  const gridRef = useRef(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Filter symbols based on search
  const filteredSymbols = useMemo(() => {
    const results = [];
    const query = search.toLowerCase();

    // Add custom symbols first if they exist
    if (Object.keys(customSymbols).length > 0) {
      const customFiltered = Object.entries(customSymbols)
        .filter(([name]) => name.toLowerCase().includes(query))
        .map(([name, symbol]) => ({ name, symbol, category: 'Custom' }));
      results.push(...customFiltered);
    }

    // Add built-in symbols
    Object.entries(SYMBOL_CATEGORIES).forEach(([category, symbols]) => {
      Object.entries(symbols)
        .filter(([name]) => name.toLowerCase().includes(query))
        .forEach(([name, symbol]) => {
          results.push({ name, symbol, category });
        });
    });

    return results;
  }, [search, customSymbols]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 6, filteredSymbols.length - 1)); // Move down a row (6 columns)
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 6, 0));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredSymbols.length - 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredSymbols[selectedIndex]) {
            handleSelect(filteredSymbols[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredSymbols, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (gridRef.current) {
      const selected = gridRef.current.querySelector('[data-selected="true"]');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (item) => {
    onInsert(item.symbol);
    onClose();
  };

  if (!isOpen) return null;

  // Group filtered symbols by category for display
  const groupedSymbols = filteredSymbols.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  let globalIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-app-bg border border-app-border rounded-xl shadow-2xl w-[600px] max-h-[60vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-app-border">
          <Search className="w-4 h-4 text-app-muted" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search symbols... (e.g. theta, arrow, sum)"
            className="flex-1 bg-transparent outline-none text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-app-panel transition-colors"
          >
            <X className="w-4 h-4 text-app-muted" />
          </button>
        </div>

        {/* Symbol Grid */}
        <div ref={gridRef} className="flex-1 overflow-auto p-4">
          {Object.keys(groupedSymbols).length === 0 ? (
            <div className="text-center text-app-muted py-8">
              No symbols found for "{search}"
            </div>
          ) : (
            Object.entries(groupedSymbols).map(([category, items]) => (
              <div key={category} className="mb-4">
                <h3 className="text-xs font-medium text-app-muted mb-2 uppercase tracking-wide">
                  {category}
                </h3>
                <div className="grid grid-cols-6 gap-1">
                  {items.map((item) => {
                    const idx = globalIndex++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`${category}-${item.name}`}
                        data-selected={isSelected}
                        onClick={() => handleSelect(item)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-app-accent text-white'
                            : 'hover:bg-app-panel'
                        }`}
                        title={`:${item.name}:`}
                      >
                        <span className="text-2xl mb-1">{item.symbol}</span>
                        <span className={`text-[10px] truncate w-full text-center ${
                          isSelected ? 'text-white/80' : 'text-app-muted'
                        }`}>
                          :{item.name}:
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-app-border bg-app-panel/30 text-xs text-app-muted flex items-center justify-between">
          <span>
            <kbd className="px-1.5 py-0.5 bg-app-bg rounded text-[10px]">↑↓←→</kbd> Navigate
            <span className="mx-2">•</span>
            <kbd className="px-1.5 py-0.5 bg-app-bg rounded text-[10px]">Enter</kbd> Insert
            <span className="mx-2">•</span>
            <kbd className="px-1.5 py-0.5 bg-app-bg rounded text-[10px]">Esc</kbd> Close
          </span>
          <span>{filteredSymbols.length} symbols</span>
        </div>
      </div>
    </div>
  );
}
