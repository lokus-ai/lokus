import { useState, useEffect } from 'react';
import { Mail, Plus, Search, RefreshCw, Settings, Archive, Trash2, Inbox } from 'lucide-react';
import GmailSidebar from '../components/gmail/GmailSidebar.jsx';
import EmailList from '../components/gmail/EmailList.jsx';
import EmailViewer from '../components/gmail/EmailViewer.jsx';
import EmailComposer from '../components/gmail/EmailComposer.jsx';
import GmailLogin from '../components/gmail/GmailLogin.jsx';
import { gmailAuth, gmailEmails } from '../services/gmail.js';

export default function Gmail({ workspacePath }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('inbox'); // inbox, sent, drafts, etc.
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [composerMode, setComposerMode] = useState('new'); // new, reply, forward
  const [emails, setEmails] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState(new Set());
  const [userProfile, setUserProfile] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Load emails when view changes or user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadEmails();
    }
  }, [isAuthenticated, currentView]);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const authenticated = await gmailAuth.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        const profile = await gmailAuth.getUserProfile();
        setUserProfile(profile);
      }
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const loadEmails = async () => {
    try {
      setRefreshing(true);
      let emailList = [];

      switch (currentView) {
        case 'inbox':
          emailList = await gmailEmails.getInbox();
          break;
        case 'sent':
          emailList = await gmailEmails.getSentEmails();
          break;
        case 'drafts':
          emailList = await gmailEmails.getDrafts();
          break;
        case 'starred':
          emailList = await gmailEmails.getStarredEmails();
          break;
        default:
          emailList = await gmailEmails.getEmailsByLabel(currentView);
      }

      setEmails(emailList);
      // Clear selected email if it's not in the new list
      if (selectedEmail && !emailList.find(e => e.id === selectedEmail.id)) {
        setSelectedEmail(null);
      }
    } catch (error) {
      // Show error toast/notification here
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      loadEmails();
      return;
    }

    try {
      setRefreshing(true);
      const results = await gmailEmails.searchEmails(query);
      setEmails(results);
      setSearchQuery(query);
    } catch (err) {
      console.error('Gmail: Failed to search emails', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCompose = (mode = 'new', email = null) => {
    setComposerMode(mode);
    if (mode === 'reply' || mode === 'forward') {
      setSelectedEmail(email);
    }
    setShowComposer(true);
  };

  const handleEmailSelect = (email) => {
    setSelectedEmail(email);
    // Mark as read if unread
    if (!email.isRead) {
      gmailEmails.markAsRead(email.id).catch((err) => {
        console.error('Gmail: Failed to mark email as read', err);
      });
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedEmails.size === 0) return;

    try {
      const emailIds = Array.from(selectedEmails);

      switch (action) {
        case 'archive':
          await gmailEmails.archiveEmails(emailIds);
          break;
        case 'delete':
          await gmailEmails.deleteEmails(emailIds);
          break;
        case 'markRead':
          await gmailEmails.markEmailsAsRead(emailIds);
          break;
        case 'markUnread':
          await gmailEmails.markEmailsAsUnread(emailIds);
          break;
      }

      setSelectedEmails(new Set());
      loadEmails(); // Refresh the list
    } catch (err) {
      console.error('Gmail: Failed to perform bulk action', err);
    }
  };

  const handleLogout = async () => {
    try {
      await gmailAuth.logout();
      setIsAuthenticated(false);
      setUserProfile(null);
      setEmails([]);
      setSelectedEmail(null);
      setSelectedEmails(new Set());
    } catch (err) {
      console.error('Gmail: Failed to logout', err);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-app-bg text-app-text flex items-center justify-center">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading Gmail...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-full bg-app-bg text-app-text">
        <GmailLogin onLoginSuccess={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="h-full bg-app-bg text-app-text flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-app-border bg-app-panel">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-app-accent" />
          <h1 className="text-lg font-semibold">Gmail</h1>
          {userProfile && (
            <span className="text-sm text-app-text-secondary">
              {userProfile.email}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-app-text-secondary" />
            <input
              type="text"
              placeholder="Search emails..."
              className="pl-9 pr-3 py-2 w-64 bg-app-bg border border-app-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-app-accent/50 focus:border-app-accent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch(e.target.value);
                }
              }}
            />
          </div>

          {/* Bulk Actions */}
          {selectedEmails.size > 0 && (
            <div className="flex items-center gap-1 border-l border-app-border pl-2 ml-2">
              <button
                onClick={() => handleBulkAction('archive')}
                className="obsidian-button icon-only"
                title="Archive selected"
              >
                <Archive className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="obsidian-button icon-only"
                title="Delete selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={loadEmails}
            className="obsidian-button icon-only"
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Compose */}
          <button
            onClick={() => handleCompose('new')}
            className="obsidian-button flex items-center gap-2 px-3"
          >
            <Plus className="w-4 h-4" />
            Compose
          </button>

          {/* Settings */}
          <button
            onClick={handleLogout}
            className="obsidian-button icon-only"
            title="Logout"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <GmailSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onCompose={() => handleCompose('new')}
          userProfile={userProfile}
        />

        {/* Email List */}
        <div className="w-96 border-r border-app-border overflow-hidden">
          <EmailList
            emails={emails}
            selectedEmail={selectedEmail}
            selectedEmails={selectedEmails}
            onEmailSelect={handleEmailSelect}
            onEmailsSelect={setSelectedEmails}
            onCompose={handleCompose}
            refreshing={refreshing}
            currentView={currentView}
          />
        </div>

        {/* Email Viewer */}
        <div className="flex-1 overflow-hidden">
          {selectedEmail ? (
            <EmailViewer
              email={selectedEmail}
              onCompose={handleCompose}
              onRefresh={loadEmails}
              workspacePath={workspacePath}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-app-text-secondary">
              <div className="text-center">
                <Inbox className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">No email selected</p>
                <p className="text-sm">Select an email from the list to view it here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Composer Modal */}
      {showComposer && (
        <EmailComposer
          mode={composerMode}
          replyToEmail={composerMode !== 'new' ? selectedEmail : null}
          onClose={() => setShowComposer(false)}
          onSend={() => {
            setShowComposer(false);
            loadEmails(); // Refresh to show sent email in appropriate folder
          }}
        />
      )}
    </div>
  );
}