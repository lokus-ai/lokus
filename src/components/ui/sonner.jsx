import { Toaster as Sonner } from "sonner";

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      // Stack toasts, expand on hover
      expand={false}
      visibleToasts={4}
      richColors
      closeButton
      gap={8}
      // Offset from edge of screen
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-app-panel group-[.toaster]:text-app-text group-[.toaster]:border-app-border group-[.toaster]:shadow-lg",
          title: "group-[.toast]:text-app-text group-[.toast]:font-semibold",
          description: "group-[.toast]:text-app-muted",
          actionButton:
            "group-[.toast]:bg-app-accent group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-app-muted group-[.toast]:text-app-text",
          closeButton:
            "group-[.toast]:bg-app-panel group-[.toast]:border-app-border group-[.toast]:text-app-muted group-[.toast]:hover:text-app-text",
        },
      }}
      // Use CSS to ensure toasts stay within viewport
      style={{
        '--offset': '16px',
      }}
      {...props}
    />
  );
};

export { Toaster };
