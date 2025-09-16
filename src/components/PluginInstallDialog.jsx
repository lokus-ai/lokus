import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "./ui/dialog.jsx";
import { 
  Package, 
  FolderOpen, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  Loader,
  X,
  History,
  RefreshCw,
  ExternalLink,
  Info,
  Shield,
  Clock
} from "lucide-react";

const INSTALL_METHODS = {
  LOCAL: 'local',
  URL: 'url',
  BULK: 'bulk',
  MARKETPLACE: 'marketplace'
};

const INSTALL_STEPS = {
  VALIDATING: 'Validating plugin...',
  DOWNLOADING: 'Downloading from repository...',
  EXTRACTING: 'Extracting plugin files...',
  INSTALLING: 'Installing plugin...',
  FINALIZING: 'Finalizing installation...'
};

export default function PluginInstallDialog({ isOpen, onClose }) {
  const [installMethod, setInstallMethod] = useState(INSTALL_METHODS.LOCAL);
  const [selectedPath, setSelectedPath] = useState("");
  const [url, setUrl] = useState("");
  const [urls, setUrls] = useState([""]); // For bulk installation
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState(null);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStep, setInstallStep] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [installHistory, setInstallHistory] = useState([]);
  const [validationResults, setValidationResults] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load installation history when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadInstallationHistory();
    }
  }, [isOpen]);

  const loadInstallationHistory = async () => {
    try {
      const history = await invoke("get_installation_history");
      setInstallHistory(history || []);
    } catch (err) {
      console.error("Failed to load installation history:", err);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Plugin Directory"
      });
      
      if (selected) {
        setSelectedPath(selected);
        setError("");
      }
    } catch (err) {
      setError(`Failed to select directory: ${err.message}`);
    }
  };

  const handleInstall = async () => {
    setIsInstalling(true);
    setError("");
    setWarnings([]);
    setInstallStatus("installing");
    setInstallProgress(0);
    setBulkResults(null);

    try {
      let result;
      
      if (installMethod === INSTALL_METHODS.LOCAL) {
        if (!selectedPath) {
          setError("Please select a plugin directory");
          return;
        }
        setInstallStep(INSTALL_STEPS.INSTALLING);
        setInstallProgress(50);
        result = await invoke("install_plugin_from_path", { path: selectedPath });
        setInstallProgress(100);
      } else if (installMethod === INSTALL_METHODS.URL) {
        if (!url.trim()) {
          setError("Please enter a valid URL");
          return;
        }
        setInstallStep(INSTALL_STEPS.VALIDATING);
        setInstallProgress(20);
        
        // Simulate progress steps for better UX
        setTimeout(() => {
          setInstallStep(INSTALL_STEPS.DOWNLOADING);
          setInstallProgress(40);
        }, 500);
        
        setTimeout(() => {
          setInstallStep(INSTALL_STEPS.EXTRACTING);
          setInstallProgress(70);
        }, 1500);
        
        setTimeout(() => {
          setInstallStep(INSTALL_STEPS.INSTALLING);
          setInstallProgress(90);
        }, 2500);
        
        result = await invoke("install_plugin_from_url", { url: url.trim() });
        setInstallProgress(100);
        setInstallStep(INSTALL_STEPS.FINALIZING);
      } else if (installMethod === INSTALL_METHODS.BULK) {
        const validUrls = urls.filter(u => u.trim());
        if (validUrls.length === 0) {
          setError("Please enter at least one valid URL");
          return;
        }
        setInstallStep(`Installing ${validUrls.length} plugins...`);
        setInstallProgress(50);
        result = await invoke("bulk_install_plugins", { urls: validUrls });
        setBulkResults(result);
        setInstallProgress(100);
      }

      if (result?.success || (result?.total && result?.successful > 0)) {
        setInstallStatus("success");
        if (result?.warnings) {
          setWarnings(result.warnings);
        }
        await loadInstallationHistory(); // Refresh history
        setTimeout(() => {
          onClose();
          resetDialog();
        }, 3000);
      } else {
        setError(result?.error || result?.message || "Installation failed");
        if (result?.warnings) {
          setWarnings(result.warnings);
        }
        setInstallStatus("error");
      }
    } catch (err) {
      setError(`Installation failed: ${err.message}`);
      setInstallStatus("error");
    } finally {
      setIsInstalling(false);
    }
  };

  const resetDialog = () => {
    setInstallMethod(INSTALL_METHODS.LOCAL);
    setSelectedPath("");
    setUrl("");
    setUrls([""]);
    setIsInstalling(false);
    setInstallStatus(null);
    setInstallProgress(0);
    setInstallStep("");
    setError("");
    setWarnings([]);
    setValidationResults(null);
    setBulkResults(null);
    setShowAdvanced(false);
  };

  const addUrlField = () => {
    setUrls([...urls, ""]);
  };

  const removeUrlField = (index) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const validateUrl = async () => {
    if (!url.trim()) return;
    
    try {
      // This would validate the GitHub URL format
      // For now, just check if it's a GitHub URL
      if (url.includes('github.com')) {
        setValidationResults({ valid: true, message: "Valid GitHub URL" });
      } else {
        setValidationResults({ valid: false, message: "Only GitHub URLs are currently supported" });
      }
    } catch (err) {
      setValidationResults({ valid: false, message: err.message });
    }
  };

  const handleClose = () => {
    if (!isInstalling) {
      onClose();
      resetDialog();
    }
  };

  const canInstall = () => {
    if (isInstalling) return false;
    if (installMethod === INSTALL_METHODS.LOCAL) return selectedPath.trim() !== "";
    if (installMethod === INSTALL_METHODS.URL) return url.trim() !== "";
    if (installMethod === INSTALL_METHODS.BULK) return urls.some(u => u.trim() !== "");
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Install Plugin
          </DialogTitle>
          <DialogDescription>
            Choose how you want to install the plugin. Supports local directories, GitHub repositories, and bulk installation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Installation Method Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-app-text">Installation Method</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setInstallMethod(INSTALL_METHODS.LOCAL)}
                className={`px-3 py-3 text-sm rounded-md border transition-colors text-center ${
                  installMethod === INSTALL_METHODS.LOCAL
                    ? 'bg-app-accent text-app-accent-fg border-app-accent'
                    : 'bg-app-bg text-app-text border-app-border hover:bg-app-panel'
                }`}
              >
                <FolderOpen className="w-4 h-4 inline mr-2" />
                Local Folder
              </button>
              <button
                onClick={() => setInstallMethod(INSTALL_METHODS.URL)}
                className={`px-3 py-3 text-sm rounded-md border transition-colors text-center ${
                  installMethod === INSTALL_METHODS.URL
                    ? 'bg-app-accent text-app-accent-fg border-app-accent'
                    : 'bg-app-bg text-app-text border-app-border hover:bg-app-panel'
                }`}
              >
                <Download className="w-4 h-4 inline mr-2" />
                GitHub URL
              </button>
              <button
                onClick={() => setInstallMethod(INSTALL_METHODS.BULK)}
                className={`px-3 py-3 text-sm rounded-md border transition-colors text-center ${
                  installMethod === INSTALL_METHODS.BULK
                    ? 'bg-app-accent text-app-accent-fg border-app-accent'
                    : 'bg-app-bg text-app-text border-app-border hover:bg-app-panel'
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                Bulk Install
              </button>
            </div>
          </div>

          {/* Local Installation */}
          {installMethod === INSTALL_METHODS.LOCAL && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-app-text">Plugin Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedPath}
                  placeholder="Select plugin directory..."
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-app-bg border border-app-border rounded-md focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent"
                />
                <button
                  onClick={handleSelectFolder}
                  disabled={isInstalling}
                  className="px-4 py-2 text-sm bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/90 transition-colors disabled:opacity-50"
                >
                  <FolderOpen className="w-4 h-4 inline mr-2" />
                  Browse
                </button>
              </div>
              <p className="text-xs text-app-text/60">
                Select a directory containing a plugin.json file and plugin source code.
              </p>
            </div>
          )}

          {/* URL Installation */}
          {installMethod === INSTALL_METHODS.URL && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-app-text">GitHub Repository URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={validateUrl}
                  placeholder="https://github.com/user/plugin-name"
                  className="flex-1 px-3 py-2 text-sm bg-app-bg border border-app-border rounded-md focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent"
                />
                <button
                  onClick={validateUrl}
                  disabled={isInstalling}
                  className="px-4 py-2 text-sm bg-app-bg border border-app-border rounded-md hover:bg-app-panel transition-colors disabled:opacity-50"
                >
                  <Shield className="w-4 h-4" />
                </button>
              </div>
              {validationResults && (
                <div className={`flex items-center gap-2 p-2 rounded-md text-xs ${
                  validationResults.valid 
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                }`}>
                  <Info className="w-3 h-3 flex-shrink-0" />
                  {validationResults.message}
                </div>
              )}
              <p className="text-xs text-app-text/60">
                Supports GitHub repository URLs, specific branches (github.com/user/repo/tree/branch), and release tags.
              </p>
            </div>
          )}

          {/* Bulk Installation */}
          {installMethod === INSTALL_METHODS.BULK && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-app-text">Repository URLs</label>
              <div className="space-y-2">
                {urls.map((urlValue, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={urlValue}
                      onChange={(e) => updateUrl(index, e.target.value)}
                      placeholder={`GitHub repository URL ${index + 1}`}
                      className="flex-1 px-3 py-2 text-sm bg-app-bg border border-app-border rounded-md focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent"
                    />
                    {urls.length > 1 && (
                      <button
                        onClick={() => removeUrlField(index)}
                        disabled={isInstalling}
                        className="px-2 py-2 text-sm bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addUrlField}
                  disabled={isInstalling}
                  className="px-3 py-2 text-sm bg-app-bg border border-app-border rounded-md hover:bg-app-panel transition-colors disabled:opacity-50"
                >
                  + Add Another URL
                </button>
              </div>
              <p className="text-xs text-app-text/60">
                Install multiple plugins at once. Each URL will be processed independently.
              </p>
            </div>
          )}

          {/* Progress Indicator */}
          {isInstalling && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin text-app-accent" />
                <span className="text-sm font-medium text-app-text">{installStep}</span>
              </div>
              <div className="w-full bg-app-panel rounded-full h-2">
                <div 
                  className="bg-app-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${installProgress}%` }}
                />
              </div>
              <div className="text-xs text-app-text/60 text-center">
                {installProgress}% complete
              </div>
            </div>
          )}

          {/* Results Section */}
          {bulkResults && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-app-text">Bulk Installation Results</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-lg font-bold text-blue-700">{bulkResults.total}</div>
                  <div className="text-xs text-blue-600">Total</div>
                </div>
                <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="text-lg font-bold text-green-700">{bulkResults.successful}</div>
                  <div className="text-xs text-green-600">Successful</div>
                </div>
                <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                  <div className="text-lg font-bold text-red-700">{bulkResults.failed}</div>
                  <div className="text-xs text-red-600">Failed</div>
                </div>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">Installation Failed</div>
                <div className="text-xs mt-1">{error}</div>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{warning}</span>
                </div>
              ))}
            </div>
          )}

          {installStatus === "success" && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium">Installation Successful!</div>
                <div className="text-xs mt-1">
                  {bulkResults 
                    ? `${bulkResults.successful} plugin(s) installed successfully`
                    : "Plugin installed and ready to use"
                  }
                </div>
              </div>
            </div>
          )}

          {/* Advanced Options */}
          <div className="border-t border-app-border pt-4">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-app-text/70 hover:text-app-text transition-colors"
            >
              <Info className="w-4 h-4" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options & History
            </button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-4">
                {/* Installation History */}
                {installHistory.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-app-text flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Recent Installations
                    </label>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {installHistory.slice(-5).map((log, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-app-panel rounded text-xs">
                          <div className="flex items-center gap-2">
                            <Package className="w-3 h-3" />
                            <span className="font-medium">{log.plugin_name}</span>
                            <span className="text-app-text/60">v{log.version}</span>
                          </div>
                          <div className="flex items-center gap-2 text-app-text/60">
                            <Clock className="w-3 h-3" />
                            {new Date(log.installed_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <button
            onClick={handleClose}
            disabled={isInstalling}
            className="px-4 py-2 text-sm border border-app-border rounded-md hover:bg-app-panel transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleInstall}
            disabled={!canInstall()}
            className="px-4 py-2 text-sm bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isInstalling ? (
              <>
                <Loader className="w-4 h-4 inline mr-2 animate-spin" />
                Installing...
              </>
            ) : installMethod === INSTALL_METHODS.BULK ? (
              'Install All Plugins'
            ) : (
              'Install Plugin'
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}