import React from 'react';
import { useDroppable } from '@dnd-kit/core';

export default function EditorDropZone({ children }) {
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
        </div>
    );
}
