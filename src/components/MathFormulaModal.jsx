import React, { useState, useEffect, useRef } from 'react';
import { Sigma, X, AlertCircle } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { isDesktop } from '../platform/index.js';

export default function MathFormulaModal({
  isOpen,
  onClose,
  onInsert,
  mode = 'inline' // 'inline' or 'block'
}) {
  const [formula, setFormula] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const previewRef = useRef(null);

  // Common LaTeX examples
  const examples = {
    inline: [
      { label: 'Square', value: 'x^2' },
      { label: 'Fraction', value: '\\frac{a}{b}' },
      { label: 'Sqrt', value: '\\sqrt{x}' },
      { label: 'Sum', value: '\\sum_{i=1}^{n} x_i' },
      { label: 'Greek', value: '\\alpha, \\beta, \\gamma' },
    ],
    block: [
      { label: 'Integral', value: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}' },
      { label: 'Matrix', value: '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}' },
      { label: 'Einstein', value: 'E = mc^2' },
      { label: 'Quadratic', value: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
      { label: 'Series', value: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}' },
    ]
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Update preview when formula changes
  useEffect(() => {
    if (!formula || !formula.trim()) {
      setPreview('');
      setError('');
      return;
    }

    try {
      const html = katex.renderToString(formula, {
        throwOnError: true,
        displayMode: mode === 'block',
        strict: false,
      });
      setPreview(html);
      setError('');
    } catch (err) {
      setPreview('');
      setError(err.message || 'Invalid LaTeX syntax');
    }
  }, [formula, mode]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleInsert();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, formula]);

  const handleInsert = () => {
    if (!formula || !formula.trim() || error) {
      return;
    }

    onInsert({
      formula: formula.trim(),
      mode
    });

    // Reset and close
    setFormula('');
    setPreview('');
    setError('');
    onClose();
  };

  const handleExampleClick = (value) => {
    setFormula(value);
    inputRef.current?.focus();
  };

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-3xl mx-4 bg-app-panel border border-app-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <div className="flex items-center gap-3">
            <Sigma className="w-5 h-5 text-app-accent" />
            <div>
              <h2 className="text-lg font-semibold text-app-text">
                Insert {mode === 'inline' ? 'Inline' : 'Block'} Math
              </h2>
              <p className="text-xs text-app-muted">
                {mode === 'inline' ? 'Inline: $formula$' : 'Display: $$formula$$'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-app-hover transition-colors"
          >
            <X className="w-5 h-5 text-app-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Formula Input */}
          <div>
            <label className="block text-sm font-medium text-app-text mb-2">
              LaTeX Formula
            </label>
            <textarea
              ref={inputRef}
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder={mode === 'inline' ? 'x^2 + y^2 = r^2' : '\\int_{a}^{b} f(x) dx'}
              rows={mode === 'inline' ? 2 : 4}
              className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent font-mono text-sm"
            />
          </div>

          {/* Preview */}
          <div className="border border-app-border rounded-lg p-4 bg-app-bg">
            <p className="text-sm font-medium text-app-text mb-2">Preview</p>
            {error ? (
              <div className="flex items-start gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : preview ? (
              <div
                ref={previewRef}
                className={`flex ${mode === 'inline' ? 'items-center' : 'items-start justify-center'} text-app-text overflow-x-auto`}
                dangerouslySetInnerHTML={{ __html: preview }}
              />
            ) : (
              <div className="text-center text-app-muted py-8">
                Type a formula to see preview
              </div>
            )}
          </div>

          {/* Examples */}
          <div>
            <p className="text-sm font-medium text-app-text mb-2">Examples</p>
            <div className="flex flex-wrap gap-2">
              {examples[mode].map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example.value)}
                  className="px-3 py-1.5 text-xs font-medium bg-app-bg border border-app-border rounded-lg hover:bg-app-hover hover:border-app-accent transition-colors text-app-text"
                  title={example.value}
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          {/* Helpful Tips */}
          <div className="bg-app-bg border border-app-border rounded-lg p-3">
            <p className="text-xs font-medium text-app-text mb-2">Common LaTeX Symbols</p>
            <div className="text-xs text-app-muted space-y-1">
              <p><code className="bg-app-panel px-1 rounded">^</code> superscript • <code className="bg-app-panel px-1 rounded">_</code> subscript • <code className="bg-app-panel px-1 rounded">\frac{'{a}{b}'}</code> fraction</p>
              <p><code className="bg-app-panel px-1 rounded">\sqrt{'{x}'}</code> square root • <code className="bg-app-panel px-1 rounded">\sum</code> sum • <code className="bg-app-panel px-1 rounded">\int</code> integral</p>
              <p><code className="bg-app-panel px-1 rounded">\alpha</code> α • <code className="bg-app-panel px-1 rounded">\beta</code> β • <code className="bg-app-panel px-1 rounded">\pi</code> π • <code className="bg-app-panel px-1 rounded">\infty</code> ∞</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-app-border bg-app-bg">
          {isDesktop() && (
            <div className="text-xs text-app-muted">
              <span className="font-medium">⌘+Enter</span> to insert • <span className="font-medium">Esc</span> to cancel
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-app-muted hover:text-app-text border border-app-border rounded-lg hover:bg-app-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!formula.trim() || !!error}
              className="px-4 py-2 text-sm font-medium text-white bg-app-accent rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert Formula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
