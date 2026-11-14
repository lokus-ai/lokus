/** @part-of ui.shell */
import { Component, type ReactNode } from "react";

import { reportError } from "../bridge/analytics";

/**
 * A view that throws while rendering shows a short message in its own space
 * instead of blanking the whole window; the notes stay reachable.
 */
export class Boundary extends Component<{ name: string; children: ReactNode }, { failed: string | null }> {
  state = { failed: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { failed: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    reportError(error, `view:${this.props.name}`);
  }

  render() {
    if (this.state.failed === null) return this.props.children;
    return (
      <div className="boundary">
        <p>{this.props.name} ran into a problem.</p>
        <span>{this.state.failed}</span>
        <button className="settings-button" onClick={() => this.setState({ failed: null })}>
          Try again
        </button>
      </div>
    );
  }
}
