
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