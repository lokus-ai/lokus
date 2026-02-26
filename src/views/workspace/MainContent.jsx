import React, { lazy, Suspense } from 'react';
import { useViewStore } from '../../stores/views';
import ErrorBoundary from '../../components/ErrorBoundary';

const EditorGroupsView = lazy(() => import('./EditorGroupsView'));
const ProfessionalGraphView = lazy(() => import('../ProfessionalGraphView').then(m => ({ default: m.ProfessionalGraphView })));
const KanbanBoard = lazy(() => import('../../components/KanbanBoard'));
const BasesView = lazy(() => import('../../bases/BasesView'));
const CalendarView = lazy(() => import('../../components/Calendar').then(m => ({ default: m.CalendarView })));
const Canvas = lazy(() => import('../Canvas'));
const Preferences = lazy(() => import('../Preferences'));
const DailyNotesPanel = lazy(() => import('../../components/DailyNotes').then(m => ({ default: m.DailyNotesPanel })));

export default function MainContent({ workspacePath, welcomeProps }) {
  const currentView = useViewStore((s) => s.currentView);
  const onFileOpen = welcomeProps?.onFileOpen;

  const fallback = <div className="flex-1 flex items-center justify-center text-app-muted">Loading...</div>;

  return (
    <ErrorBoundary name="MainContent" message="View crashed">
      <Suspense fallback={fallback}>
        {currentView === 'editor' && <EditorGroupsView workspacePath={workspacePath} welcomeProps={welcomeProps} />}
        {currentView === 'graph' && <ProfessionalGraphView workspacePath={workspacePath} />}
        {currentView === 'kanban' && <KanbanBoard workspacePath={workspacePath} />}
        {currentView === 'bases' && <BasesView isVisible={true} onFileOpen={onFileOpen} />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'canvas' && <Canvas workspacePath={workspacePath} />}
        {currentView === 'settings' && <Preferences workspacePath={workspacePath} />}
        {currentView === 'dailyNotes' && <DailyNotesPanel workspacePath={workspacePath} />}
        {currentView === 'marketplace' && <div className="flex-1 flex items-center justify-center text-app-muted">Marketplace coming soon</div>}
      </Suspense>
    </ErrorBoundary>
  );
}
