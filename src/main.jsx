import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./hooks/theme.jsx";
import "./styles/globals.css";
import "./styles/kanban.css";

// Load KaTeX for math rendering
import katex from "katex";
import "katex/dist/katex.min.css";

// Make KaTeX globally available for the math extension
if (typeof globalThis !== 'undefined') {
  globalThis.katex = katex;
} else if (typeof window !== 'undefined') {
  window.katex = katex;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
