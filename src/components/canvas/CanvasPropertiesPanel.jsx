import React, { useState } from 'react';
import { 
  Settings, 
  X, 
  Palette, 
  Type, 
  ArrowRight,
  Square,
  Circle,
  Triangle
} from 'lucide-react';

export default function CanvasPropertiesPanel({ 
  selectedShapes = [],
  onShapeUpdate,
  isVisible = false,
  onToggle 
}) {
  const [panelOpen, setPanelOpen] = useState(isVisible);
  
  const handleToggle = () => {
    const newState = !panelOpen;
    setPanelOpen(newState);
    if (onToggle) {
      onToggle(newState);
    }
  };

  if (!panelOpen) {
    return (
      <button
        onClick={handleToggle}
        className="absolute top-4 right-4 p-2 bg-app-panel border border-app-border rounded-lg shadow-lg text-app-muted hover:text-app-text transition-colors z-10"
        title="Show Properties Panel"
      >
        <Settings className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 w-64 bg-app-panel border border-app-border rounded-lg shadow-lg z-10">
      {/* Panel Header */}
      <div className="flex items-center justify-between p-3 border-b border-app-border">
        <h3 className="text-sm font-medium text-app-text">Properties</h3>
        <button
          onClick={handleToggle}
          className="p-1 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="p-3 space-y-4 max-h-96 overflow-y-auto">
        {selectedShapes.length === 0 ? (
          <div className="text-center text-app-muted text-sm py-8">
            <Square className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Select a shape to edit properties</p>
          </div>
        ) : (
          <>
            {/* Shape Type Info */}
            <div>
              <label className="block text-xs font-medium text-app-muted mb-2">
                Selection ({selectedShapes.length} item{selectedShapes.length !== 1 ? 's' : ''})
              </label>
              <div className="flex items-center gap-2 text-sm text-app-text">
                <Square className="w-4 h-4" />
                {selectedShapes.length === 1 
                  ? selectedShapes[0].type || 'Shape'
                  : 'Multiple shapes'
                }
              </div>
            </div>

            {/* Color Controls */}
            <div>
              <label className="block text-xs font-medium text-app-muted mb-2">
                <Palette className="w-3 h-3 inline mr-1" />
                Color
              </label>
              <div className="grid grid-cols-6 gap-1">
                {[
                  '#000000', '#ef4444', '#f97316', '#eab308', 
                  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'
                ].map(color => (
                  <button
                    key={color}
                    onClick={() => onShapeUpdate?.({ color })}
                    className="w-6 h-6 rounded border-2 border-app-border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Stroke Width */}
            <div>
              <label className="block text-xs font-medium text-app-muted mb-2">
                Stroke Width
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="10"
                  defaultValue="2"
                  onChange={(e) => onShapeUpdate?.({ strokeWidth: parseInt(e.target.value) })}
                  className="flex-1 h-1 bg-app-border rounded outline-none"
                />
                <span className="text-xs text-app-muted w-6">2px</span>
              </div>
            </div>

            {/* Text Properties (if text selected) */}
            {selectedShapes.some(shape => shape.type === 'text') && (
              <>
                <div className="border-t border-app-border pt-3">
                  <label className="block text-xs font-medium text-app-muted mb-2">
                    <Type className="w-3 h-3 inline mr-1" />
                    Text Style
                  </label>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-app-muted mb-2">
                    Font Size
                  </label>
                  <select 
                    onChange={(e) => onShapeUpdate?.({ fontSize: parseInt(e.target.value) })}
                    className="w-full p-1.5 bg-app-bg border border-app-border rounded text-sm text-app-text"
                  >
                    <option value="12">12px</option>
                    <option value="14">14px</option>
                    <option value="16" selected>16px</option>
                    <option value="18">18px</option>
                    <option value="20">20px</option>
                    <option value="24">24px</option>
                  </select>
                </div>
              </>
            )}

            {/* Arrow Properties (if arrow selected) */}
            {selectedShapes.some(shape => shape.type === 'arrow') && (
              <div className="border-t border-app-border pt-3">
                <label className="block text-xs font-medium text-app-muted mb-2">
                  <ArrowRight className="w-3 h-3 inline mr-1" />
                  Arrow Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onShapeUpdate?.({ arrowheadStart: 'none', arrowheadEnd: 'arrow' })}
                    className="p-2 bg-app-bg border border-app-border rounded text-xs hover:bg-app-hover transition-colors"
                  >
                    →
                  </button>
                  <button
                    onClick={() => onShapeUpdate?.({ arrowheadStart: 'arrow', arrowheadEnd: 'arrow' })}
                    className="p-2 bg-app-bg border border-app-border rounded text-xs hover:bg-app-hover transition-colors"
                  >
                    ↔
                  </button>
                </div>
              </div>
            )}

            {/* Position & Size Info */}
            <div className="border-t border-app-border pt-3">
              <label className="block text-xs font-medium text-app-muted mb-2">
                Position & Size
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="text-app-muted">X: 0</div>
                  <div className="text-app-muted">Y: 0</div>
                </div>
                <div className="space-y-1">
                  <div className="text-app-muted">W: 100</div>
                  <div className="text-app-muted">H: 50</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}