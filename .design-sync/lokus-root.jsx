// Theme root for the Lokus design system.
//
// Lokus paints its surface on the app root (`src/App.jsx`), not on <body>:
// `bg-app-bg text-app-text` is what makes every unstyled/ghost/link child
// inherit the right foreground colour. Anything built with this DS must be
// wrapped in this element (or the same two classes) or text renders as
// browser-default black on the dark surface.
import * as React from "react";

export const LokusRoot = ({ className = "", children, ...props }) => (
  <div
    className={`bg-app-bg text-app-text antialiased ${className}`}
    // minHeight is 100vh, not 100%: the preview/design host mounts this into an
    // auto-height root, where `100%` resolves to 0 and the host's own white body
    // shows through around the content.
    style={{
      fontFamily: "var(--font-family)",
      fontSize: "var(--text-base)",
      padding: 24,
      minHeight: "100vh",
      boxSizing: "border-box",
    }}
    {...props}
  >
    {children}
  </div>
);

export default LokusRoot;
