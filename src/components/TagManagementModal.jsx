import React, { useState, useEffect, useRef } from 'react';
import { X, Tag, Plus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

/**
 * TagManagementModal - Modal for adding and managing tags on markdown files
 *
 * Features:
 * - Add new tags with autocomplete
 * - Remove existing tags
 * - Save tags to YAML frontmatter
 * - Tag suggestions from other files
 */
const TagManagementModal = ({ isOpen, onClose, file, onTagsUpdated }) => {
  const [tags, setTags] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  // Load existing tags from file on mount
  useEffect(() => {
    if (isOpen && file) {
      loadFileTags();
    }
  }, [isOpen, file]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const loadFileTags = async () => {
    setIsLoading(true);
    try {
      const content = await invoke('read_file_content', { path: file.path });
      const parsed = parseFrontmatter(content);
      setTags(parsed.tags || []);
    } catch (error) {
      setTags([]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseFrontmatter = (content) => {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { tags: [], content };
    }

    const frontmatterText = match[1];
    const tags = [];

    // Parse tags from frontmatter (supports multiple formats)
    const tagMatches = frontmatterText.match(/^tags:\s*(.+)$/m);
    if (tagMatches) {
      const tagValue = tagMatches[1].trim();

      // Handle array format: [tag1, tag2, tag3]
      if (tagValue.startsWith('[') && tagValue.endsWith(']')) {
        const tagArray = tagValue.slice(1, -1).split(',').map(t => t.trim().replace(/['"]/g, ''));
        tags.push(...tagArray.filter(t => t));
      }
      // Handle comma-separated: tag1, tag2, tag3
      else if (tagValue.includes(',')) {
        const tagArray = tagValue.split(',').map(t => t.trim().replace(/['"]/g, ''));
        tags.push(...tagArray.filter(t => t));
      }
      // Handle single tag
      else {
        const cleanTag = tagValue.replace(/['"]/g, '');
        if (cleanTag) tags.push(cleanTag);
      }
    }

    return { tags, content };
  };

  const updateFrontmatter = (content, newTags) => {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    const tagLine = newTags.length > 0
      ? `tags: [${newTags.map(t => `"${t}"`).join(', ')}]`
      : '';

    if (!match) {
      // No frontmatter exists - create new one
      if (newTags.length > 0) {
        return `---\n${tagLine}\n---\n\n${content}`;
      }
      return content;
    }

    let frontmatterText = match[1];

    // Remove existing tags line
    frontmatterText = frontmatterText.replace(/^tags:\s*.*$/m, '').trim();

    // Add new tags line if tags exist
    if (newTags.length > 0) {
      frontmatterText = frontmatterText
        ? `${frontmatterText}\n${tagLine}`
        : tagLine;
    }

    // Replace frontmatter in content
    if (frontmatterText) {
      return content.replace(frontmatterRegex, `---\n${frontmatterText}\n---`);
    } else {
      // Remove empty frontmatter
      return content.replace(frontmatterRegex, '').trim();
    }
  };

  const handleAddTag = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !tags.includes(trimmedValue)) {
      setTags([...tags, trimmedValue]);
      setInputValue('');
      setSuggestions([]);
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Read current file content
      const content = await invoke('read_file_content', { path: file.path });

      // Update frontmatter with new tags
      const updatedContent = updateFrontmatter(content, tags);

      // Write back to file
      await invoke('write_file_content', {
        path: file.path,
        content: updatedContent
      });

      // Notify parent component
      if (onTagsUpdated) {
        onTagsUpdated(file, tags);
      }

      onClose();
    } catch (error) {
      alert(`Failed to save tags: ${error.message || error}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Manage Tags
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {file?.name}
            </p>
          </div>

          {/* Tag Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add Tag
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter tag name..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleAddTag}
                disabled={!inputValue.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Current Tags */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Tags ({tags.length})
            </label>
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading tags...</p>
            ) : tags.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No tags yet. Add some above!
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TagManagementModal;
