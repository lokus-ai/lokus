import React, { useState, useEffect } from 'react';
import { X, Sparkles, ExternalLink, ChevronRight } from 'lucide-react';
import { useWhatsNew } from '../contexts/RemoteConfigContext';
import { getAppInfo } from '../utils/appInfo';

const STORAGE_KEY = 'lokus_last_seen_version';

/**
 * WhatsNew - Shows changelog/release highlights after app update
 *
 * Server config example:
 * {
 *   "whats_new": {
 *     "version": "1.3.13",
 *     "highlights": [
 *       { "title": "Canvas Links", "description": "Reference canvas files from markdown" },
 *       { "title": "Improved Sync", "description": "V2 sync engine with better reliability" }
 *     ],
 *     "full_changelog_url": "https://github.com/lokus-app/lokus/releases/tag/v1.3.13"
 *   }
 * }
 */
const WhatsNew = () => {
  const whatsNew = useWhatsNew();
  const [isOpen, setIsOpen] = useState(false);
  const [appVersion, setAppVersion] = useState(null);

  // Load app version and check if we should show the modal
  useEffect(() => {
    const checkVersion = async () => {
      try {
        const info = await getAppInfo();
        setAppVersion(info?.version);

        // Get last seen version from localStorage
        const lastSeenVersion = localStorage.getItem(STORAGE_KEY);

        // Show modal if:
        // 1. Server has whats_new data
        // 2. Server version matches current app version (so we show relevant notes)
        // 3. User hasn't seen this version's notes yet
        if (
          whatsNew?.version &&
          whatsNew?.highlights?.length > 0 &&
          info?.version === whatsNew.version &&
          lastSeenVersion !== whatsNew.version
        ) {
          setIsOpen(true);
        }
      } catch {
        // Ignore errors
      }
    };

    checkVersion();
  }, [whatsNew]);

  const handleClose = () => {
    setIsOpen(false);
    // Mark this version as seen
    if (whatsNew?.version) {
      localStorage.setItem(STORAGE_KEY, whatsNew.version);
    }
  };

  const handleViewChangelog = () => {
    if (whatsNew?.full_changelog_url) {
      window.open(whatsNew.full_changelog_url, '_blank');
    }
    handleClose();
  };

  if (!isOpen || !whatsNew?.highlights?.length) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-app-panel rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-lg font-semibold text-white">What's New</h2>
                <p className="text-sm text-white/80">Version {whatsNew.version || appVersion}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <ul className="space-y-4">
            {whatsNew.highlights.map((highlight, index) => (
              <li key={index} className="flex gap-3">
                <ChevronRight className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-app-text">{highlight.title}</h3>
                  {highlight.description && (
                    <p className="text-sm text-app-muted mt-0.5">{highlight.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border flex items-center justify-between">
          <button
            onClick={handleClose}
            className="text-sm text-app-muted hover:text-app-text"
          >
            Got it
          </button>
          {whatsNew.full_changelog_url && (
            <button
              onClick={handleViewChangelog}
              className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600"
            >
              View full changelog
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsNew;
