import { useState, useEffect } from 'react';
import { Mail, Shield, AlertCircle, ExternalLink, CheckCircle, Loader2 } from 'lucide-react';
import { gmailAuth } from "../../../services/gmail.js";
import { invoke } from '@tauri-apps/api/core';

export default function GmailLogin({ onLoginSuccess }) {
  const [loginState, setLoginState] = useState('idle'); // idle, loading, waiting, error, success
  const [error, setError] = useState(null);
  const [authUrl, setAuthUrl] = useState(null);

  useEffect(() => {
    let polling = false;
    let pollInterval;

    // Start polling for auth callback when in waiting state
    const startPolling = () => {
      if (polling) return;
      polling = true;
      
      
      pollInterval = setInterval(async () => {
        try {
          const result = await invoke('gmail_check_auth_callback');
          
          if (result) {
            const [code, state] = result;
            
            clearInterval(pollInterval);
            polling = false;
            
            setLoginState('loading');
            await gmailAuth.completeAuth(code, state);
            setLoginState('success');
            
            setTimeout(() => {
              onLoginSuccess();
            }, 1500);
          }
        } catch (error) {
          console.error('[GMAIL LOGIN] Auth callback error:', error);
          clearInterval(pollInterval);
          polling = false;
          setError(error.message);
          setLoginState('error');
        }
      }, 1000); // Poll every second
    };

    if (loginState === 'waiting') {
      startPolling();
    }

    // Cleanup polling on unmount or state change
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        polling = false;
      }
    };
  }, [loginState, onLoginSuccess]);

  const handleLogin = async () => {
    try {
      setLoginState('loading');
      setError(null);
      
      const url = await gmailAuth.initiateAuth();
      setAuthUrl(url);
      setLoginState('waiting');
      
      // Open the auth URL in the default browser using the same method as existing login
      await invoke('open_auth_url', { authUrl: url });
      
    } catch (error) {
      console.error('Login failed:', error);
      setError(error.message);
      setLoginState('error');
    }
  };

  const handleRetry = () => {
    setLoginState('idle');
    setError(null);
    setAuthUrl(null);
  };

  const renderLoginState = () => {
    switch (loginState) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-app-accent" />
            <h3 className="text-lg font-semibold mb-2">Setting up authentication...</h3>
            <p className="text-app-text-secondary">
              Please wait while we prepare your Gmail connection.
            </p>
          </div>
        );

      case 'waiting':
        return (
          <div className="text-center">
            <ExternalLink className="w-8 h-8 mx-auto mb-4 text-app-accent" />
            <h3 className="text-lg font-semibold mb-2">Complete authentication</h3>
            <p className="text-app-text-secondary mb-4">
              We've opened your browser to complete the Gmail authentication.
              Please authorize Lokus to access your Gmail account.
            </p>
            <div className="bg-app-panel-secondary rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-app-accent flex-shrink-0 mt-0.5" />
                <div className="text-sm text-left">
                  <p className="font-medium mb-1">Secure authentication</p>
                  <p className="text-app-text-secondary">
                    Your login is handled securely by Google. Lokus never sees your password.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleRetry}
              className="obsidian-button text-sm"
            >
              Cancel
            </button>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-4 text-app-success" />
            <h3 className="text-lg font-semibold mb-2">Authentication successful!</h3>
            <p className="text-app-text-secondary">
              Loading your Gmail account...
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-4 text-app-danger" />
            <h3 className="text-lg font-semibold mb-2">Authentication failed</h3>
            <p className="text-app-text-secondary mb-4">
              {error || 'An unexpected error occurred during authentication.'}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleRetry}
                className="obsidian-button"
              >
                Try again
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-app-accent/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-app-accent" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect your Gmail</h2>
            <p className="text-app-text-secondary mb-8 max-w-md mx-auto">
              Access your Gmail emails directly from Lokus. View, search, and manage 
              your emails seamlessly within your knowledge workspace.
            </p>
            
            <button
              onClick={() => {
                handleLogin();
              }}
              className="obsidian-button flex items-center gap-2 px-6 py-3 mx-auto mb-8"
            >
              <Mail className="w-5 h-5" />
              Sign in with Gmail
            </button>

            <div className="bg-app-panel rounded-lg p-6 max-w-md mx-auto">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-app-accent" />
                Your privacy is protected
              </h3>
              <ul className="text-sm text-app-text-secondary space-y-2 text-left">
                <li>• Authentication is handled securely by Google</li>
                <li>• Your login credentials are never stored in Lokus</li>
                <li>• You can revoke access at any time from your Google account</li>
                <li>• Email data is only stored locally on your device</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {renderLoginState()}
      </div>
    </div>
  );
}