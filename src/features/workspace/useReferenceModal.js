import { useCallback } from "react";
import { useViewStore } from "../../stores/views";
import referenceManager from "../../core/references/ReferenceManager.js";

/**
 * Manages the reference update modal lifecycle: checking references before a
 * file move/rename, confirming the update, and closing the modal.
 */
export function useReferenceModal() {
  // Handler for checking references before file move/rename
  const handleCheckReferences = useCallback(({ oldPath, newPath, affectedFiles, operation }) => {
    useViewStore.getState().setReferenceUpdateModal({
      isOpen: true,
      oldPath,
      newPath,
      affectedFiles: affectedFiles.map(f => f.filePath),
      isProcessing: false,
      result: null,
      pendingOperation: operation,
    });
  }, []);

  // Handler for confirming reference updates
  const handleConfirmReferenceUpdate = useCallback(async (updateReferences) => {
    const { oldPath, newPath, pendingOperation } = useViewStore.getState().referenceUpdateModal;

    useViewStore.getState().setReferenceUpdateModal({ isProcessing: true });

    try {
      // First, execute the move/rename operation
      const operationSuccess = await pendingOperation();

      if (!operationSuccess) {
        useViewStore.getState().setReferenceUpdateModal({
          isProcessing: false,
          result: { success: false, error: 'Operation failed' },
        });
        return;
      }

      // If user chose to update references, do it now
      if (updateReferences) {
        const result = await referenceManager.updateAllReferences(oldPath, newPath);
        useViewStore.getState().setReferenceUpdateModal({
          isProcessing: false,
          result: { success: true, updated: result.updated, files: result.files },
        });
      } else {
        // Just close after successful operation without updating references
        useViewStore.getState().setReferenceUpdateModal({
          isOpen: false,
          oldPath: null,
          newPath: null,
          affectedFiles: [],
          isProcessing: false,
          result: null,
          pendingOperation: null,
        });
      }
    } catch (err) {
      useViewStore.getState().setReferenceUpdateModal({
        isProcessing: false,
        result: { success: false, error: err.message || 'Failed to update references' },
      });
    }
  }, []);

  // Handler for closing reference update modal
  const handleCloseReferenceModal = useCallback(() => {
    useViewStore.getState().setReferenceUpdateModal({
      isOpen: false,
      oldPath: null,
      newPath: null,
      affectedFiles: [],
      isProcessing: false,
      result: null,
      pendingOperation: null,
    });
  }, []);

  return {
    handleCheckReferences,
    handleConfirmReferenceUpdate,
    handleCloseReferenceModal,
  };
}
