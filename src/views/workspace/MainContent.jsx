import React, { lazy, Suspense } from 'react';
import { useViewStore } from '../../stores/views';
import ErrorBoundary from '../../components/ErrorBoundary';

const EditorGroupsView = lazy(() => import('./EditorGroupsView'));
const KanbanBoard = lazy(() => import('../../components/KanbanBoard'));
const CalendarView = lazy(() => import('../../components/Calendar').then(m => ({ default: m.CalendarView })));
const Canvas = lazy(() => import('../Canvas'));
const Preferences = lazy(() => import('../Preferences'));
const DailyNotesPanel = lazy(() => import('../../components/DailyNotes').then(m => ({ default: m.DailyNotesPanel })));

export default function MainContent({ workspacePath, welcomeProps }) {
  const currentView = useViewStore((s) => s.currentView);

  const fallback = <div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>;

  // Bases and Graph are rendered as tabs inside EditorGroupsView,
  // not as separate full-screen views. They open via addTab('__bases__')
  // and addTab('__graph__') in IconSidebar.
  return (
    <ErrorBoundary name="MainContent" message="View crashed">
      <Suspense fallback={fallback}>
        {currentView === 'editor' && <EditorGroupsView workspacePath={workspacePath} welcomeProps={welcomeProps} />}
        {currentView === 'kanban' && <KanbanBoard workspacePath={workspacePath} />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'canvas' && <Canvas workspacePath={workspacePath} />}
        {currentView === 'settings' && <Preferences workspacePath={workspacePath} />}
        {currentView === 'dailyNotes' && <DailyNotesPanel workspacePath={workspacePath} />}
        {currentView === 'marketplace' && <div className="flex-1 flex items-center justify-center text-app-muted">Marketplace coming soon</div>}
      </Suspense>
    </ErrorBoundary>
  );
}
