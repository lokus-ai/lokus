import React, { useState, useEffect, useCallback } from 'react';
import './TreeView.css';

/**
 * TreeItem component - Renders a single tree item with expand/collapse
 */
function TreeItem({ item, provider, level = 0, onItemClick }) {
  const [expanded, setExpanded] = useState(item.collapsibleState === 2); // 2 = Expanded
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  const isCollapsible = item.collapsibleState && item.collapsibleState !== 0;

  const loadChildren = useCallback(async () => {
    if (!isCollapsible || children.length > 0) return;
    setLoading(true);
    try {
      const items = await provider.getChildren(item._element);
      const treeItems = await Promise.all(
        items.map(async (el) => ({
          ...(await provider.getTreeItem(el)),
          _element: el
        }))
      );
      setChildren(treeItems);
    } catch (error) {
      console.error('Failed to load children:', error);
    }
    setLoading(false);
  }, [provider, item._element, isCollapsible, children.length]);

  useEffect(() => {
    if (expanded && isCollapsible) {
      loadChildren();
    }
  }, [expanded, isCollapsible, loadChildren]);

  const handleToggle = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleClick = () => {
    if (item.command) {
      onItemClick(item.command);
    }
  };

  return (
    <div className="tree-item-container">
      <div
        className={`tree-item ${item.contextValue || ''}`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={handleClick}
      >
        {isCollapsible ? (
          <span
            className={`tree-item-chevron ${expanded ? 'expanded' : ''}`}
            onClick={handleToggle}
          >
            ▶
          </span>
        ) : (
          <span className="tree-item-spacer" />
        )}

        {item.iconPath && (
          <span className="tree-item-icon">
            {typeof item.iconPath === 'string' ? item.iconPath : '📄'}
          </span>
        )}

        <span className="tree-item-label">
          {typeof item.label === 'string' ? item.label : item.label?.label}
        </span>

        {item.description && (
          <span className="tree-item-description">{item.description}</span>
        )}
      </div>

      {expanded && isCollapsible && (
        <div className="tree-item-children">
          {loading ? (
            <div className="tree-item-loading" style={{ paddingLeft: `${(level + 1) * 16 + 4}px` }}>
              Loading...
            </div>
          ) : (
            children.map((child, index) => (
              <TreeItem
                key={child.id || index}
                item={child}
                provider={provider}
                level={level + 1}
                onItemClick={onItemClick}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TreeView component - Main container for tree view
 */
export function TreeView({ provider, viewId, title, onCommand }) {
  const [rootItems, setRootItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRootItems = useCallback(async () => {
    setLoading(true);
    try {
      const items = await provider.getChildren(undefined);
      const treeItems = await Promise.all(
        items.map(async (el) => ({
          ...(await provider.getTreeItem(el)),
          _element: el
        }))
      );
      setRootItems(treeItems);
    } catch (error) {
      console.error('Failed to load root items:', error);
    }
    setLoading(false);
  }, [provider]);

  useEffect(() => {
    loadRootItems();

    // Listen for refresh events
    const handleChange = () => loadRootItems();
    provider.on('didChangeTreeData', handleChange);

    return () => {
      provider.off('didChangeTreeData', handleChange);
    };
  }, [provider, loadRootItems]);

  const handleItemClick = (command) => {
    if (onCommand && command) {
      onCommand(command.command, ...(command.arguments || []));
    }
  };

  if (loading) {
    return <div className="tree-view-loading">Loading...</div>;
  }

  return (
    <div className="tree-view" data-view-id={viewId}>
      {title && <div className="tree-view-title">{title}</div>}
      <div className="tree-view-content">
        {rootItems.length === 0 ? (
          <div className="tree-view-empty">No items</div>
        ) : (
          rootItems.map((item, index) => (
            <TreeItem
              key={item.id || index}
              item={item}
              provider={provider}
              onItemClick={handleItemClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default TreeView;
