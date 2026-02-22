import { useState, useCallback, useRef } from 'react';

/**
 * Hook for managing VSCode-style editor groups with dynamic splitting
 *
 * Editor groups are organized in a tree structure:
 * - Leaf nodes: Editor groups with tabs
 * - Branch nodes: Containers that split (vertical/horizontal)
 */

let groupIdCounter = 0;

// Reset counter in development for hot reload
if (import.meta.hot) {
  groupIdCounter = 0;
}

const generateGroupId = () => {
  return `group-${++groupIdCounter}`;
};

const generateContainerId = () => {
  return `container-${++groupIdCounter}`;
};

/**
 * Creates a new editor group
 */
const createEditorGroup = (tabs = [], activeTab = null) => {
  return {
    id: generateGroupId(),
    type: 'group',
    tabs: tabs,
    activeTab: activeTab,
  };
};

/**
 * Creates a split container
 */
const createSplitContainer = (direction, children, sizes = null) => {
  return {
    id: generateContainerId(),
    type: 'container',
    direction, // 'horizontal' or 'vertical'
    children, // Array of groups or containers
    sizes: sizes || children.map(() => 100 / children.length), // Percentage for each child
  };
};

export function useEditorGroups(initialTabs = []) {
  // Initialize with a single editor group
  const [layout, setLayout] = useState(() =>
    createEditorGroup(initialTabs, initialTabs[0]?.path || null)
  );

  const [focusedGroupId, setFocusedGroupId] = useState(() => layout.id);
  const [draggedTab, setDraggedTab] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { groupId, position: 'top'|'bottom'|'left'|'right'|'center' }

  /**
   * Find a group by ID in the layout tree
   */
  const findGroup = useCallback((node, groupId) => {
    if (node.type === 'group' && node.id === groupId) {
      return node;
    }
    if (node.type === 'container') {
      for (const child of node.children) {
        const found = findGroup(child, groupId);
        if (found) return found;
      }
    }
    return null;
  }, []);

  /**
   * Get all groups as flat array
   */
  const getAllGroups = useCallback((node = layout) => {
    if (node.type === 'group') {
      return [node];
    }
    if (node.type === 'container') {
      return node.children.flatMap(child => getAllGroups(child));
    }
    return [];
  }, [layout]);

  /**
   * Update a specific group
   */
  const updateGroup = useCallback((groupId, updater) => {
    setLayout(prev => {
      const update = (node) => {
        if (node.type === 'group' && node.id === groupId) {
          return typeof updater === 'function' ? updater(node) : { ...node, ...updater };
        }
        if (node.type === 'container') {
          return {
            ...node,
            children: node.children.map(update),
          };
        }
        return node;
      };
      return update(prev);
    });
  }, []);

  /**
   * Update a tab's path across all groups (used when file is moved/renamed)
   */
  const updateTabPath = useCallback((oldPath, newPath) => {
    const newName = newPath.split('/').pop() || newPath;
    setLayout(prev => {
      const update = (node) => {
        if (node.type === 'group') {
          const updatedTabs = node.tabs.map(tab =>
            tab.path === oldPath ? { ...tab, path: newPath, name: newName } : tab
          );
          return {
            ...node,
            tabs: updatedTabs,
            activeTab: node.activeTab === oldPath ? newPath : node.activeTab,
          };
        }
        if (node.type === 'container') {
          return {
            ...node,
            children: node.children.map(update),
          };
        }
        return node;
      };
      return update(prev);
    });
  }, []);

  /**
   * Add a tab to a group
   */
  const addTab = useCallback((groupId, tab, makeActive = true) => {
    updateGroup(groupId, (group) => {
      const exists = group.tabs.find(t => t.path === tab.path);
      if (exists) {
        return makeActive ? { ...group, activeTab: tab.path } : group;
      }
      return {
        ...group,
        tabs: [...group.tabs, tab],
        activeTab: makeActive ? tab.path : group.activeTab,
      };
    });
  }, [updateGroup]);

  /**
   * Remove a tab from a group
   */
  const removeTab = useCallback((groupId, tabPath) => {
    updateGroup(groupId, (group) => {
      const newTabs = group.tabs.filter(t => t.path !== tabPath);
      const newActiveTab = group.activeTab === tabPath
        ? (newTabs[0]?.path || null)
        : group.activeTab;

      return {
        ...group,
        tabs: newTabs,
        activeTab: newActiveTab,
      };
    });
  }, [updateGroup]);

  /**
   * Move a tab from one group to another
   */
  const moveTab = useCallback((fromGroupId, toGroupId, tabPath) => {
    const fromGroup = findGroup(layout, fromGroupId);
    if (!fromGroup) return;

    const tab = fromGroup.tabs.find(t => t.path === tabPath);
    if (!tab) return;

    removeTab(fromGroupId, tabPath);
    addTab(toGroupId, tab, true);
  }, [layout, findGroup, removeTab, addTab]);

  /**
   * Set active tab in a group
   */
  const setActiveTab = useCallback((groupId, tabPath) => {
    updateGroup(groupId, { activeTab: tabPath });
    setFocusedGroupId(groupId);
  }, [updateGroup]);

  /**
   * Split a group in a direction
   * @param groupId - The group to split
   * @param direction - 'horizontal' or 'vertical'
   * @param position - 'before' or 'after'
   * @param newGroupTab - Optional tab to add to the new group
   */
  const splitGroup = useCallback((groupId, direction, position = 'after', newGroupTab = null) => {
    setLayout(prev => {
      const split = (node, parentContainer = null) => {
        if (node.type === 'group' && node.id === groupId) {
          const newGroup = createEditorGroup(
            newGroupTab ? [newGroupTab] : [],
            newGroupTab?.path || null
          );

          // If the node is already inside a container with the same direction, just add to it
          if (parentContainer && parentContainer.direction === direction) {
            return null; // Will be handled by parent
          }

          // Otherwise, create a new container
          const children = position === 'before' ? [newGroup, node] : [node, newGroup];
          return createSplitContainer(direction, children);
        }

        if (node.type === 'container') {
          const newChildren = node.children.map(child => {
            const result = split(child, node);
            if (result) return result;

            // Check if we should add a new group to this container
            if (child.type === 'group' && child.id === groupId && node.direction === direction) {
              const newGroup = createEditorGroup(
                newGroupTab ? [newGroupTab] : [],
                newGroupTab?.path || null
              );
              return null; // Signal to add newGroup
            }

            return child;
          }).filter(Boolean);

          // If we found the group and this container has the right direction, add the new group
          if (node.direction === direction && node.children.some(c => c.type === 'group' && c.id === groupId)) {
            const groupIndex = node.children.findIndex(c => c.type === 'group' && c.id === groupId);
            const newGroup = createEditorGroup(
              newGroupTab ? [newGroupTab] : [],
              newGroupTab?.path || null
            );
            if (position === 'before') {
              newChildren.splice(groupIndex, 0, newGroup);
            } else {
              newChildren.splice(groupIndex + 1, 0, newGroup);
            }
            return {
              ...node,
              children: newChildren,
              sizes: newChildren.map(() => 100 / newChildren.length),
            };
          }

          return {
            ...node,
            children: newChildren,
          };
        }

        return node;
      };

      return split(prev);
    });
  }, []);

  /**
   * Close a group and redistribute its tabs
   */
  const closeGroup = useCallback((groupId) => {
    setLayout(prev => {
      // If this is the only group, just clear its tabs
      if (prev.type === 'group' && prev.id === groupId) {
        return { ...prev, tabs: [], activeTab: null };
      }

      const remove = (node, parentContainer = null, indexInParent = 0) => {
        if (node.type === 'group' && node.id === groupId) {
          return null; // Remove this group
        }

        if (node.type === 'container') {
          const newChildren = node.children
            .map((child, idx) => remove(child, node, idx))
            .filter(Boolean);

          // If only one child remains, collapse the container
          if (newChildren.length === 1) {
            return newChildren[0];
          }

          // If no children remain, remove the container
          if (newChildren.length === 0) {
            return null;
          }

          return {
            ...node,
            children: newChildren,
            sizes: newChildren.map(() => 100 / newChildren.length),
          };
        }

        return node;
      };

      const result = remove(prev);
      return result || createEditorGroup([], null);
    });
  }, []);

  /**
   * Update container sizes (for resizing)
   */
  const updateSizes = useCallback((containerId, sizes) => {
    setLayout(prev => {
      const update = (node) => {
        if (node.type === 'container' && node.id === containerId) {
          return { ...node, sizes };
        }
        if (node.type === 'container') {
          return {
            ...node,
            children: node.children.map(update),
          };
        }
        return node;
      };
      return update(prev);
    });
  }, []);

  /**
   * Focus the next/previous group
   */
  const focusAdjacentGroup = useCallback((direction) => {
    const groups = getAllGroups();
    const currentIndex = groups.findIndex(g => g.id === focusedGroupId);
    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % groups.length;
    } else {
      nextIndex = (currentIndex - 1 + groups.length) % groups.length;
    }

    setFocusedGroupId(groups[nextIndex].id);
  }, [focusedGroupId, getAllGroups]);

  return {
    layout,
    focusedGroupId,
    draggedTab,
    dropTarget,

    // Actions
    setLayout,
    setFocusedGroupId,
    setDraggedTab,
    setDropTarget,
    addTab,
    removeTab,
    moveTab,
    setActiveTab,
    splitGroup,
    closeGroup,
    updateSizes,
    focusAdjacentGroup,
    updateTabPath,

    // Queries
    findGroup: (groupId) => findGroup(layout, groupId),
    getAllGroups: () => getAllGroups(),
  };
}
