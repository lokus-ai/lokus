/**
 * Editor Drop Zone Component
 * Provides visual feedback for drag-and-drop file operations
 */
import { useDroppable } from "@dnd-kit/core";

function EditorDropZone({ children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'editor-drop-zone',
    data: { type: 'editor-area' }
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative w-full h-full ${isOver ? 'bg-app-accent bg-opacity-10' : ''}`}
      style={{ position: 'relative' }}
    >
      {children}
      {isOver && (
        <div className="absolute inset-4 border-2 border-dashed border-app-accent bg-app-accent bg-opacity-5 rounded-lg flex items-center justify-center pointer-events-none z-10">
          <div className="text-app-accent font-medium text-lg">
            Drop here to create split view
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorDropZone;
