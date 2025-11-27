import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Image as ImageIcon, File as FileIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';

export default function ExternalDropZone({ workspacePath, onFilesAdded, children }) {
  const [isDraggingExternal, setIsDraggingExternal] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is an external drag (from OS file manager)
    const types = e.dataTransfer.types;
    if (types.includes('Files')) {
      setDragCounter((prev) => prev + 1);
      setIsDraggingExternal(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDraggingExternal(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDraggingExternal(false);
    setDragCounter(0);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    try {
      const copiedFiles = [];

      for (const file of files) {
        // Get the file path from the File object
        const filePath = file.path;
        const fileName = file.name;

        // Construct destination path
        const destPath = await join(workspacePath, fileName);

        // Copy file using Tauri's file system API
        try {
          const content = await invoke('read_file_content', { path: filePath });
          await invoke('write_file_content', { path: destPath, content });
          copiedFiles.push(destPath);
        } catch (err) {
          console.error(`Failed to copy file ${fileName}:`, err);
        }
      }

      if (copiedFiles.length > 0 && onFilesAdded) {
        onFilesAdded(copiedFiles);
      }
    } catch (error) {
      console.error('Error handling file drop:', error);
    }
  }, [workspacePath, onFilesAdded]);

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <ImageIcon size={32} />;
    }
    if (['md', 'txt'].includes(ext)) {
      return <FileText size={32} />;
    }
    return <FileIcon size={32} />;
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="external-drop-zone relative w-full h-full"
    >
      {children}

      <AnimatePresence>
        {isDraggingExternal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="external-drop-overlay fixed inset-0 z-[9999] pointer-events-none"
            style={{
              backgroundColor: 'rgba(var(--accent-color-rgb), 0.1)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div className="flex items-center justify-center h-full">
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ duration: 0.2 }}
                className="drop-zone-indicator bg-[var(--background-primary)] border-2 border-dashed border-[var(--accent-color)] rounded-lg p-12 flex flex-col items-center gap-4"
                style={{
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                }}
              >
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <Upload size={64} className="text-[var(--accent-color)]" />
                </motion.div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    Drop files here
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Files will be copied to your workspace
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
