import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Megaphone,
  ClipboardList,
  AlertTriangle,
  Sparkles,
  X
} from "lucide-react";

// Variant icons mapping
const VARIANT_ICONS = {
  default: null,
  survey: ClipboardList,
  announcement: Megaphone,
  warning: AlertTriangle,
  update: Sparkles,
};

/**
 * ExpandableToastContent - A custom toast component with expandable content and link support
 */
export function ExpandableToastContent({
  title,
  message,
  expandedContent,
  link,
  variant = "default",
  onDismiss,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = VARIANT_ICONS[variant];

  const handleLinkClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const url = link?.url;
    if (!url) return;

    try {
      // Check if running in Tauri
      if (window.__TAURI__) {
        const { confirm } = await import("@tauri-apps/plugin-dialog");
        const confirmed = await confirm(
          "Do you want to open this link in your external browser?",
          { title: "Open Link", kind: "info" }
        );
        if (!confirmed) return;

        const { open } = await import("@tauri-apps/plugin-shell");
        await open(url);
      } else {
        // Web/dev fallback
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      // Ultimate fallback
      window.open(url, "_blank");
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Header with icon and title */}
      <div className="flex items-start gap-2">
        {Icon && (
          <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 text-app-accent" />
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <div className="font-semibold text-sm text-app-text">{title}</div>
          )}
          {message && (
            <div className="text-sm text-app-muted mt-0.5">{message}</div>
          )}
        </div>
      </div>

      {/* Expandable content */}
      {expandedContent && (
        <>
          {isExpanded && (
            <div className="text-sm text-app-muted pl-7 border-l-2 border-app-border ml-2 animate-in fade-in slide-in-from-top-1 duration-200">
              {expandedContent}
            </div>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-app-accent hover:text-app-accent/80 transition-colors self-start ml-7"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show more
              </>
            )}
          </button>
        </>
      )}

      {/* Link/CTA button */}
      {link?.url && link?.text && (
        <button
          onClick={handleLinkClick}
          className="flex items-center justify-center gap-2 px-3 py-2 mt-1 text-sm font-medium bg-app-accent text-white rounded-md hover:bg-app-accent/90 transition-colors"
        >
          {link.text}
          {link.external !== false && <ExternalLink className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

/**
 * Show an enhanced toast with all features
 * @param {Object} options - Toast options
 * @param {string} options.id - Unique ID for dismissal tracking
 * @param {string} options.title - Toast title
 * @param {string} options.message - Short message
 * @param {string} options.expandedContent - Content shown when expanded
 * @param {Object} options.link - Link object { url, text, external }
 * @param {string} options.variant - "default" | "survey" | "announcement" | "warning" | "update"
 * @param {string} options.type - Sonner type: "success" | "error" | "warning" | "info"
 * @param {boolean} options.dismissible - Can be dismissed (default: true)
 * @param {boolean} options.persistent - Don't auto-dismiss (default: false)
 * @param {number} options.duration - Auto-dismiss duration in ms
 * @param {Object} options.action - Primary action button { label, onClick }
 * @param {Object} options.cancel - Cancel button { label, onClick }
 * @param {Function} options.onDismiss - Callback when dismissed
 * @param {Function} options.onAutoClose - Callback when auto-closed
 */
export function showEnhancedToast({
  id,
  title,
  message,
  expandedContent,
  link,
  variant = "default",
  type,
  dismissible = true,
  persistent = false,
  duration,
  action,
  cancel,
  onDismiss,
  onAutoClose,
}) {
  // Determine the toast function based on type
  const toastFn = type ? toast[type] || toast : toast;

  // Build toast options
  const toastOptions = {
    id,
    duration: persistent ? Infinity : duration,
    dismissible,
    onDismiss,
    onAutoClose,
  };

  // Add action button if provided
  if (action) {
    toastOptions.action = {
      label: action.label,
      onClick: action.onClick,
    };
  }

  // Add cancel button if provided
  if (cancel) {
    toastOptions.cancel = {
      label: cancel.label,
      onClick: cancel.onClick,
    };
  }

  // If we have expandable content or link or variant, use custom component
  if (expandedContent || link || variant !== "default") {
    return toast.custom(
      (t) => (
        <div className="w-full bg-app-panel border border-app-border rounded-lg p-4 shadow-lg">
          <ExpandableToastContent
            title={title}
            message={message}
            expandedContent={expandedContent}
            link={link}
            variant={variant}
            onDismiss={() => toast.dismiss(t)}
          />
          {/* Action buttons */}
          {(action || cancel) && (
            <div className="flex gap-2 mt-3 justify-end">
              {cancel && (
                <button
                  onClick={() => {
                    cancel.onClick?.();
                    toast.dismiss(t);
                  }}
                  className="px-3 py-1.5 text-sm text-app-muted hover:text-app-text transition-colors"
                >
                  {cancel.label}
                </button>
              )}
              {action && (
                <button
                  onClick={() => {
                    action.onClick?.();
                    toast.dismiss(t);
                  }}
                  className="px-3 py-1.5 text-sm font-medium bg-app-accent text-white rounded-md hover:bg-app-accent/90 transition-colors"
                >
                  {action.label}
                </button>
              )}
            </div>
          )}
          {dismissible && (
            <button
              onClick={() => toast.dismiss(t)}
              className="absolute top-2 right-2 p-1 text-app-muted hover:text-app-text transition-colors rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
      toastOptions
    );
  }

  // Simple toast with title/description
  return toastFn(title, {
    ...toastOptions,
    description: message,
  });
}

// Convenience methods
export const enhancedToast = {
  show: showEnhancedToast,

  survey: (options) => showEnhancedToast({ ...options, variant: "survey" }),
  announcement: (options) => showEnhancedToast({ ...options, variant: "announcement" }),
  warning: (options) => showEnhancedToast({ ...options, variant: "warning", type: "warning" }),
  update: (options) => showEnhancedToast({ ...options, variant: "update" }),

  success: (title, options = {}) => toast.success(title, options),
  error: (title, options = {}) => toast.error(title, options),
  info: (title, options = {}) => toast.info(title, options),
  loading: (title, options = {}) => toast.loading(title, options),
  promise: (promise, options) => toast.promise(promise, options),

  dismiss: (id) => toast.dismiss(id),
  dismissAll: () => toast.dismiss(),
};

export { toast };
