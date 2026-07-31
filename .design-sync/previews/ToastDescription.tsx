import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from 'lokus';

// ToastDescription only exists inside a Toast, which only renders inside a
// ToastProvider + ToastViewport. The viewport ships `position: fixed`; pinned
// into normal flow here so a static capture can show it.
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

// One line of detail under the title — the common case.
export const OneLineDetail = () => (
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
        <ToastTitle>Note moved to trash</ToastTitle>
        <ToastDescription>Journal / Weekly Review.md — recoverable for 30 days.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);

// The description wraps, so it can carry a full explanation — here a sync
// conflict that needs the file path spelled out.
export const WrappedExplanation = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Sync conflict resolved</ToastTitle>
        <ToastDescription>
          Weekly Review.md changed on two devices. Lokus kept the newer copy and saved the other
          as Journal / Weekly Review (conflict).md so nothing is lost.
        </ToastDescription>
      </div>
      <ToastAction altText="Open the conflicted copy" className="border-app-border text-app-text">
        Open
      </ToastAction>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <div className="grid gap-1">
        <ToastTitle>Plugin installed</ToastTitle>
        <ToastDescription>Kanban Board v1.4.0 is ready to use.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);
