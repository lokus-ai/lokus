import { useState } from "react";
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
  X
} from "lucide-react";

const INSTALL_METHODS = {
  LOCAL: 'local',
  URL: 'url',
  MARKETPLACE: 'marketplace'
};

export default function PluginInstallDialog({ isOpen, onClose }) {
  const [installMethod, setInstallMethod] = useState(INSTALL_METHODS.LOCAL);
  const [selectedPath, setSelectedPath] = useState("");
  const [url, setUrl] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState(null);
  const [error, setError] = useState("");

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
    setInstallStatus("installing");

    try {
      let result;
      
      if (installMethod === INSTALL_METHODS.LOCAL) {
        if (!selectedPath) {
          setError("Please select a plugin directory");
          return;
        }
        result = await invoke("install_plugin_from_path", { path: selectedPath });
      } else if (installMethod === INSTALL_METHODS.URL) {
        if (!url.trim()) {
          setError("Please enter a valid URL");
          return;
        }
        result = await invoke("install_plugin_from_url", { url: url.trim() });
      }

      if (result?.success) {
        setInstallStatus("success");
        setTimeout(() => {
          onClose();
          resetDialog();
        }, 2000);
      } else {
        setError(result?.error || "Installation failed");
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
    setIsInstalling(false);
    setInstallStatus(null);
    setError("");
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
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Install Plugin
          </DialogTitle>
          <DialogDescription>
            Choose how you want to install the plugin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Installation Method Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-app-text">Installation Method</label>
            <div className="flex gap-2">
              <button
                onClick={() => setInstallMethod(INSTALL_METHODS.LOCAL)}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
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
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                  installMethod === INSTALL_METHODS.URL
                    ? 'bg-app-accent text-app-accent-fg border-app-accent'
                    : 'bg-app-bg text-app-text border-app-border hover:bg-app-panel'
                }`}
              >
                <Download className="w-4 h-4 inline mr-2" />
                URL/Git
              </button>
            </div>
          </div>

          {/* Local Installation */}
          {installMethod === INSTALL_METHODS.LOCAL && (
            <div className="space-y-2">
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
                  className="px-3 py-2 text-sm bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/90 transition-colors"
                >
                  Browse
                </button>
              </div>
            </div>
          )}

          {/* URL Installation */}
          {installMethod === INSTALL_METHODS.URL && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-app-text">Repository URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/user/plugin-name.git"
                className="w-full px-3 py-2 text-sm bg-app-bg border border-app-border rounded-md focus:ring-2 focus:ring-app-accent/40 focus:border-app-accent"
              />
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {installStatus === "success" && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">Plugin installed successfully!</span>
            </div>
          )}

          {installStatus === "installing" && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700">
              <Loader className="w-4 h-4 flex-shrink-0 animate-spin" />
              <span className="text-sm">Installing plugin...</span>
            </div>
          )}
        </div>

        <DialogFooter>
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
            ) : (
              'Install Plugin'
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}