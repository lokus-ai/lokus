/**
 * Import Wizard Component
 *
 * Beautiful step-by-step wizard for importing notes from other platforms
 */

import { useState, useEffect } from 'react';
import { X, FileText, FolderOpen, Download, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { getAllImporterInfo, getImporter } from "../../core/importers/index.js";
import '../../styles/import-wizard.css';

const STEPS = {
  PLATFORM: 1,
  SOURCE: 2,
  PREVIEW: 3,
  DESTINATION: 4,
  IMPORT: 5,
  COMPLETE: 6
};

export default function ImportWizard({ onClose, initialWorkspacePath }) {
  const [currentStep, setCurrentStep] = useState(STEPS.PLATFORM);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [sourcePath, setSourcePath] = useState('');
  const [destPath, setDestPath] = useState(initialWorkspacePath || '');
  const [preview, setPreview] = useState([]);
  const [validation, setValidation] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState('');

  // Get available importers
  const importers = getAllImporterInfo();

  // Platform selection
  const handlePlatformSelect = (platform) => {
    setSelectedPlatform(platform);
    setError('');
  };

  // Source selection
  const handleSelectSource = async () => {
    try {
      const importer = selectedPlatform.name;
      const extensions = selectedPlatform.extensions;

      let selected;

      if (importer === 'roam') {
        // Roam uses JSON file
        selected = await open({
          title: 'Select Roam Export JSON',
          filters: [{
            name: 'JSON',
            extensions: ['json']
          }],
          multiple: false
        });
      } else {
        // Logseq uses directory
        selected = await open({
          title: `Select ${selectedPlatform.platformName} Folder`,
          directory: true,
          multiple: false
        });
      }

      if (selected) {
        setSourcePath(selected);
        setError('');

        // Validate source
        await validateSource(selected);
      }
    } catch (err) {
      setError('Failed to select source: ' + err.message);
    }
  };

  // Validate source
  const validateSource = async (path) => {
    try {
      const ImporterClass = getImporter(selectedPlatform.name);
      const importer = new ImporterClass();

      const result = await importer.validate(path);
      setValidation(result);

      if (!result.valid) {
        setError(result.errors.join(', '));
      }
    } catch (err) {
      setError('Validation failed: ' + err.message);
      setValidation({ valid: false, errors: [err.message] });
    }
  };

  // Generate preview
  const handleGeneratePreview = async () => {
    try {
      setError('');
      const ImporterClass = getImporter(selectedPlatform.name);
      const importer = new ImporterClass();

      const previews = await importer.preview(sourcePath, 5);
      setPreview(previews);
    } catch (err) {
      setError('Preview failed: ' + err.message);
    }
  };

  // Select destination
  const handleSelectDestination = async () => {
    try {
      const selected = await open({
        title: 'Select Destination Folder',
        directory: true,
        multiple: false
      });

      if (selected) {
        setDestPath(selected);
        setError('');
      }
    } catch (err) {
      setError('Failed to select destination: ' + err.message);
    }
  };

  // Start import
  const handleStartImport = async () => {
    try {
      setIsImporting(true);
      setError('');

      const ImporterClass = getImporter(selectedPlatform.name);
      const importer = new ImporterClass();

      // Setup progress callback
      importer.onProgress((state) => {
        setImportProgress({
          current: state.current,
          total: state.total,
          percentage: state.percentage,
          currentFile: state.currentFile
        });
      });

      const results = await importer.import(sourcePath, destPath);
      setImportResults(results);
      setCurrentStep(STEPS.COMPLETE);
    } catch (err) {
      setError('Import failed: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case STEPS.PLATFORM:
        return selectedPlatform !== null;
      case STEPS.SOURCE:
        return sourcePath && validation && validation.valid;
      case STEPS.PREVIEW:
        return true;
      case STEPS.DESTINATION:
        return destPath !== '';
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      if (currentStep === STEPS.SOURCE && preview.length === 0) {
        handleGeneratePreview();
      }
      if (currentStep === STEPS.DESTINATION) {
        setCurrentStep(STEPS.IMPORT);
        handleStartImport();
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.PLATFORM) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.PLATFORM:
        return (
          <div className="wizard-step">
            <h2>Select Platform</h2>
            <p className="step-description">Choose which platform you're importing from</p>

            <div className="platform-grid">
              {importers.map((importer) => (
                <button
                  key={importer.name}
                  className={`platform-card ${selectedPlatform?.name === importer.name ? 'selected' : ''}`}
                  onClick={() => handlePlatformSelect(importer)}
                >
                  <FileText className="platform-icon" />
                  <h3>{importer.platformName}</h3>
                  <p>{importer.extensions.join(', ')}</p>
                </button>
              ))}

              {/* Obsidian - Special case (no conversion needed) */}
              <button
                className="platform-card obsidian-card"
                onClick={() => {
                  // Show Obsidian compatibility info
                  alert('Obsidian vaults are already compatible with Lokus!\n\nJust open your Obsidian vault folder in Lokus - no import needed.');
                }}
              >
                <FileText className="platform-icon" />
                <h3>Obsidian</h3>
                <p className="obsidian-note">Already compatible! ✨</p>
              </button>
            </div>
          </div>
        );

      case STEPS.SOURCE:
        return (
          <div className="wizard-step">
            <h2>Select Source</h2>
            <p className="step-description">
              Choose your {selectedPlatform.platformName} {selectedPlatform.name === 'roam' ? 'export file' : 'folder'}
            </p>

            <div className="source-selector">
              <button className="select-source-btn" onClick={handleSelectSource}>
                <FolderOpen />
                {sourcePath ? 'Change Source' : 'Select Source'}
              </button>

              {sourcePath && (
                <div className="selected-path">
                  <FileText />
                  <span>{sourcePath}</span>
                </div>
              )}
            </div>

            {validation && (
              <div className={`validation-result ${validation.valid ? 'valid' : 'invalid'}`}>
                {validation.valid ? (
                  <>
                    <CheckCircle className="validation-icon" />
                    <div>
                      <p><strong>Source validated successfully!</strong></p>
                      <p>{validation.fileCount || validation.pageCount} {selectedPlatform.name === 'roam' ? 'pages' : 'files'} found</p>
                      {validation.warnings && validation.warnings.length > 0 && (
                        <ul className="warnings">
                          {validation.warnings.map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="validation-icon" />
                    <div>
                      <p><strong>Validation failed</strong></p>
                      <ul className="errors">
                        {validation.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );

      case STEPS.PREVIEW:
        return (
          <div className="wizard-step">
            <h2>Preview Conversion</h2>
            <p className="step-description">Preview how your notes will be converted</p>

            {preview.length === 0 ? (
              <div className="preview-loading">
                <Loader className="spinner" />
                <p>Generating preview...</p>
              </div>
            ) : (
              <div className="preview-container">
                {preview.map((item, i) => (
                  <div key={i} className="preview-item">
                    <h4>{item.fileName}</h4>
                    <div className="preview-content">
                      <div className="preview-section">
                        <strong>Original:</strong>
                        <pre>{item.original}</pre>
                      </div>
                      <div className="preview-section">
                        <strong>Converted:</strong>
                        <pre>{item.converted}</pre>
                      </div>
                    </div>
                    {item.properties && Object.keys(item.properties).length > 0 && (
                      <div className="preview-properties">
                        <strong>Properties:</strong>
                        <code>{JSON.stringify(item.properties, null, 2)}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case STEPS.DESTINATION:
        return (
          <div className="wizard-step">
            <h2>Select Destination</h2>
            <p className="step-description">Choose where to save imported notes</p>

            <div className="source-selector">
              <button className="select-source-btn" onClick={handleSelectDestination}>
                <FolderOpen />
                {destPath ? 'Change Destination' : 'Select Destination'}
              </button>

              {destPath && (
                <div className="selected-path">
                  <FileText />
                  <span>{destPath}</span>
                </div>
              )}
            </div>
          </div>
        );

      case STEPS.IMPORT:
        return (
          <div className="wizard-step">
            <h2>Importing...</h2>
            <p className="step-description">Please wait while your notes are imported</p>

            <div className="import-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${importProgress.percentage}%` }}
                />
              </div>
              <div className="progress-stats">
                <span>{importProgress.current} / {importProgress.total}</span>
                <span>{importProgress.percentage}%</span>
              </div>
              {importProgress.currentFile && (
                <p className="current-file">{importProgress.currentFile}</p>
              )}
            </div>

            <Loader className="spinner large" />
          </div>
        );

      case STEPS.COMPLETE:
        return (
          <div className="wizard-step">
            <h2>Import Complete!</h2>
            <CheckCircle className="success-icon large" />

            {importResults && (
              <div className="import-results">
                <div className="result-card">
                  <h3>Summary</h3>
                  <ul>
                    <li>Total files: {importResults.stats.totalFiles}</li>
                    <li>Processed: {importResults.stats.processedFiles}</li>
                    <li>Success rate: {importResults.stats.successRate}%</li>
                  </ul>
                </div>

                {importResults.stats.errors.length > 0 && (
                  <div className="result-card errors">
                    <h3>Errors ({importResults.stats.errors.length})</h3>
                    <ul>
                      {importResults.stats.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>{error.file}: {error.error}</li>
                      ))}
                      {importResults.stats.errors.length > 5 && (
                        <li>... and {importResults.stats.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {importResults.stats.warnings.length > 0 && (
                  <div className="result-card warnings">
                    <h3>Warnings ({importResults.stats.warnings.length})</h3>
                    <ul>
                      {importResults.stats.warnings.slice(0, 5).map((warning, i) => (
                        <li key={i}>{warning.file}: {warning.warning}</li>
                      ))}
                      {importResults.stats.warnings.length > 5 && (
                        <li>... and {importResults.stats.warnings.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}

                {importResults.blockStats && (
                  <div className="result-card">
                    <h3>Block References</h3>
                    <p>{importResults.blockStats.totalBlocks} block references converted</p>
                  </div>
                )}
              </div>
            )}

            <button className="btn-primary" onClick={onClose}>
              <CheckCircle />
              Done
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="import-wizard-overlay">
      <div className="import-wizard">
        {/* Header */}
        <div className="wizard-header">
          <h1>
            <Download />
            Import Notes
          </h1>
          <button className="close-btn" onClick={onClose}>
            <X />
          </button>
        </div>

        {/* Progress Steps */}
        {currentStep < STEPS.COMPLETE && (
          <div className="wizard-progress">
            {Object.entries(STEPS).filter(([key]) => key !== 'COMPLETE').map(([key, step]) => (
              <div
                key={step}
                className={`progress-step ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}
              >
                <div className="step-number">{step}</div>
                <div className="step-label">{key}</div>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="wizard-content">
          {renderStepContent()}

          {error && (
            <div className="wizard-error">
              <AlertCircle />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {currentStep < STEPS.IMPORT && (
          <div className="wizard-footer">
            {currentStep > STEPS.PLATFORM && currentStep < STEPS.COMPLETE && (
              <button className="btn-secondary" onClick={handleBack}>
                Back
              </button>
            )}

            {currentStep < STEPS.DESTINATION && (
              <button
                className="btn-primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next
              </button>
            )}

            {currentStep === STEPS.DESTINATION && (
              <button
                className="btn-primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
                <Download />
                Start Import
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
