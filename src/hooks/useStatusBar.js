import { useMemo } from 'react';
import { useContributed } from '../features/plugin-v3/hooks.js';
import { host } from '../core/plugin-v3/index.js';

/**
 * Status bar items for v3 plugins.
 * Items are declared in manifests (contributes.statusBar) and updated at
 * runtime through the capability-gated `lokus.ui.setStatusBarItem` RPC.
 */
export function useStatusBar() {
  const items = useContributed('statusBar');

  const mapped = useMemo(
    () =>
      items.map((item) => ({
        id: item.qualifiedId,
        text: item.text,
        tooltip: item.tooltip,
        command: item.command ? `${item.pluginId}.${item.command}` : null,
        pluginId: item.pluginId,
        position: item.position || 'right',
      })),
    [items]
  );

  const leftItems = mapped.filter((i) => i.position === 'left');
  const rightItems = mapped.filter((i) => i.position !== 'left');

  const trigger = (commandId) => {
    if (commandId) host.triggerCommand(commandId).catch(() => {});
  };

  return { leftItems, rightItems, trigger };
}
