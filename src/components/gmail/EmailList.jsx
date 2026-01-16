import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Star, 
  Paperclip, 
  CheckSquare, 
  Square, 
  RefreshCw, 
  ChevronDown,
  Inbox,
  Archive,
  Trash2,
  MoreHorizontal
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from '../../utils/dateUtils.js';

export default function EmailList({
  emails,
  selectedEmail,
  selectedEmails,
  onEmailSelect,
  onEmailsSelect,
  onCompose,
  refreshing,
  currentView
}) {
  const [selectAll, setSelectAll] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const listRef = useRef(null);

  // Handle select all checkbox
  useEffect(() => {
    if (selectedEmails.size === 0) {
      setSelectAll(false);
    } else if (selectedEmails.size === emails.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
    setShowBulkActions(selectedEmails.size > 0);
  }, [selectedEmails, emails.length]);

  const handleSelectAll = () => {
    if (selectAll) {
      onEmailsSelect(new Set());
    } else {
      onEmailsSelect(new Set(emails.map(email => email.id)));
    }
  };

  const handleEmailSelection = (emailId, event) => {
    event.stopPropagation();
    const newSelected = new Set(selectedEmails);
    
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    
    onEmailsSelect(newSelected);
  };

  const formatEmailDate = (dateString) => {
    try {
      const date = parseISO(dateString);
      const now = new Date();
      const emailDate = new Date(date);
      
      // If today, show time
      if (emailDate.toDateString() === now.toDateString()) {
        return emailDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      }
      
      // If this year, show month and day
      if (emailDate.getFullYear() === now.getFullYear()) {
        return emailDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      }
      
      // Otherwise show year
      return emailDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return 'Unknown';
    }
  };

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const getEmailPreview = (email) => {
    // Try to get preview from snippet, then from content
    if (email.snippet) {
      return email.snippet;
    }
    
    if (email.content) {
      // Strip HTML tags and get first part
      const textContent = email.content.replace(/<[^>]*>/g, '');
      return textContent.substring(0, 150);
    }
    
    return 'No preview available';
  };

  const EmailItem = ({ email }) => {
    const isSelected = selectedEmails.has(email.id);
    const isCurrentEmail = selectedEmail && selectedEmail.id === email.id;
    
    return (
      <div
        className={`flex items-center gap-3 p-3 border-b border-app-border cursor-pointer transition-colors ${
          isCurrentEmail 
            ? 'bg-app-accent/10 border-app-accent/20' 
            : 'hover:bg-app-panel-secondary'
        } ${!email.isRead ? 'font-medium' : ''}`}
        onClick={() => onEmailSelect(email)}
      >
        {/* Selection Checkbox */}
        <button
          onClick={(e) => handleEmailSelection(email.id, e)}
          className="flex-shrink-0 p-1 hover:bg-app-bg rounded"
          title="Select email"
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-app-accent" />
          ) : (
            <Square className="w-4 h-4 text-app-text-secondary" />
          )}
        </button>

        {/* Star */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Implement star toggle
          }}
          className="flex-shrink-0 p-1 hover:bg-app-bg rounded"
          title={email.isStarred ? "Unstar email" : "Star email"}
        >
          <Star 
            className={`w-4 h-4 ${
              email.isStarred 
                ? 'text-yellow-400 fill-current' 
                : 'text-app-text-secondary'
            }`} 
          />
        </button>

        {/* Email Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span 
                className={`truncate ${
                  !email.isRead 
                    ? 'text-app-text font-medium' 
                    : 'text-app-text-secondary'
                }`}
              >
                {
                  Array.isArray(email.from) && email.from.length > 0
                    ? (email.from[0].name || email.from[0].email || 'Unknown Sender')
                    : 'Unknown Sender'
                }
              </span>
              
              {/* Indicators */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {email.hasAttachments && (
                  <Paperclip className="w-3 h-3 text-app-text-secondary" />
                )}
                {!email.isRead && (
                  <div className="w-2 h-2 bg-app-accent rounded-full" />
                )}
              </div>
            </div>
            
            <span className="text-xs text-app-text-secondary flex-shrink-0">
              {formatEmailDate(email.date)}
            </span>
          </div>
          
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p 
                className={`text-sm truncate mb-1 ${
                  !email.isRead 
                    ? 'text-app-text font-medium' 
                    : 'text-app-text-secondary'
                }`}
              >
                {email.subject || '(no subject)'}
              </p>
              <p className="text-xs text-app-text-secondary truncate">
                {truncateText(getEmailPreview(email), 80)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <Inbox className="w-12 h-12 mx-auto mb-4 text-app-text-secondary opacity-50" />
        <h3 className="text-lg font-medium mb-2">No emails found</h3>
        <p className="text-sm text-app-text-secondary mb-4">
          {currentView === 'inbox' 
            ? "Your inbox is empty. You're all caught up!"
            : `No emails in ${currentView}.`
          }
        </p>
        {currentView === 'inbox' && (
          <button
            onClick={() => onCompose('new')}
            className="obsidian-button text-sm"
          >
            Compose new email
          </button>
        )}
      </div>
    </div>
  );

  if (emails.length === 0 && !refreshing) {
    return <EmptyState />;
  }

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between p-3 border-b border-app-border bg-app-panel">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectAll}
            className="flex-shrink-0 p-1 hover:bg-app-bg rounded"
            title={selectAll ? "Deselect all" : "Select all"}
          >
            {selectAll ? (
              <CheckSquare className="w-4 h-4 text-app-accent" />
            ) : (
              <Square className="w-4 h-4 text-app-text-secondary" />
            )}
          </button>
          
          <span className="text-sm text-app-text-secondary">
            {emails.length} {emails.length === 1 ? 'email' : 'emails'}
            {selectedEmails.size > 0 && ` (${selectedEmails.size} selected)`}
          </span>
        </div>

        {showBulkActions && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {/* TODO: Implement bulk archive */}}
              className="obsidian-button icon-only"
              title="Archive selected"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={() => {/* TODO: Implement bulk delete */}}
              className="obsidian-button icon-only"
              title="Delete selected"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              className="obsidian-button icon-only"
              title="More actions"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto" ref={listRef}>
        {refreshing && emails.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center gap-2 text-app-text-secondary">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading emails...</span>
            </div>
          </div>
        ) : (
          emails.map((email) => (
            <EmailItem key={email.id} email={email} />
          ))
        )}
      </div>

      {/* Loading overlay for refresh */}
      {refreshing && emails.length > 0 && (
        <div className="absolute top-0 left-0 right-0 bg-app-panel/80 backdrop-blur-sm p-2 border-b border-app-border">
          <div className="flex items-center justify-center gap-2 text-sm text-app-text-secondary">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Refreshing...</span>
          </div>
        </div>
      )}
    </div>
  );
}