import React from "react";
import * as Sentry from "@sentry/react";

/**
 * Error boundary scoped to the editor area only.
 * Catches React render-phase errors from TipTap without killing the whole app.
 */
export class EditorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Report to Sentry
    try {
      Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
    } catch {}

    // Emit event so Workspace can activate source mode
    try {
      const filePath = this.props.filePath;
      window.dispatchEvent(
        new CustomEvent("lokus:editor-content-error", {
          detail: { filePath, error: error?.message || String(error) },
        })
      );
    } catch {}
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Render the fallback provided by the parent
      if (typeof this.props.fallback === "function") {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.resetError,
        });
      }
      return null;
    }
    return this.props.children;
  }
}

export default EditorErrorBoundary;
