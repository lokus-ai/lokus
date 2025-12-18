import React, { useState, useEffect, useRef, useCallback } from 'react';
import './QuickPick.css';

export function QuickPick({
  items,
  options = {},
  onSelect,
  onCancel,
  isOpen
}) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const selectedItemRef = useRef(null);

  const {
    placeholder = 'Select an item...',
    canPickMany = false,
    matchOnDescription = false,
    matchOnDetail = false,
    title
  } = options;

  // Filter items based on search
  const filteredItems = items.filter(item => {
    const searchText = filter.toLowerCase();
    if (item.label.toLowerCase().includes(searchText)) return true;
    if (matchOnDescription && item.description?.toLowerCase().includes(searchText)) return true;
    if (matchOnDetail && item.detail?.toLowerCase().includes(searchText)) return true;
    return false;
  });

  // Keyboard navigation
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setFilter('');
      setSelectedIndex(0);
      setSelectedItems(new Set());
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (canPickMany) {
          onSelect(Array.from(selectedItems));
        } else if (filteredItems[selectedIndex]) {
          onSelect(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
      case ' ':
        if (canPickMany && filteredItems[selectedIndex]) {
          e.preventDefault();
          const item = filteredItems[selectedIndex];
          setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(item)) next.delete(item);
            else next.add(item);
            return next;
          });
        }
        break;
    }
  };

  const handleItemClick = useCallback((item, index) => {
    if (canPickMany) {
      setSelectedItems(prev => {
        const next = new Set(prev);
        if (next.has(item)) next.delete(item);
        else next.add(item);
        return next;
      });
      setSelectedIndex(index);
    } else {
      onSelect(item);
    }
  }, [canPickMany, onSelect]);

  if (!isOpen) return null;

  return (
    <div className="quick-pick-overlay" onClick={onCancel}>
      <div className="quick-pick-container" onClick={e => e.stopPropagation()}>
        {title && <div className="quick-pick-title">{title}</div>}
        <div className="quick-pick-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="quick-pick-input"
            placeholder={placeholder}
            value={filter}
            onChange={e => {
              setFilter(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="quick-pick-list" ref={listRef}>
          {filteredItems.map((item, index) => (
            <div
              key={item.label + index}
              ref={index === selectedIndex ? selectedItemRef : null}
              className={`quick-pick-item ${index === selectedIndex ? 'selected' : ''} ${selectedItems.has(item) ? 'checked' : ''}`}
              onClick={() => handleItemClick(item, index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {canPickMany && (
                <div className="quick-pick-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item)}
                    onChange={() => {}}
                    tabIndex={-1}
                  />
                </div>
              )}
              {item.icon && <span className="quick-pick-icon">{item.icon}</span>}
              <div className="quick-pick-item-content">
                <div className="quick-pick-label-row">
                  <span className="quick-pick-label">{item.label}</span>
                  {item.description && <span className="quick-pick-description">{item.description}</span>}
                </div>
                {item.detail && <div className="quick-pick-detail">{item.detail}</div>}
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="quick-pick-empty">No matching items</div>
          )}
        </div>
        {canPickMany && selectedItems.size > 0 && (
          <div className="quick-pick-footer">
            <button
              className="quick-pick-confirm"
              onClick={() => onSelect(Array.from(selectedItems))}
            >
              Select {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
