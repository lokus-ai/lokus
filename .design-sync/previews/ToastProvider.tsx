import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from 'lokus';

// ToastProvider is the context boundary: it owns the default `duration` and
// `swipeDirection` for every toast underneath it, and the viewport it feeds.
// The viewport is `position: fixed` in the product — pinned back into flow
// here so a static capture can show it.
const viewport = (gap = 12) => ({
  position: 'static',
  display: 'flex',
  flexDirection: 'column',
  gap,
  width: '100%',
  maxWidth: 'none',
  margin: 0,
  padding: 0,
});

export const WrapsTheApp = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <div className="rounded-md border border-app-border bg-app-panel p-3 mb-2">
      <div className="text-xs uppercase tracking-wide text-app-muted mb-1">Second Brain</div>
      <div className="text-sm text-app-text">Journal / Weekly Review.md</div>
      <div className="text-xs text-app-muted mt-1">
        Everything under the provider can raise a toast; the viewport renders them.
      </div>
    </div>
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Workspace synced</ToastTitle>
        <ToastDescription>14 files uploaded from Second Brain.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);

export const SharedQueue = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Plugin installed</ToastTitle>
        <ToastDescription>Kanban Board v1.4.0 is ready to use.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Sync failed</ToastTitle>
        <ToastDescription>Vault storage unreachable — 3 edits queued offline.</ToastDescription>
      </div>
      <ToastAction altText="Retry syncing this workspace" className="border-app-border text-app-text">
        Retry
      </ToastAction>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);
