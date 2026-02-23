import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary:${this.props.name || 'unknown'}]`, error, info);
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, recover: this.handleRecover });
      }
      return (
        <div className="flex flex-col items-center justify-center h-full p-4 text-app-muted">
          <p className="text-sm font-medium mb-2">
            {this.props.message || 'Something crashed'}
          </p>
          <button
            onClick={this.handleRecover}
            className="px-3 py-1 text-xs rounded bg-app-accent text-white hover:opacity-90"
          >
            Click to recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
