import { useState, useEffect } from 'react';
import { 
  Inbox, 
  Star, 
  Send, 
  FileText, 
  Archive, 
  Trash2, 
  AlertCircle, 
  Plus,
  Tag,
  Clock,
  Users,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { gmailEmails } from "../../../services/gmail.js";

const SYSTEM_LABELS = [
  { id: 'inbox', name: 'Inbox', icon: Inbox, count: 0 },
  { id: 'starred', name: 'Starred', icon: Star, count: 0 },
  { id: 'sent', name: 'Sent', icon: Send, count: 0 },
  { id: 'drafts', name: 'Drafts', icon: FileText, count: 0 },
  { id: 'archive', name: 'Archive', icon: Archive, count: 0 },
  { id: 'spam', name: 'Spam', icon: AlertCircle, count: 0 },
  { id: 'trash', name: 'Trash', icon: Trash2, count: 0 },
];

export default function GmailSidebar({ 
  currentView, 
  onViewChange, 
  onCompose, 
  userProfile 
}) {
  const [labels, setLabels] = useState(SYSTEM_LABELS);
  const [customLabels, setCustomLabels] = useState([]);
  const [showCustomLabels, setShowCustomLabels] = useState(true);
  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);

  useEffect(() => {
    loadLabelsWithCounts();
    loadStorageInfo();
  }, []);

  const loadLabelsWithCounts = async () => {
    try {
      setLoading(true);
      
      // Load system label counts
      const updatedLabels = await Promise.all(
        SYSTEM_LABELS.map(async (label) => {
          try {
            const count = await gmailEmails.getLabelCount(label.id);
            return { ...label, count };
          } catch (error) {
            console.error(`Failed to get count for ${label.id}:`, error);
            return label;
          }
        })
      );
      
      setLabels(updatedLabels);

      // Load custom labels
      try {
        const customLabelList = await gmailEmails.getCustomLabels();
        setCustomLabels(customLabelList);
      } catch (error) {
        console.error('Failed to load custom labels:', error);
      }
      
    } catch (error) {
      console.error('Failed to load labels:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const storage = await gmailEmails.getStorageInfo();
      setStorageInfo(storage);
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  };

  const formatStorageSize = (bytes) => {
    if (!bytes) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  const getStoragePercentage = () => {
    if (!storageInfo) return 0;
    return Math.min((storageInfo.used / storageInfo.total) * 100, 100);
  };

  const SidebarLabel = ({ label, isActive, onClick, isCustom = false }) => {
    const Icon = label.icon || Tag;
    
    return (
      <button
        onClick={() => onClick(label.id)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
          isActive 
            ? 'bg-app-accent text-app-accent-fg' 
            : 'text-app-text hover:bg-app-panel-secondary'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{label.name}</span>
        </div>
        
        {label.count > 0 && (
          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
            isActive 
              ? 'bg-app-accent-fg/20 text-app-accent-fg' 
              : 'bg-app-panel text-app-text-secondary'
          }`}>
            {label.count > 999 ? '999+' : label.count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="w-64 bg-app-panel border-r border-app-border flex flex-col">
      {/* Compose Button */}
      <div className="p-4 border-b border-app-border">
        <button
          onClick={onCompose}
          className="w-full obsidian-button flex items-center justify-center gap-2 py-3"
        >
          <Plus className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* Labels List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {/* System Labels */}
          <div className="space-y-1">
            {labels.map((label) => (
              <SidebarLabel
                key={label.id}
                label={label}
                isActive={currentView === label.id}
                onClick={onViewChange}
              />
            ))}
          </div>

          {/* Custom Labels Section */}
          {customLabels.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowCustomLabels(!showCustomLabels)}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs font-medium text-app-text-secondary hover:text-app-text transition-colors"
              >
                {showCustomLabels ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Labels
              </button>
              
              {showCustomLabels && (
                <div className="mt-1 space-y-1">
                  {customLabels.map((label) => (
                    <SidebarLabel
                      key={label.id}
                      label={label}
                      isActive={currentView === label.id}
                      onClick={onViewChange}
                      isCustom={true}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Storage Info */}
      {storageInfo && (
        <div className="p-4 border-t border-app-border">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-app-text-secondary">
              <span>Storage</span>
              <span>
                {formatStorageSize(storageInfo.used)} of {formatStorageSize(storageInfo.total)}
              </span>
            </div>
            
            <div className="w-full bg-app-bg rounded-full h-2">
              <div 
                className="bg-app-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${getStoragePercentage()}%` }}
              />
            </div>
            
            {getStoragePercentage() > 90 && (
              <p className="text-xs text-app-danger">
                Storage almost full
              </p>
            )}
          </div>
        </div>
      )}

      {/* User Profile */}
      {userProfile && (
        <div className="p-4 border-t border-app-border">
          <div className="flex items-center gap-3">
            {userProfile.picture ? (
              <img
                src={userProfile.picture}
                alt={userProfile.name}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-app-accent text-app-accent-fg rounded-full flex items-center justify-center text-sm font-medium">
                {userProfile.name?.[0] || userProfile.email?.[0] || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-app-text truncate">
                {userProfile.name || userProfile.email}
              </p>
              <p className="text-xs text-app-text-secondary truncate">
                {userProfile.email}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}