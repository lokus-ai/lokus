import { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, Clock, Package } from 'lucide-react';
import { readConfig, updateConfig } from '../../core/config/store';

const packageJson = await import('../../../package.json');

export default function Updates({ onCheckUpdate }) {
  const [settings, setSettings] = useState({
    autoCheck: true,
    checkFrequency: 'startup'
  });
  const [lastCheck, setLastCheck] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(packageJson.version);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const config = await readConfig();
      if (config?.updates) {
        setSettings({
          autoCheck: config.updates.autoCheck ?? true,
          checkFrequency: config.updates.checkFrequency ?? 'startup'
        });
      }

      // Load last check time from localStorage
      const lastCheckTime = localStorage.getItem('updater_last_check_time');
      if (lastCheckTime) {
        setLastCheck(new Date(parseInt(lastCheckTime)));
      }
    } catch (error) {
      console.error('Failed to load update settings:', error);
    }
  };

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await updateConfig({ updates: newSettings });
    } catch (error) {
      console.error('Failed to save update settings:', error);
    }
  };

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      if (onCheckUpdate) {
        await onCheckUpdate();
      }
      setLastCheck(new Date());
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const formatLastCheck = () => {
    if (!lastCheck) return 'Never';

    const now = new Date();
    const diff = Math.floor((now - lastCheck) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return lastCheck.toLocaleDateString();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Download className="w-6 h-6 text-accent" />
          <h2 className="text-2xl font-semibold text-app-text">Updates</h2>
        </div>
        <p className="text-sm text-app-muted">
          Configure automatic updates for Lokus to stay current with the latest features and security patches.
        </p>
      </div>

      {/* Current Version */}
      <div className="bg-app-panel/40 rounded-lg border border-app-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-app-muted" />
            <div>
              <p className="text-sm font-medium text-app-text">Current Version</p>
              <p className="text-xs text-app-muted">Lokus v{currentVersion}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-app-muted">
            <Clock className="w-4 h-4" />
            <span>Last checked: {formatLastCheck()}</span>
          </div>
        </div>
      </div>

      {/* Auto-Check Settings */}
      <div className="bg-app-panel/40 rounded-lg border border-app-border p-6 space-y-4">
        <h3 className="text-lg font-semibold text-app-text">Automatic Updates</h3>

        {/* Auto-Check Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="flex-1">
            <p className="text-sm font-medium text-app-text">Automatically check for updates</p>
            <p className="text-xs text-app-muted mt-1">
              Periodically check for new versions in the background
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoCheck}
              onChange={(e) => handleSettingChange('autoCheck', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-app-hover peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
          </label>
        </div>

        {/* Check Frequency */}
        {settings.autoCheck && (
          <div className="flex items-center justify-between py-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-app-text">Check frequency</p>
              <p className="text-xs text-app-muted mt-1">
                How often to check for new versions
              </p>
            </div>
            <select
              value={settings.checkFrequency}
              onChange={(e) => handleSettingChange('checkFrequency', e.target.value)}
              className="px-3 py-2 bg-app-hover border border-app-border rounded-md text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="startup">On Startup</option>
              <option value="6hours">Every 6 Hours</option>
              <option value="daily">Daily</option>
            </select>
          </div>
        )}
      </div>

      {/* Manual Check */}
      <div className="bg-app-panel/40 rounded-lg border border-app-border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-app-text">Check for Updates</h3>
            <p className="text-xs text-app-muted mt-1">
              Manually check if a new version is available
            </p>
          </div>
          <button
            onClick={handleCheckNow}
            disabled={isChecking}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isChecking ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Check Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-app-text">About Automatic Updates</p>
            <p className="text-xs text-app-muted leading-relaxed">
              Lokus uses Tauri's secure update system with cryptographic signature verification.
              Updates are downloaded in the background and installed when you restart the app.
              Your data and settings are never affected during updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
