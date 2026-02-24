import { useShortcuts } from './hooks/useShortcuts';

export function ShortcutListener(props) {
  useShortcuts(props);
  return null;
}
