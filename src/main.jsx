import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary, ErrorFallback } from './components/error/ErrorBoundary'
import App from './App'
import { ThemeProvider } from './hooks/theme'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={ErrorFallback}
      showDialog={false}
      onError={(error, errorInfo) => {
        console.error('React Error Boundary caught:', error, errorInfo);
      }}
    >
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);