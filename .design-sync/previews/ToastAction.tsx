import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from 'lokus';

// ToastAction requires a non-empty `altText` (Radix throws without it) — it is
// what a screen reader announces in place of the button. The viewport ships
// `position: fixed`; pinned into normal flow here for a static capture.
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

// Recovery actions — the toast reports a failure and offers the way out.
export const RetryAfterFailure = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
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
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Plugin failed to load</ToastTitle>
        <ToastDescription>Kanban Board v1.4.0 crashed on activation.</ToastDescription>
      </div>
      <ToastAction altText="Reload the Kanban Board plugin" className="border-app-border text-app-text">
        Reload
      </ToastAction>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);

// Undo actions — the toast is the only handle on a destructive change.
export const UndoDestructiveChange = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Note moved to trash</ToastTitle>
        <ToastDescription>Journal / Weekly Review.md</ToastDescription>
      </div>
      <ToastAction altText="Undo moving the note to trash" className="border-app-border text-app-text">
        Undo
      </ToastAction>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Tag removed from 12 notes</ToastTitle>
        <ToastDescription>#engineering no longer appears in the tag pane.</ToastDescription>
      </div>
      <ToastAction altText="Undo removing the engineering tag" className="border-app-border text-app-text">
        Undo
      </ToastAction>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);
