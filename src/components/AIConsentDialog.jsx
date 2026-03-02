import { readConfig, updateConfig } from '../core/config/store.js';

const IS_APPSTORE = import.meta.env.VITE_APPSTORE === 'true';

/**
 * Check if the user has consented to AI data sharing.
 * Returns true if consent was given or if not an App Store build.
 */
export async function hasAIConsent(feature = 'ai_assistant') {
  if (!IS_APPSTORE) return true;
  try {
    const config = await readConfig();
    return config?.privacy?.aiConsent?.[feature] === true;
  } catch {
    return false;
  }
}

/**
 * Record that the user consented to AI data sharing.
 */
export async function grantAIConsent(feature = 'ai_assistant') {
  try {
    const config = await readConfig();
    const privacy = config?.privacy || {};
    const aiConsent = privacy.aiConsent || {};
    aiConsent[feature] = true;
    await updateConfig({ privacy: { ...privacy, aiConsent } });
  } catch (error) {
    console.error('Failed to save AI consent:', error);
  }
}

/**
 * AI Data Sharing Consent Dialog
 * Required by Apple App Store Guideline 5.1.2(i) — must name the specific AI provider
 * and obtain explicit consent before transmitting user data.
 */
export default function AIConsentDialog({ feature, providerName, description, onConsent, onDecline }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-app-panel border border-app-border rounded-xl p-6 max-w-md mx-4 shadow-2xl">
        <h2 className="text-lg font-semibold text-app-text mb-3">Data Sharing Notice</h2>

        <p className="text-sm text-app-text-secondary mb-4">
          {description || `To use this feature, your data will be sent to ${providerName} for processing.`}
        </p>

        <div className="bg-app-bg rounded-lg p-3 mb-4 border border-app-border">
          <p className="text-xs text-app-muted">
            <strong>Provider:</strong> {providerName}
          </p>
          <p className="text-xs text-app-muted mt-1">
            Your data is sent securely and processed according to {providerName}'s privacy policy.
            Lokus does not store your data on our servers.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2 rounded-lg border border-app-border text-app-text hover:bg-app-bg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              await grantAIConsent(feature);
              onConsent();
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-app-accent text-white hover:bg-app-accent/90 transition-colors text-sm font-medium"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
