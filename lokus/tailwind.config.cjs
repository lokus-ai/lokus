/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "app-bg": "rgb(var(--bg) / <alpha-value>)",
        "app-panel": "rgb(var(--panel) / <alpha-value>)",
        "app-border": "rgb(var(--border) / <alpha-value>)",
        "app-text": "rgb(var(--text) / <alpha-value>)",
        "app-muted": "rgb(var(--muted) / <alpha-value>)",
        "app-accent": "rgb(var(--accent) / <alpha-value>)",
        "app-accent-fg": "rgb(var(--accent-fg) / <alpha-value>)",
        "app-titlebar": "rgb(var(--app-titlebar) / <alpha-value>)",
      },
      borderRadius: {
        md: "8px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
