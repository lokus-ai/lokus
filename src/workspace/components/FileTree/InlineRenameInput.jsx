/**
 * Inline Rename Input Component
 * Provides inline renaming capability for files and folders
 */
import { useState, useRef, useEffect } from "react";

function InlineRenameInput({ initialValue, onSubmit, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    onSubmit(value);
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

export default InlineRenameInput;
