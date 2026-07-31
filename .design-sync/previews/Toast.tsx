import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from 'lokus';

// The Radix viewport is `position: fixed` in the product (bottom-right of the
// app window). A static capture has no window chrome to anchor to, so every
// story pins the viewport back into normal flow with inline styles.
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

export const SyncComplete = () => (
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

export const WithActions = () => (
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

// KNOWN REPO BUG, shown as-is: `variant="destructive"` resolves to
// `border-destructive bg-destructive text-destructive-foreground`, and
// tailwind.config.cjs defines no `destructive` colour (only the app-* tokens),
// so those three classes emit nothing. The destructive toast below therefore
// loses the panel background and border the default variant gets. Paired with a
// default toast so the difference is unambiguous.

// The working way to get a red toast today: the default variant plus explicit
// Lokus/Tailwind classes. Use this until the `destructive` colour lands in
// tailwind.config.cjs.
export const ErrorStyledWithLokusClasses = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity} className="border-red-500/30 bg-red-500/10">
      <div className="grid gap-1">
        <ToastTitle className="text-red-400">Sync failed</ToastTitle>
        <ToastDescription>Vault storage unreachable — 3 edits queued offline.</ToastDescription>
      </div>
      <ToastAction altText="Retry syncing this workspace" className="border-red-500/30 text-red-400">
        Retry
      </ToastAction>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity} className="border-red-500/30 bg-red-500/10">
      <div className="grid gap-1">
        <ToastTitle className="text-red-400">Plugin crashed</ToastTitle>
        <ToastDescription>Kanban Board v1.4.0 was disabled to protect the workspace.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);

export const CompactAlerts = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity}>
      <ToastTitle>Plugin installed — Kanban Board v1.4.0</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <ToastTitle>Template applied — Daily Note</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <ToastTitle>Graph view rebuilt — 318 links indexed</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport(8)} />
  </ToastProvider>
);
