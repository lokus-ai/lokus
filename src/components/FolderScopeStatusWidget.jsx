import React from 'react';
import { Globe, Target } from 'lucide-react';
import { useFolderScope } from '../contexts/FolderScopeContext';

export default function FolderScopeStatusWidget() {
  const { scopeMode, getScopeStatus } = useFolderScope();

  const status = getScopeStatus();

  if (scopeMode === 'global') {
    return (
      <div className="flex items-center gap-1 text-app-muted hover:text-app-text transition-colors cursor-default" title="Global view - All files visible">
        <Globe className="w-3 h-3" />
        <span className="text-xs">Global</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-app-accent hover:text-app-accent/80 transition-colors cursor-default" title={status.description}>
      <Target className="w-3 h-3" />
      <span className="text-xs">Local</span>
    </div>
  );
}