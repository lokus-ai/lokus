import React, { lazy, Suspense } from 'react';
import { useViewStore } from '../../stores/views';
import { useFeatureFlags } from '../../contexts/RemoteConfigContext';
import ErrorBoundary from '../../components/ErrorBoundary';

const EditorGroupsView = lazy(() => import('./EditorGroupsView'));
const CalendarView = lazy(() => import('../../components/Calendar').then(m => ({ default: m.CalendarView })));
const Canvas = lazy(() => import('../Canvas'));
const Preferences = lazy(() => import('../Preferences'));
const DailyNotesPanel = lazy(() => import('../../components/DailyNotes').then(m => ({ default: m.DailyNotesPanel })));

export default function MainContent({ workspacePath, welcomeProps }) {
  const currentView = useViewStore((s) => s.currentView);
  const featureFlags = useFeatureFlags();

  const fallback = <div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>;

  // Kanban boards open as .kanban tabs inside EditorGroupsView.
  // The kanban icon sidebar button switches the left sidebar to the board list,
  // but keeps EditorGroupsView as the main content.
  const showEditor = currentView === 'editor'
    || (currentView === 'kanban' && featureFlags.enable_kanban)
    || currentView === 'marketplace';

  return (
    <ErrorBoundary name="MainContent" message="View crashed">
      <Suspense fallback={fallback}>
        {showEditor && <EditorGroupsView workspacePath={workspacePath} welcomeProps={welcomeProps} />}
        {featureFlags.enable_calendar && currentView === 'calendar' && <CalendarView workspacePath={workspacePath} />}
        {currentView === 'canvas' && <Canvas workspacePath={workspacePath} />}
        {currentView === 'settings' && <Preferences workspacePath={workspacePath} />}
        {featureFlags.enable_daily_notes && currentView === 'dailyNotes' && <DailyNotesPanel workspacePath={workspacePath} />}
      </Suspense>
    </ErrorBoundary>
  );
}
