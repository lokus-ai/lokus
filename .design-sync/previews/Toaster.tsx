import { Toaster } from 'lokus';

// Toaster is the sonner mount point Lokus renders once in the app shell. It
// paints nothing until `toast()` is called, and a static capture cannot call
// it — so both stories render the REAL <Toaster /> alongside a Lokus-styled
// block that says what it is and what drives it. (Verified: importing
// `toast` from 'sonner' in this preview does NOT reach the <Toaster /> inside
// the bundle — the bundle inlines its own sonner singleton. See learnings.)

export const MountPoint = () => (
  <div className="grid gap-3">
    <div className="rounded-md border border-app-border bg-app-panel p-4">
      <div className="text-xs uppercase tracking-wide text-app-muted mb-2">
        Toaster — notification mount point
      </div>
      <div className="text-sm text-app-text leading-relaxed">
        Rendered once in the Lokus app shell, beside the workspace. It draws nothing on its
        own — every notification comes from calling{' '}
        <span className="font-mono text-app-accent">toast()</span> from{' '}
        <span className="font-mono text-app-accent">sonner</span> anywhere in the tree, so
        the sync engine, plugin loader and editor all share one surface.
      </div>
    </div>
    <div className="rounded-md border border-app-border bg-app-panel p-3 flex items-center justify-between gap-4">
      <span className="font-mono text-xs text-app-accent">{'<Toaster />'}</span>
      <span className="text-xs text-app-muted">
        dark theme · pinned top-right, 16px offset · up to 4 stacked · close button
      </span>
    </div>
    <Toaster />
  </div>
);

export const CallSites = () => (
  <div className="grid gap-3">
    <div className="text-xs uppercase tracking-wide text-app-muted">
      What Lokus sends through the Toaster
    </div>
    <div className="rounded-md border border-app-border bg-app-panel p-3 grid gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-app-accent">toast.success</span>
        <span className="text-sm text-app-text">Workspace synced — 14 files uploaded</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-app-accent">toast.error</span>
        <span className="text-sm text-app-text">Sync failed — vault storage unreachable</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-app-accent">toast</span>
        <span className="text-sm text-app-text">Note moved to trash — Weekly Review.md</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-app-accent">toast.promise</span>
        <span className="text-sm text-app-text">Exporting 42 notes to PDF…</span>
      </div>
    </div>
    <div className="text-xs text-app-muted">
      Toast styling comes from the Toaster&apos;s <span className="font-mono">toastOptions</span>{' '}
      class map — panel background, app border, accent action button.
    </div>
    <Toaster />
  </div>
);
