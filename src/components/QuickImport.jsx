/**
 * Quick Import Component
 *
 * Simplified import modal - select folder, auto-detect, convert
 */

import { useState } from 'react';
import { X, FolderOpen, CheckCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { detectPlatform } from '../core/importers/detect-platform.js';
import { getImporter } from '../core/importers/index.js';
import { addRecent } from '../lib/recents.js';
import { WorkspaceManager } from '../core/workspace/manager.js';

const PLATFORMS = {
  logseq: {
    name: 'Logseq',
    description: 'Outline-based note-taking with block references',
    color: '#00a67e'
  },
  roam: {
    name: 'Roam Research',
    description: 'Networked thought with bidirectional links',
    color: '#5c7cfa'
  },
  obsidian: {
    name: 'Obsidian',
    description: 'Already compatible - no conversion needed',
    color: '#7c3aed'
  }
};

export default function QuickImport({ onClose, onWorkspaceOpen }) {
  const [selectedPath, setSelectedPath] = useState('');
  const [detection, setDetection] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Handle folder selection
  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        title: 'Select Notes Folder',
        directory: true,
        multiple: false
      });

      if (selected) {
        setSelectedPath(selected);
        setError('');
        setDetection(null);
        setSelectedPlatform(null);
        setResult(null);

        // Auto-detect platform
        setIsDetecting(true);
        const detected = await detectPlatform(selected);
        setDetection(detected);
        setIsDetecting(false);

        // Auto-select detected platform
        if (detected.platform !== 'unknown') {
          setSelectedPlatform(detected.platform);
        }
      }
    } catch (err) {
      setError('Failed to select folder: ' + err.message);
    }
  };

  // Handle Roam JSON file selection
  const handleSelectRoamFile = async () => {
    try {
      const selected = await open({
        title: 'Select Roam Export JSON',
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        multiple: false
      });

      if (selected) {
        setSelectedPath(selected);
        setError('');
        setDetection({
          platform: 'roam',
          confidence: 100,
          reason: 'Roam JSON export file selected',
          needsConversion: true
        });
        setSelectedPlatform('roam');
        setResult(null);
      }
    } catch (err) {
      setError('Failed to select file: ' + err.message);
    }
  };

  // Handle conversion
  const handleConvert = async () => {
    if (!selectedPath || !selectedPlatform) return;

    setIsConverting(true);
    setError('');
    setProgress({ current: 0, total: 0, message: 'Starting conversion...' });

    try {
      // Obsidian doesn't need conversion
      if (selectedPlatform === 'obsidian') {
        setResult({
          success: true,
          workspacePath: selectedPath,
          message: 'Obsidian vault is already compatible with Lokus!'
        });
        setIsConverting(false);
        return;
      }

      // Get the importer
      const ImporterClass = getImporter(selectedPlatform);
      if (!ImporterClass) {
        throw new Error(`Importer not found for ${selectedPlatform}`);
      }

      const importer = new ImporterClass();

      // Setup progress callback
      importer.onProgress((state) => {
        setProgress({
          current: state.current,
          total: state.total,
          message: state.currentFile || `Processing ${state.current}/${state.total}`,
          percentage: state.percentage
        });
      });

      // Run in-place conversion
      const conversionResult = await importer.convertInPlace(selectedPath);

      setResult({
        success: true,
        workspacePath: selectedPlatform === 'roam'
          ? conversionResult.workspacePath
          : selectedPath,
        stats: conversionResult.stats,
        message: `Converted ${conversionResult.stats.processedFiles} files successfully!`
      });
    } catch (err) {
      setError('Conversion failed: ' + err.message);
    } finally {
      setIsConverting(false);
    }
  };

  // Handle opening the workspace
  const handleOpenWorkspace = async () => {
    if (result && result.workspacePath) {
      try {
        const workspacePath = result.workspacePath;

        // Add to recents
        addRecent(workspacePath);

        // Save as current workspace
        await WorkspaceManager.saveWorkspacePath(workspacePath);

        // Check if we're in Tauri
        const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

        if (isTauri) {
          // Open workspace window first
          await invoke("open_workspace_window", { workspacePath });

          // Then close the preferences window
          try {
            const currentWindow = getCurrentWindow();
            if (currentWindow.label === 'prefs') {
              await currentWindow.close();
            }
          } catch {
            // Ignore if close fails
          }
        } else if (onWorkspaceOpen) {
          // Fallback for non-Tauri (browser mode)
          onWorkspaceOpen(workspacePath);
        }
      } catch (err) {
        console.error('Failed to open workspace:', err);
        // If the Tauri command failed, try reloading with workspace path
        const workspacePath = result.workspacePath;
        const url = new URL(window.location.href);
        url.searchParams.delete('view');
        url.searchParams.set('workspacePath', encodeURIComponent(workspacePath));
        window.location.href = url.toString();
        return;
      }
    }
    onClose();
  };

  // Get display info for selected platform
  const platformInfo = selectedPlatform ? PLATFORMS[selectedPlatform] : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-panel border border-app-border rounded-lg w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <h2 className="text-lg font-semibold text-app-text">Import Notes</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-app-bg rounded transition-colors"
          >
            <X className="w-5 h-5 text-app-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Step 1: Select Folder */}
          {!result && (
            <>
              <div>
                <label className="text-sm text-app-muted mb-2 block">
                  Select your notes folder
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectFolder}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-app-bg border border-app-border rounded-lg hover:border-app-accent transition-colors"
                  >
                    <FolderOpen className="w-5 h-5 text-app-muted" />
                    <span className="text-app-text">
                      {selectedPath ? 'Change Folder' : 'Select Folder'}
                    </span>
                  </button>
                  <button
                    onClick={handleSelectRoamFile}
                    className="px-4 py-3 bg-app-bg border border-app-border rounded-lg hover:border-app-accent transition-colors text-sm text-app-muted"
                    title="Import Roam JSON export"
                  >
                    Roam JSON
                  </button>
                </div>
              </div>

              {/* Selected Path */}
              {selectedPath && (
                <div className="px-3 py-2 bg-app-bg rounded-lg border border-app-border">
                  <p className="text-sm text-app-text truncate" title={selectedPath}>
                    {selectedPath}
                  </p>
                </div>
              )}

              {/* Detection Result */}
              {isDetecting && (
                <div className="flex items-center gap-2 text-app-muted">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Detecting platform...</span>
                </div>
              )}

              {detection && !isDetecting && (
                <div className={`p-3 rounded-lg border ${
                  detection.platform !== 'unknown'
                    ? 'border-green-500/30 bg-green-500/10'
                    : 'border-yellow-500/30 bg-yellow-500/10'
                }`}>
                  {detection.platform !== 'unknown' ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-app-text">
                          Detected: {PLATFORMS[detection.platform]?.name || detection.platform}
                        </p>
                        <p className="text-xs text-app-muted">
                          {detection.fileCount} files found • {detection.confidence}% confidence
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-app-text">
                          Platform not detected
                        </p>
                        <p className="text-xs text-app-muted">
                          {detection.reason}. Select manually below.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Platform Selection */}
              {selectedPath && (
                <div>
                  <label className="text-sm text-app-muted mb-2 block">
                    Source Platform
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(PLATFORMS).map(([key, platform]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedPlatform(key)}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          selectedPlatform === key
                            ? 'border-app-accent bg-app-accent/10'
                            : 'border-app-border bg-app-bg hover:border-app-muted'
                        }`}
                      >
                        <p className="text-sm font-medium text-app-text">
                          {platform.name}
                        </p>
                        {key === 'obsidian' && (
                          <p className="text-xs text-green-500 mt-1">No conversion</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversion Note */}
              {selectedPlatform && selectedPlatform !== 'obsidian' && (
                <div className="p-3 bg-app-bg rounded-lg border border-app-border">
                  <p className="text-sm text-app-muted">
                    A backup will be created before conversion. Your original files will be converted in place.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Progress */}
          {isConverting && (
            <div className="py-4">
              <div className="flex items-center gap-3 mb-3">
                <Loader className="w-5 h-5 animate-spin text-app-accent" />
                <span className="text-sm text-app-text">Converting...</span>
              </div>
              <div className="w-full bg-app-border rounded-full h-2 mb-2">
                <div
                  className="bg-app-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage || 0}%` }}
                />
              </div>
              <p className="text-xs text-app-muted truncate">
                {progress.message}
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="py-4 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-app-text mb-2">
                Conversion Complete!
              </h3>
              <p className="text-sm text-app-muted mb-4">
                {result.message}
              </p>
              {result.stats && (
                <div className="grid grid-cols-2 gap-4 mb-4 text-left p-3 bg-app-bg rounded-lg">
                  <div>
                    <p className="text-xs text-app-muted">Files Processed</p>
                    <p className="text-lg font-semibold text-app-text">
                      {result.stats.processedFiles}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-app-muted">Success Rate</p>
                    <p className="text-lg font-semibold text-green-500">
                      {result.stats.successRate || 100}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-app-border">
          {!result ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-app-muted hover:text-app-text transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={!selectedPath || !selectedPlatform || isConverting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !selectedPath || !selectedPlatform || isConverting
                    ? 'bg-app-muted/20 text-app-muted cursor-not-allowed'
                    : 'bg-app-accent text-white hover:opacity-90'
                }`}
              >
                {isConverting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Converting...
                  </>
                ) : selectedPlatform === 'obsidian' ? (
                  <>
                    Open as Workspace
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Convert & Open
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleOpenWorkspace}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-app-accent text-white hover:opacity-90 transition-opacity"
            >
              Open Workspace
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
