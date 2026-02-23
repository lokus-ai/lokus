import { useEffect, useRef, useState } from "react";

// Helper to get filename without extension
function getNameWithoutExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return filename.substring(0, lastDotIndex);
  }
  return filename;
}

// Helper to get extension (including the dot)
function getExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return filename.substring(lastDotIndex);
  }
  return '';
}

export function InlineRenameInput({ initialValue, onSubmit, onCancel }) {
  // Store only the name without extension
  const extension = getExtension(initialValue);
  const nameOnly = getNameWithoutExtension(initialValue);
  const [value, setValue] = useState(nameOnly);
  const inputRef = useRef(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.focus();
      // Use requestAnimationFrame to ensure selection happens after DOM paint
      const rafId = requestAnimationFrame(() => {
        if (inputRef.current && document.activeElement === inputRef.current) {
          inputRef.current.select();
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, []);

  const handleKeyDown = (e) => {
    // Stop propagation for ALL keys to prevent file tree shortcuts from firing
    e.stopPropagation();

    if (e.key === 'Enter') {
      e.preventDefault();
      // Add extension back when submitting
      onSubmit(value + extension);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Add extension back when submitting
    onSubmit(value + extension);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="inline-rename-input"
      onClick={(e) => e.stopPropagation()}
    />
  );
}
