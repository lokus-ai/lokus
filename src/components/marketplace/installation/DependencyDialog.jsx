import { useState } from "react";
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  ExternalLink,
  Info,
  X
} from "lucide-react";

export default function DependencyDialog({
  plugin,
  onConfirm,
  onCancel,
  availableDependencies = {},
  isResolving = false
}) {
  const [selectedDependencies, setSelectedDependencies] = useState(
    new Set(plugin.dependencies || [])
  );

  if (!plugin || !plugin.dependencies || plugin.dependencies.length === 0) {
    return null;
  }

  const getDependencyInfo = (depName) => {
    // Mock dependency information - in real implementation, this would come from the registry
    const mockDependencies = {
      "notion-api": {
        name: "Notion API Client",
        description: "Official Notion API client for JavaScript",
        version: "2.2.3",
        size: "1.2 MB",
        verified: true,
        required: true,
        homepage: "https://github.com/makenotion/notion-sdk-js"
      },
      "katex-enhanced": {
        name: "KaTeX Enhanced",
        description: "Enhanced KaTeX library with additional math symbols",
        version: "0.16.8",
        size: "850 KB",
        verified: true,
        required: true,
        homepage: "https://katex.org"
      },
      "runtime-engines": {
        name: "Code Runtime Engines",
        description: "Sandboxed runtime environments for multiple programming languages",
        version: "1.4.1",
        size: "15.3 MB",
        verified: false,
        required: true,
        homepage: "https://github.com/runtime-engines/core"
      }
    };

    return mockDependencies[depName] || {
      name: depName,
      description: "Dependency required for plugin functionality",
      version: "unknown",
      size: "unknown",
      verified: false,
      required: true
    };
  };

  const toggleDependency = (depName) => {
    const depInfo = getDependencyInfo(depName);
    if (depInfo.required) return; // Cannot toggle required dependencies

    setSelectedDependencies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(depName)) {
        newSet.delete(depName);
      } else {
        newSet.add(depName);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedDependencies));
  };

  const totalSize = plugin.dependencies.reduce((acc, depName) => {
    const info = getDependencyInfo(depName);
    if (selectedDependencies.has(depName) && info.size !== "unknown") {
      const sizeMatch = info.size.match(/(\d+\.?\d*)\s*(KB|MB|GB)/);
      if (sizeMatch) {
        const value = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[2];
        let bytes = value;
        if (unit === "KB") bytes *= 1024;
        if (unit === "MB") bytes *= 1024 * 1024;
        if (unit === "GB") bytes *= 1024 * 1024 * 1024;
        return acc + bytes;
      }
    }
    return acc;
  }, 0);

  const formatTotalSize = (bytes) => {
    if (bytes === 0) return "unknown";
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-app-panel border border-app-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-app-border">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-app-accent" />
            <div>
              <h3 className="text-lg font-semibold text-app-text">Plugin Dependencies</h3>
              <p className="text-sm text-app-muted">Required for {plugin.name}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-app-muted hover:text-app-text transition-colors"
            title="Cancel installation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-blue-600 font-medium mb-1">Dependencies Required</p>
                <p className="text-blue-600/80">
                  This plugin requires additional components to function properly. 
                  These dependencies will be automatically downloaded and installed.
                </p>
              </div>
            </div>
          </div>

          {/* Dependencies List */}
          <div className="space-y-3">
            {plugin.dependencies.map(depName => {
              const depInfo = getDependencyInfo(depName);
              const isSelected = selectedDependencies.has(depName);
              const isAvailable = availableDependencies[depName];

              return (
                <div 
                  key={depName}
                  className={`border border-app-border rounded-lg p-4 transition-colors ${
                    isSelected ? 'bg-app-bg border-app-accent/30' : 'bg-app-panel/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Checkbox */}
                      <div className="mt-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDependency(depName)}
                          disabled={depInfo.required}
                          className="w-4 h-4 text-app-accent bg-app-bg border-app-border rounded focus:ring-app-accent focus:ring-2"
                        />
                      </div>

                      {/* Dependency Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-app-text">{depInfo.name}</h4>
                          {depInfo.verified && (
                            <CheckCircle className="w-4 h-4 text-green-500" title="Verified dependency" />
                          )}
                          {depInfo.required && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-600 text-xs rounded">
                              Required
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-app-muted mb-2">{depInfo.description}</p>

                        <div className="flex items-center gap-4 text-xs text-app-muted">
                          <span>Version {depInfo.version}</span>
                          <span>Size: {depInfo.size}</span>
                          {isAvailable ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              Available
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-blue-600">
                              <Download className="w-3 h-3" />
                              Will download
                            </span>
                          )}
                        </div>

                        {depInfo.homepage && (
                          <button
                            onClick={() => window.open(depInfo.homepage, '_blank')}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-app-accent hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Learn more
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Security Warning for unverified dependencies */}
          {plugin.dependencies.some(dep => !getDependencyInfo(dep).verified) && (
            <div className="mt-6 flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-orange-600 font-medium mb-1">Unverified Dependencies</p>
                <p className="text-orange-600/80">
                  Some dependencies are not verified. Please review them carefully before proceeding.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-app-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-app-muted">
              Total download size: <span className="font-medium">{formatTotalSize(totalSize)}</span>
            </div>
            <div className="text-sm text-app-muted">
              {selectedDependencies.size} of {plugin.dependencies.length} dependencies selected
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-app-border rounded-lg hover:bg-app-bg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isResolving || selectedDependencies.size === 0}
              className="px-4 py-2 text-sm bg-app-accent text-app-accent-fg rounded-lg hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isResolving ? (
                <>
                  <Download className="w-4 h-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Install Dependencies
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}