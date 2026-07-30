import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from 'lokus';

// ToastViewport is the stacking container every Toast portals into. It ships
// `position: fixed` (bottom-right, max 420px wide); a static capture has no
// window to anchor to, so it is pinned into normal flow with inline styles.
const flowed = (extra = {}) => ({
  position: 'static',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: '100%',
  maxWidth: 'none',
  margin: 0,
  padding: 0,
  ...extra,
});

export const StackedNotifications = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity}>
      <ToastTitle>Workspace synced — 14 files uploaded</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <ToastTitle>Plugin installed — Kanban Board v1.4.0</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <ToastTitle>Export complete — 42 notes</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={flowed()} />
  </ToastProvider>
);

// The product places the viewport bottom-right at its 420px cap. Reproduced
// here with static positioning so the real width and alignment are visible.
export const ProductWidthBottomRight = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Sync failed</ToastTitle>
        <ToastDescription>Vault storage unreachable.</ToastDescription>
      </div>
      <ToastAction altText="Retry syncing this workspace" className="border-app-border text-app-text">
        Retry
      </ToastAction>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Note moved to trash</ToastTitle>
        <ToastDescription>Journal / Weekly Review.md</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport
      className="static"
      style={flowed({ maxWidth: 420, marginLeft: 'auto', gap: 12 })}
    />
  </ToastProvider>
);
