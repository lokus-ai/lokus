import React from 'react';
import { Upload, FileImage, FileText } from 'lucide-react';

/**
 * ExternalDropZone - Visual feedback for external file drops
 * Shows overlay when dragging files from OS into the app
 * Only visible when NOT hovering over a specific folder
 */
export default function ExternalDropZone({ isActive, hoveredFolder }) {
  // Don't show overlay if hovering over a specific folder (folder highlight handles it)
  if (!isActive || hoveredFolder) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Subtle backdrop - only visible when not over a folder */}
      <div
        className="absolute inset-0 bg-app-accent/5"
        style={{ transition: 'opacity 200ms ease-in-out' }}
      />

      {/* Drop zone indicator - centered, subtle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-app-panel/90 backdrop-blur-md border-2 border-dashed border-app-accent/60 rounded-xl p-8 text-center max-w-sm">
          <div className="flex justify-center mb-3">
            <Upload className="w-12 h-12 text-app-accent" strokeWidth={1.5} />
          </div>

          <h3 className="text-lg font-semibold text-app-text mb-2">
            Drop files into a folder
          </h3>

          <p className="text-app-muted text-sm">
            Hover over a folder to drop files there
          </p>
        </div>
      </div>
    </div>
  );
}
