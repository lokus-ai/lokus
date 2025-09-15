import { Download, RefreshCcw, CheckCircle, AlertTriangle } from "lucide-react";

export default function InstallButton({
  plugin,
  isInstalling = false,
  isInstalled = false,
  hasError = false,
  errorMessage = "",
  onInstall,
  onRetry,
  size = "normal", // "small", "normal", "large"
  variant = "primary", // "primary", "secondary", "ghost"
  disabled = false
}) {
  const handleClick = () => {
    if (hasError && onRetry) {
      onRetry(plugin);
    } else if (!isInstalled && !isInstalling && onInstall) {
      onInstall(plugin);
    }
  };

  // Size classes
  const sizeClasses = {
    small: "px-2 py-1 text-xs",
    normal: "px-3 py-2 text-sm", 
    large: "px-4 py-3 text-base"
  };

  // Variant classes
  const variantClasses = {
    primary: "bg-app-accent text-app-accent-fg hover:bg-app-accent/90",
    secondary: "bg-app-bg border border-app-border text-app-text hover:bg-app-panel",
    ghost: "text-app-accent hover:bg-app-accent/10"
  };

  // Icon size based on button size
  const iconSize = {
    small: "w-3 h-3",
    normal: "w-4 h-4",
    large: "w-5 h-5"
  };

  // Determine button state and content
  let buttonContent;
  let buttonClasses = `inline-flex items-center gap-2 rounded-lg font-medium transition-all duration-200 ${sizeClasses[size]}`;
  let isDisabled = disabled || isInstalling;

  if (isInstalled) {
    buttonContent = (
      <>
        <CheckCircle className={`${iconSize[size]} text-green-500`} />
        Installed
      </>
    );
    buttonClasses += ` bg-green-500/10 border border-green-500/30 text-green-600 cursor-default`;
    isDisabled = true;
  } else if (hasError) {
    buttonContent = (
      <>
        <AlertTriangle className={`${iconSize[size]}`} />
        Retry
      </>
    );
    buttonClasses += ` bg-red-500/10 border border-red-500/30 text-red-600 hover:bg-red-500/20`;
  } else if (isInstalling) {
    buttonContent = (
      <>
        <RefreshCcw className={`${iconSize[size]} animate-spin`} />
        Installing...
      </>
    );
    buttonClasses += ` bg-app-muted/20 text-app-muted cursor-not-allowed`;
  } else {
    buttonContent = (
      <>
        <Download className={iconSize[size]} />
        Install
      </>
    );
    buttonClasses += ` ${variantClasses[variant]}`;
  }

  if (isDisabled && !isInstalled && !hasError) {
    buttonClasses += " opacity-50 cursor-not-allowed";
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={buttonClasses}
        title={
          isInstalled ? "Plugin is installed" :
          hasError ? `Installation failed: ${errorMessage}` :
          isInstalling ? "Installing plugin..." :
          `Install ${plugin.name}`
        }
      >
        {buttonContent}
      </button>

      {/* Loading overlay */}
      {isInstalling && (
        <div className="absolute inset-0 bg-white/10 rounded-lg animate-pulse" />
      )}

      {/* Error tooltip */}
      {hasError && errorMessage && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-red-500 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {errorMessage}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-red-500" />
        </div>
      )}
    </div>
  );
}