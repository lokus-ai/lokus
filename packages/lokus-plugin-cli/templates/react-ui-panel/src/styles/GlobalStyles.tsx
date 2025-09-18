import { createGlobalStyle } from 'styled-components';

export const GlobalStyles = createGlobalStyle`
  /* Plugin-specific CSS variables that extend Lokus theme */
  :root {
    /* Primary colors */
    --{{pluginNameKebabCase}}-primary: var(--lokus-accent-background, #0066cc);
    --{{pluginNameKebabCase}}-primary-hover: var(--lokus-accent-hover-background, #0052a3);
    --{{pluginNameKebabCase}}-primary-active: var(--lokus-accent-active-background, #003d7a);
    
    /* Status colors */
    --{{pluginNameKebabCase}}-success: var(--lokus-success-background, #22c55e);
    --{{pluginNameKebabCase}}-warning: var(--lokus-warning-background, #f59e0b);
    --{{pluginNameKebabCase}}-error: var(--lokus-error-background, #ef4444);
    --{{pluginNameKebabCase}}-info: var(--lokus-info-background, #3b82f6);
    
    /* Background colors */
    --{{pluginNameKebabCase}}-bg-primary: var(--lokus-background, #ffffff);
    --{{pluginNameKebabCase}}-bg-secondary: var(--lokus-secondary-background, #f8fafc);
    --{{pluginNameKebabCase}}-bg-tertiary: var(--lokus-tertiary-background, #f1f5f9);
    
    /* Text colors */
    --{{pluginNameKebabCase}}-text-primary: var(--lokus-foreground, #0f172a);
    --{{pluginNameKebabCase}}-text-secondary: var(--lokus-secondary-foreground, #64748b);
    --{{pluginNameKebabCase}}-text-muted: var(--lokus-muted-foreground, #94a3b8);
    
    /* Border colors */
    --{{pluginNameKebabCase}}-border: var(--lokus-border, #e2e8f0);
    --{{pluginNameKebabCase}}-border-hover: var(--lokus-hover-border, #cbd5e1);
    --{{pluginNameKebabCase}}-border-focus: var(--lokus-focus-border, #0066cc);
    
    /* Interactive states */
    --{{pluginNameKebabCase}}-hover: var(--lokus-hover-background, #f8fafc);
    --{{pluginNameKebabCase}}-active: var(--lokus-active-background, #f1f5f9);
    --{{pluginNameKebabCase}}-selected: var(--lokus-selected-background, #e0f2fe);
    
    /* Shadows */
    --{{pluginNameKebabCase}}-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --{{pluginNameKebabCase}}-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    --{{pluginNameKebabCase}}-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    
    /* Transitions */
    --{{pluginNameKebabCase}}-transition-fast: 0.15s ease;
    --{{pluginNameKebabCase}}-transition-normal: 0.25s ease;
    --{{pluginNameKebabCase}}-transition-slow: 0.35s ease;
    
    /* Spacing */
    --{{pluginNameKebabCase}}-space-xs: 4px;
    --{{pluginNameKebabCase}}-space-sm: 8px;
    --{{pluginNameKebabCase}}-space-md: 12px;
    --{{pluginNameKebabCase}}-space-lg: 16px;
    --{{pluginNameKebabCase}}-space-xl: 20px;
    --{{pluginNameKebabCase}}-space-2xl: 24px;
    
    /* Border radius */
    --{{pluginNameKebabCase}}-radius-sm: 4px;
    --{{pluginNameKebabCase}}-radius: 6px;
    --{{pluginNameKebabCase}}-radius-md: 8px;
    --{{pluginNameKebabCase}}-radius-lg: 12px;
    
    /* Typography */
    --{{pluginNameKebabCase}}-font-size-xs: 11px;
    --{{pluginNameKebabCase}}-font-size-sm: 12px;
    --{{pluginNameKebabCase}}-font-size-base: 13px;
    --{{pluginNameKebabCase}}-font-size-md: 14px;
    --{{pluginNameKebabCase}}-font-size-lg: 16px;
    --{{pluginNameKebabCase}}-font-size-xl: 18px;
    
    --{{pluginNameKebabCase}}-font-weight-normal: 400;
    --{{pluginNameKebabCase}}-font-weight-medium: 500;
    --{{pluginNameKebabCase}}-font-weight-semibold: 600;
    --{{pluginNameKebabCase}}-font-weight-bold: 700;
    
    --{{pluginNameKebabCase}}-line-height-tight: 1.25;
    --{{pluginNameKebabCase}}-line-height-normal: 1.5;
    --{{pluginNameKebabCase}}-line-height-relaxed: 1.625;
  }

  /* Dark theme overrides */
  [data-theme="dark"] {
    --{{pluginNameKebabCase}}-bg-primary: var(--lokus-background, #0f172a);
    --{{pluginNameKebabCase}}-bg-secondary: var(--lokus-secondary-background, #1e293b);
    --{{pluginNameKebabCase}}-bg-tertiary: var(--lokus-tertiary-background, #334155);
    
    --{{pluginNameKebabCase}}-text-primary: var(--lokus-foreground, #f8fafc);
    --{{pluginNameKebabCase}}-text-secondary: var(--lokus-secondary-foreground, #cbd5e1);
    --{{pluginNameKebabCase}}-text-muted: var(--lokus-muted-foreground, #94a3b8);
    
    --{{pluginNameKebabCase}}-border: var(--lokus-border, #334155);
    --{{pluginNameKebabCase}}-border-hover: var(--lokus-hover-border, #475569);
    
    --{{pluginNameKebabCase}}-hover: var(--lokus-hover-background, #1e293b);
    --{{pluginNameKebabCase}}-active: var(--lokus-active-background, #334155);
    --{{pluginNameKebabCase}}-selected: var(--lokus-selected-background, #0c4a6e);
  }

  /* Plugin container styles */
  .{{pluginNameKebabCase}}-container {
    font-family: var(--lokus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif);
    font-size: var(--{{pluginNameKebabCase}}-font-size-base);
    line-height: var(--{{pluginNameKebabCase}}-line-height-normal);
    color: var(--{{pluginNameKebabCase}}-text-primary);
    background: var(--{{pluginNameKebabCase}}-bg-primary);
  }

  /* Utility classes */
  .{{pluginNameKebabCase}}-text-xs { font-size: var(--{{pluginNameKebabCase}}-font-size-xs); }
  .{{pluginNameKebabCase}}-text-sm { font-size: var(--{{pluginNameKebabCase}}-font-size-sm); }
  .{{pluginNameKebabCase}}-text-base { font-size: var(--{{pluginNameKebabCase}}-font-size-base); }
  .{{pluginNameKebabCase}}-text-md { font-size: var(--{{pluginNameKebabCase}}-font-size-md); }
  .{{pluginNameKebabCase}}-text-lg { font-size: var(--{{pluginNameKebabCase}}-font-size-lg); }
  .{{pluginNameKebabCase}}-text-xl { font-size: var(--{{pluginNameKebabCase}}-font-size-xl); }

  .{{pluginNameKebabCase}}-font-normal { font-weight: var(--{{pluginNameKebabCase}}-font-weight-normal); }
  .{{pluginNameKebabCase}}-font-medium { font-weight: var(--{{pluginNameKebabCase}}-font-weight-medium); }
  .{{pluginNameKebabCase}}-font-semibold { font-weight: var(--{{pluginNameKebabCase}}-font-weight-semibold); }
  .{{pluginNameKebabCase}}-font-bold { font-weight: var(--{{pluginNameKebabCase}}-font-weight-bold); }

  .{{pluginNameKebabCase}}-text-primary { color: var(--{{pluginNameKebabCase}}-text-primary); }
  .{{pluginNameKebabCase}}-text-secondary { color: var(--{{pluginNameKebabCase}}-text-secondary); }
  .{{pluginNameKebabCase}}-text-muted { color: var(--{{pluginNameKebabCase}}-text-muted); }
  .{{pluginNameKebabCase}}-text-success { color: var(--{{pluginNameKebabCase}}-success); }
  .{{pluginNameKebabCase}}-text-warning { color: var(--{{pluginNameKebabCase}}-warning); }
  .{{pluginNameKebabCase}}-text-error { color: var(--{{pluginNameKebabCase}}-error); }
  .{{pluginNameKebabCase}}-text-info { color: var(--{{pluginNameKebabCase}}-info); }

  .{{pluginNameKebabCase}}-bg-primary { background: var(--{{pluginNameKebabCase}}-bg-primary); }
  .{{pluginNameKebabCase}}-bg-secondary { background: var(--{{pluginNameKebabCase}}-bg-secondary); }
  .{{pluginNameKebabCase}}-bg-tertiary { background: var(--{{pluginNameKebabCase}}-bg-tertiary); }

  .{{pluginNameKebabCase}}-border { border: 1px solid var(--{{pluginNameKebabCase}}-border); }
  .{{pluginNameKebabCase}}-border-t { border-top: 1px solid var(--{{pluginNameKebabCase}}-border); }
  .{{pluginNameKebabCase}}-border-b { border-bottom: 1px solid var(--{{pluginNameKebabCase}}-border); }
  .{{pluginNameKebabCase}}-border-l { border-left: 1px solid var(--{{pluginNameKebabCase}}-border); }
  .{{pluginNameKebabCase}}-border-r { border-right: 1px solid var(--{{pluginNameKebabCase}}-border); }

  .{{pluginNameKebabCase}}-rounded-sm { border-radius: var(--{{pluginNameKebabCase}}-radius-sm); }
  .{{pluginNameKebabCase}}-rounded { border-radius: var(--{{pluginNameKebabCase}}-radius); }
  .{{pluginNameKebabCase}}-rounded-md { border-radius: var(--{{pluginNameKebabCase}}-radius-md); }
  .{{pluginNameKebabCase}}-rounded-lg { border-radius: var(--{{pluginNameKebabCase}}-radius-lg); }

  .{{pluginNameKebabCase}}-shadow-sm { box-shadow: var(--{{pluginNameKebabCase}}-shadow-sm); }
  .{{pluginNameKebabCase}}-shadow { box-shadow: var(--{{pluginNameKebabCase}}-shadow); }
  .{{pluginNameKebabCase}}-shadow-md { box-shadow: var(--{{pluginNameKebabCase}}-shadow-md); }

  .{{pluginNameKebabCase}}-transition { transition: all var(--{{pluginNameKebabCase}}-transition-normal); }
  .{{pluginNameKebabCase}}-transition-fast { transition: all var(--{{pluginNameKebabCase}}-transition-fast); }
  .{{pluginNameKebabCase}}-transition-slow { transition: all var(--{{pluginNameKebabCase}}-transition-slow); }

  /* Spacing utilities */
  .{{pluginNameKebabCase}}-p-xs { padding: var(--{{pluginNameKebabCase}}-space-xs); }
  .{{pluginNameKebabCase}}-p-sm { padding: var(--{{pluginNameKebabCase}}-space-sm); }
  .{{pluginNameKebabCase}}-p-md { padding: var(--{{pluginNameKebabCase}}-space-md); }
  .{{pluginNameKebabCase}}-p-lg { padding: var(--{{pluginNameKebabCase}}-space-lg); }
  .{{pluginNameKebabCase}}-p-xl { padding: var(--{{pluginNameKebabCase}}-space-xl); }

  .{{pluginNameKebabCase}}-m-xs { margin: var(--{{pluginNameKebabCase}}-space-xs); }
  .{{pluginNameKebabCase}}-m-sm { margin: var(--{{pluginNameKebabCase}}-space-sm); }
  .{{pluginNameKebabCase}}-m-md { margin: var(--{{pluginNameKebabCase}}-space-md); }
  .{{pluginNameKebabCase}}-m-lg { margin: var(--{{pluginNameKebabCase}}-space-lg); }
  .{{pluginNameKebabCase}}-m-xl { margin: var(--{{pluginNameKebabCase}}-space-xl); }

  /* Accessibility improvements */
  .{{pluginNameKebabCase}}-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .{{pluginNameKebabCase}}-focus-visible:focus {
    outline: 2px solid var(--{{pluginNameKebabCase}}-border-focus);
    outline-offset: 2px;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    :root {
      --{{pluginNameKebabCase}}-border: currentColor;
      --{{pluginNameKebabCase}}-border-hover: currentColor;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .{{pluginNameKebabCase}}-transition,
    .{{pluginNameKebabCase}}-transition-fast,
    .{{pluginNameKebabCase}}-transition-slow {
      transition: none;
    }
  }

  /* Print styles */
  @media print {
    .{{pluginNameKebabCase}}-container {
      background: white;
      color: black;
    }
    
    .{{pluginNameKebabCase}}-shadow,
    .{{pluginNameKebabCase}}-shadow-sm,
    .{{pluginNameKebabCase}}-shadow-md {
      box-shadow: none;
    }
  }
`;