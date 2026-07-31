import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from 'lokus';

// ToastClose ships `opacity-0 … group-hover:opacity-100` — it is invisible
// until the toast is hovered, which a static capture cannot do, so every
// story forces `opacity-100`. The viewport is likewise pinned out of its
// shipped `position: fixed` and into normal flow.
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

// The close button is absolutely positioned at the toast's top-right corner.
export const DismissibleStatus = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Workspace synced</ToastTitle>
        <ToastDescription>14 files uploaded from Second Brain.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Export complete</ToastTitle>
        <ToastDescription>42 notes written to ~/Documents/Lokus-export.pdf</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);

// Close sits above the action row, not inside it — the toast reserves `pr-8`
// so the X never collides with an action button.
export const CloseBesideAction = () => (
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
        <ToastTitle>Note moved to trash</ToastTitle>
        <ToastDescription>Journal / Weekly Review.md</ToastDescription>
      </div>
      <ToastAction altText="Undo moving the note to trash" className="border-app-border text-app-text">
        Undo
      </ToastAction>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);
