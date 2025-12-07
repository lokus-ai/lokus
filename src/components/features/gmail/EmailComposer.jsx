import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Paperclip, 
  FileText, 
  Minus, 
  Maximize2, 
  Minimize2,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  AlignLeft,
  Type,
  Save,
  Trash2
} from 'lucide-react';
import { gmailEmails } from "../../../services/gmail.js";

export default function EmailComposer({ 
  mode = 'new', 
  replyToEmail = null, 
  onClose, 
  onSend 
}) {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [loading, setSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  
  // Email fields
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isHtml, setIsHtml] = useState(true);
  const [attachments, setAttachments] = useState([]);
  
  // Auto-save
  const [lastSaved, setLastSaved] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  
  const contentRef = useRef(null);
  const toInputRef = useRef(null);

  useEffect(() => {
    if (replyToEmail && mode !== 'new') {
      initializeReplyContent();
    }
    
    // Focus on TO field for new emails, content for replies
    setTimeout(() => {
      if (mode === 'new') {
        toInputRef.current?.focus();
      } else {
        contentRef.current?.focus();
      }
    }, 100);
  }, [replyToEmail, mode]);

  // Auto-save functionality
  useEffect(() => {
    if (!isDirty) return;
    
    const autoSave = setTimeout(() => {
      saveDraft();
    }, 30000); // Auto-save after 30 seconds of inactivity
    
    return () => clearTimeout(autoSave);
  }, [to, cc, bcc, subject, content, isDirty]);

  const initializeReplyContent = () => {
    if (!replyToEmail) return;
    
    const originalSender = replyToEmail.from?.email || '';
    const originalSubject = replyToEmail.subject || '';
    
    switch (mode) {
      case 'reply':
        setTo(originalSender);
        setSubject(originalSubject.startsWith('Re: ') ? originalSubject : `Re: ${originalSubject}`);
        break;
        
      case 'replyAll':
        setTo(originalSender);
        // Add other recipients to CC (excluding current user)
        const allRecipients = [
          ...(replyToEmail.to || []),
          ...(replyToEmail.cc || [])
        ].filter(addr => addr.email !== originalSender);
        setCc(allRecipients.map(addr => addr.email).join(', '));
        setShowCc(allRecipients.length > 0);
        setSubject(originalSubject.startsWith('Re: ') ? originalSubject : `Re: ${originalSubject}`);
        break;
        
      case 'forward':
        setSubject(originalSubject.startsWith('Fwd: ') ? originalSubject : `Fwd: ${originalSubject}`);
        break;
    }
    
    // Add quoted original content
    if (mode === 'reply' || mode === 'replyAll') {
      const quotedContent = `

------- Original Message -------
From: ${replyToEmail.from?.name || replyToEmail.from?.email}
Date: ${new Date(replyToEmail.date).toLocaleString()}
Subject: ${replyToEmail.subject}

${replyToEmail.textContent || replyToEmail.content || ''}`;
      
      setContent(quotedContent);
    } else if (mode === 'forward') {
      const forwardedContent = `

------- Forwarded Message -------
From: ${replyToEmail.from?.name || replyToEmail.from?.email}
To: ${replyToEmail.to?.map(t => t.email).join(', ')}
Date: ${new Date(replyToEmail.date).toLocaleString()}
Subject: ${replyToEmail.subject}

${replyToEmail.textContent || replyToEmail.content || ''}`;
      
      setContent(forwardedContent);
    }
    
    setIsDirty(true);
  };

  const saveDraft = async () => {
    try {
      const draftData = {
        to: to.split(',').map(email => email.trim()).filter(Boolean),
        cc: cc.split(',').map(email => email.trim()).filter(Boolean),
        bcc: bcc.split(',').map(email => email.trim()).filter(Boolean),
        subject,
        content,
        isHtml,
        attachments: attachments.map(att => att.id)
      };
      
      await gmailEmails.saveDraft(draftData);
      setLastSaved(new Date());
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  const handleSend = async () => {
    if (!to.trim()) {
      alert('Please enter at least one recipient');
      return;
    }
    
    try {
      setSending(true);
      
      const emailData = {
        to: to.split(',').map(email => email.trim()).filter(Boolean),
        cc: cc.split(',').map(email => email.trim()).filter(Boolean),
        bcc: bcc.split(',').map(email => email.trim()).filter(Boolean),
        subject: subject || '(no subject)',
        content,
        isHtml,
        attachments: attachments.map(att => att.id),
        inReplyTo: (mode === 'reply' || mode === 'replyAll') ? replyToEmail?.messageId : undefined,
        references: (mode === 'reply' || mode === 'replyAll') ? replyToEmail?.references : undefined
      };
      
      await gmailEmails.sendEmail(emailData);
      onSend();
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleAttachment = () => {
    // TODO: Implement file picker and attachment upload
  };

  const insertFormatting = (tag) => {
    if (!contentRef.current) return;
    
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      let wrappedText = '';
      switch (tag) {
        case 'bold':
          wrappedText = `<strong>${selectedText}</strong>`;
          break;
        case 'italic':
          wrappedText = `<em>${selectedText}</em>`;
          break;
        case 'underline':
          wrappedText = `<u>${selectedText}</u>`;
          break;
        default:
          wrappedText = selectedText;
      }
      
      range.deleteContents();
      range.insertNode(document.createTextNode(wrappedText));
    }
  };

  const getWindowClasses = () => {
    if (maximized) {
      return 'fixed inset-4 z-50';
    }
    if (minimized) {
      return 'fixed bottom-4 right-4 w-80 h-12 z-50';
    }
    return 'fixed bottom-4 right-4 w-[600px] h-[500px] z-50';
  };

  const getTitle = () => {
    switch (mode) {
      case 'reply':
        return 'Reply';
      case 'replyAll':
        return 'Reply All';
      case 'forward':
        return 'Forward';
      default:
        return 'New Message';
    }
  };

  return (
    <div className={`${getWindowClasses()} bg-app-panel border border-app-border rounded-lg shadow-2xl flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-app-border bg-app-panel-secondary rounded-t-lg">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">{getTitle()}</h3>
          {isDirty && <div className="w-2 h-2 bg-app-warning rounded-full" title="Unsaved changes" />}
          {lastSaved && (
            <span className="text-xs text-app-text-secondary">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMinimized(!minimized)}
            className="obsidian-button icon-only p-1"
            title={minimized ? "Restore" : "Minimize"}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMaximized(!maximized)}
            className="obsidian-button icon-only p-1"
            title={maximized ? "Restore" : "Maximize"}
          >
            {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="obsidian-button icon-only p-1"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Email Fields */}
          <div className="p-4 space-y-3 border-b border-app-border">
            {/* To Field */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium w-12 text-app-text-secondary">To:</label>
              <input
                ref={toInputRef}
                type="text"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Recipients (comma-separated)"
                className="flex-1 px-2 py-1 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-app-accent/50"
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setShowCc(!showCc)}
                  className={`text-xs px-2 py-1 rounded hover:bg-app-panel-secondary ${showCc ? 'text-app-accent' : 'text-app-text-secondary'}`}
                >
                  Cc
                </button>
                <button
                  onClick={() => setShowBcc(!showBcc)}
                  className={`text-xs px-2 py-1 rounded hover:bg-app-panel-secondary ${showBcc ? 'text-app-accent' : 'text-app-text-secondary'}`}
                >
                  Bcc
                </button>
              </div>
            </div>

            {/* CC Field */}
            {showCc && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium w-12 text-app-text-secondary">Cc:</label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => {
                    setCc(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="CC recipients"
                  className="flex-1 px-2 py-1 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-app-accent/50"
                />
              </div>
            )}

            {/* BCC Field */}
            {showBcc && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium w-12 text-app-text-secondary">Bcc:</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => {
                    setBcc(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="BCC recipients"
                  className="flex-1 px-2 py-1 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-app-accent/50"
                />
              </div>
            )}

            {/* Subject Field */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium w-12 text-app-text-secondary">Subject:</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Email subject"
                className="flex-1 px-2 py-1 bg-app-bg border border-app-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-app-accent/50"
              />
            </div>
          </div>

          {/* Formatting Toolbar */}
          {isHtml && (
            <div className="flex items-center gap-1 p-2 border-b border-app-border bg-app-panel-secondary">
              <button
                onClick={() => insertFormatting('bold')}
                className="obsidian-button icon-only p-1"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertFormatting('italic')}
                className="obsidian-button icon-only p-1"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => insertFormatting('underline')}
                className="obsidian-button icon-only p-1"
                title="Underline"
              >
                <Underline className="w-4 h-4" />
              </button>
              
              <div className="w-px h-4 bg-app-border mx-1" />
              
              <button
                className="obsidian-button icon-only p-1"
                title="Insert Link"
              >
                <Link className="w-4 h-4" />
              </button>
              <button
                className="obsidian-button icon-only p-1"
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              
              <div className="flex-1" />
              
              <button
                onClick={() => setIsHtml(!isHtml)}
                className={`text-xs px-2 py-1 rounded ${isHtml ? 'bg-app-accent text-app-accent-fg' : 'text-app-text-secondary hover:bg-app-panel'}`}
                title="Toggle HTML/Plain text"
              >
                <Type className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 p-4">
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Write your email..."
              className="w-full h-full resize-none bg-app-bg border border-app-border rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-app-accent/50"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t border-app-border bg-app-panel-secondary rounded-b-lg">
            <div className="flex items-center gap-2">
              <button
                onClick={handleAttachment}
                className="obsidian-button icon-only"
                title="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              
              <button
                onClick={saveDraft}
                disabled={!isDirty}
                className="obsidian-button icon-only"
                title="Save draft"
              >
                <Save className="w-4 h-4" />
              </button>

              {attachments.length > 0 && (
                <span className="text-xs text-app-text-secondary">
                  {attachments.length} attachment{attachments.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="obsidian-button text-sm px-3"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={loading || !to.trim()}
                className="obsidian-button text-sm px-4 bg-app-accent text-app-accent-fg hover:bg-app-accent-hover disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Send
                  </div>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}