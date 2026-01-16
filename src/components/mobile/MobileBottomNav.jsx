import { EditIcon } from 'lucide-react';
import { isMobile } from '../../platform/index.js';
import { FolderIcon,SearchIcon,SettingsIcon } from '../icons/GraphIcons.jsx';

const navItems = [
  { id: 'files', icon: FolderIcon, label: 'Files' },
  { id: 'editor', icon: EditIcon, label: 'Editor' },
  { id: 'search', icon: SearchIcon, label: 'Search' },
  { id: 'settings', icon: SettingsIcon, label: 'Settings' },
];

export function MobileBottomNav({ activeTab, onTabChange }) {
  if (!isMobile()) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-app-panel border-t border-app-border safe-area-inset-bottom z-50">
      <div className="flex justify-around items-center h-[56px]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`
                flex flex-col items-center justify-center gap-1 p-2 min-w-[64px]
                ${isActive ? 'text-app-accent' : 'text-app-muted'}
              `}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}