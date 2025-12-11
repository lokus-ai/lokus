import React, { useEffect, useRef } from 'react';
import { Command } from 'lucide-react';

export default function StatusBarContextMenu({
    isOpen,
    position,
    onClose,
    pluginId,
    commands = [],
    onExecuteCommand
}) {
    const menuRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Smart positioning
    const adjustedPosition = { ...position };
    const menuWidth = 200;
    const menuHeight = Math.min(300, commands.length * 40 + 20);
    const margin = 10;

    // Horizontal positioning
    if (position.x + menuWidth > window.innerWidth - margin) {
        adjustedPosition.x = Math.max(margin, position.x - menuWidth);
    } else {
        adjustedPosition.x = Math.max(margin, position.x);
    }

    // Vertical positioning (prefer above for status bar)
    if (position.y - menuHeight < margin) {
        // If not enough space above, go below (unlikely for status bar but possible)
        adjustedPosition.y = Math.max(margin, position.y);
    } else {
        // Default to above
        adjustedPosition.y = Math.max(margin, position.y - menuHeight);
    }

    // Ensure menu doesn't go off-screen
    adjustedPosition.x = Math.min(adjustedPosition.x, window.innerWidth - menuWidth - margin);
    adjustedPosition.y = Math.min(adjustedPosition.y, window.innerHeight - menuHeight - margin);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 rounded-lg shadow-xl border min-w-48 overflow-hidden"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
                backgroundColor: 'rgb(var(--panel))',
                borderColor: 'rgb(var(--border))',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
            }}
        >
            <div className="py-1">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-700 mb-1">
                    {pluginId} Commands
                </div>

                {commands.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-400 italic">
                        No commands available
                    </div>
                ) : (
                    commands.map((cmd) => (
                        <button
                            key={cmd.command}
                            onClick={() => {
                                onExecuteCommand(cmd.command);
                                onClose();
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-opacity-10 transition-colors text-left"
                            style={{
                                color: 'rgb(var(--text))',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(var(--accent) / 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Command className="w-4 h-4 opacity-70" />
                            <span>{cmd.title || cmd.command}</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
