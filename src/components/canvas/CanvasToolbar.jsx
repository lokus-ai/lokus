import React from 'react';
import { 
  Save, 
  Download, 
  Upload, 
  Maximize2, 
  Grid, 
  ZoomIn, 
  ZoomOut,
  RotateCcw,
  RotateCw,
  Move3D
} from 'lucide-react';
import platformService from '../../services/platform/PlatformService';

export default function CanvasToolbar({ 
  onSave, 
  onExport, 
  onImport,
  onToggleGrid,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
  onUndo,
  onRedo,
  onTogglePresentation,
  showGrid = true
}) {
  return (
    <div className="flex items-center gap-1">
      {/* File Operations */}
      <div className="flex items-center gap-1 pr-2 border-r border-app-border/50">
        <button
          onClick={onSave}
          title={`Save Canvas (${platformService.getModifierSymbol()}S)`}
          className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <Save className="w-4 h-4" />
        </button>
        
        <button
          onClick={onExport}
          title="Export Canvas"
          className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
        
        <button
          onClick={onImport}
          title="Import Canvas"
          className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <Upload className="w-4 h-4" />
        </button>
      </div>

      {/* View Controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-app-border/50">
        <button
          onClick={onUndo}
          title={`Undo (${platformService.getModifierSymbol()}+Z)`}
          className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        
        <button
          onClick={onRedo}
          title={`Redo (${platformService.getModifierSymbol()}+Shift+Z)`}
          className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas Controls */}
      <div className="flex items-center gap-1 pr-2 border-r border-app-border/50">
        <button
          onClick={onToggleGrid}
          title="Toggle Grid"
          className={`p-1.5 rounded transition-colors ${
            showGrid 
              ? 'bg-app-accent/20 text-app-accent' 
              : 'text-app-muted hover:bg-app-bg hover:text-app-text'
          }`}
        >
          <Grid className="w-4 h-4" />
        </button>
        
        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        
        <button
          onClick={onZoomToFit}
          title="Zoom to Fit"
          className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <Move3D className="w-4 h-4" />
        </button>
        
        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Presentation Mode */}
      <button
        onClick={onTogglePresentation}
        title="Presentation Mode"
        className="p-1.5 rounded text-app-muted hover:bg-app-bg hover:text-app-text transition-colors"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}