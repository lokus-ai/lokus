import React, { useEffect, useState } from 'react';
import { X, Github, Globe, Heart, Coffee } from 'lucide-react';
import { getAppInfo } from "../../utils/appInfo";
import { logger } from "../../utils/logger";

const AboutDialog = ({ isOpen, onClose }) => {
  const [appInfo, setAppInfo] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadAppInfo();
    }
  }, [isOpen]);

  const loadAppInfo = async () => {
    try {
      const info = await getAppInfo();
      setAppInfo(info);
    } catch (error) {
      logger.error('AboutDialog', 'Failed to load app info:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-app-panel rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-app-text">About Lokus</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* App Icon & Version */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4 bg-app-accent rounded-2xl flex items-center justify-center">
            <span className="text-4xl font-bold text-white">L</span>
          </div>
          <h3 className="text-xl font-semibold text-app-text mb-2">
            {appInfo?.name || 'Lokus'}
          </h3>
          <p className="text-sm text-app-muted">
            Version {appInfo?.version || '1.3.5'}
          </p>
          {appInfo?.isDev && (
            <p className="text-xs text-app-accent mt-1">Development Mode</p>
          )}
        </div>

        {/* Description */}
        <div className="mb-6">
          <p className="text-sm text-app-text text-center leading-relaxed">
            A local-first markdown note-taking app with database views, 3D knowledge graphs,
            AI integration, and blazing-fast search.
          </p>
        </div>

        {/* Links */}
        <div className="space-y-3 mb-6">
          <a
            href="https://github.com/lokus-ai/lokus"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-app-hover text-app-text transition-colors"
          >
            <Github className="w-5 h-5" />
            <span className="text-sm">GitHub Repository</span>
          </a>
          <a
            href="https://lokus.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-app-hover text-app-text transition-colors"
          >
            <Globe className="w-5 h-5" />
            <span className="text-sm">Official Website</span>
          </a>
          <a
            href="https://opencollective.com/lokus"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-app-hover text-app-text transition-colors"
          >
            <Heart className="w-5 h-5 text-red-500" />
            <span className="text-sm">Support the Project</span>
          </a>
        </div>

        {/* Technical Info */}
        {appInfo && (
          <div className="border-t border-app-border pt-4">
            <details className="text-xs text-app-muted">
              <summary className="cursor-pointer hover:text-app-text mb-2">
                Technical Information
              </summary>
              <div className="space-y-1 mt-2 pl-2">
                <div>Environment: {appInfo.environment}</div>
                <div>Tauri: {appInfo.tauriVersion}</div>
                <div>Platform: {navigator.platform}</div>
              </div>
            </details>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-app-border text-center">
          <p className="text-xs text-app-muted">
            Made with <Coffee className="w-3 h-3 inline" /> by the Lokus team
          </p>
          <p className="text-xs text-app-muted mt-1">
            © 2024 Lokus. Open source under MIT License.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog;
