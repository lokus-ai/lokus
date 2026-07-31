import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from 'lokus';

// ToastTitle only exists inside a Toast, which only renders inside a
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

// The title is the semibold line — it carries the outcome, the description
// carries the detail.
export const TitleLeadsDescription = () => (
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
        <ToastTitle>Sync failed</ToastTitle>
        <ToastDescription>Vault storage unreachable — 3 edits queued offline.</ToastDescription>
      </div>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport()} />
  </ToastProvider>
);

// For outcomes that need no detail, the title is the entire toast.
export const TitleOnly = () => (
  <ToastProvider duration={Infinity} swipeDirection="right">
    <Toast open duration={Infinity}>
      <ToastTitle>Plugin installed</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <ToastTitle>Template applied</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <Toast open duration={Infinity}>
      <ToastTitle>Graph view rebuilt</ToastTitle>
      <ToastClose className="opacity-100" />
    </Toast>
    <ToastViewport className="static" style={viewport(8)} />
  </ToastProvider>
);
