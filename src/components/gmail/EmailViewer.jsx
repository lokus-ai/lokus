import { useState, useEffect, useRef } from 'react';
import { 
  Reply, 
  ReplyAll, 
  Forward, 
  Archive, 
  Trash2, 
  Star, 
  MoreHorizontal,
  Paperclip,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  Clock,
  FileText
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from '../../utils/dateUtils.js';
import { gmailEmails } from '../../services/gmail.js';
import { saveEmailAsNote } from '../../utils/emailToNote.js';

export default function EmailViewer({ email, onCompose, onRefresh, workspacePath }) {
  const [loading, setLoading] = useState(false);
  const [showAllHeaders, setShowAllHeaders] = useState(false);
  const [showHtmlContent, setShowHtmlContent] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [expandedAttachments, setExpandedAttachments] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (email) {
      loadEmailDetails();
    }
  }, [email]);

  const loadEmailDetails = async () => {
    if (!email) return;
    
    try {
      setLoading(true);
      
      // Load full email content if not already loaded
      if (!email.fullContent) {
        const fullEmail = await gmailEmails.getEmailById(email.id);
        // Update email object with full content
        Object.assign(email, fullEmail);
      }

      // Load attachments
      if (email.hasAttachments) {
        const emailAttachments = await gmailEmails.getEmailAttachments(email.id);
        setAttachments(emailAttachments);
      } else {
        setAttachments([]);
      }
      
    } catch { } finally {
      setLoading(false);
    }
  };

  const handleReply = () => {
    onCompose('reply', email);
  };

  const handleReplyAll = () => {
    onCompose('replyAll', email);
  };

  const handleForward = () => {
    onCompose('forward', email);
  };

  const handleArchive = async () => {
    try {
      await gmailEmails.archiveEmail(email.id);
      onRefresh();
    } catch { }
  };

  const handleDelete = async () => {
    try {
      await gmailEmails.deleteEmail(email.id);
      onRefresh();
    } catch { }
  };

  const handleStarToggle = async () => {
    try {
      if (email.isStarred) {
        await gmailEmails.unstarEmail(email.id);
      } else {
        await gmailEmails.starEmail(email.id);
      }
      email.isStarred = !email.isStarred;
      onRefresh();
    } catch { }
  };

  const handleSaveAsNote = async () => {
    if (!workspacePath) {
      return;
    }

    try {
      setSavingNote(true);
      
      const filePath = await saveEmailAsNote(email, workspacePath, {
        includeHeaders: true,
        includeThreadInfo: true,
        includeAttachments: true,
        subfolder: 'emails'
      });
      
      
      // Show success message (you could implement a toast notification here)
      const fileName = filePath.split('/').pop();
      alert(`Email saved as note: ${fileName}`);
      
    } catch (error) {
      alert(`Failed to save email as note: ${error.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  const downloadAttachment = async (attachment) => {
    try {
      await gmailEmails.downloadAttachment(email.id, attachment.id, attachment.filename);
    } catch { }
  };

  const formatEmailAddress = (address) => {
    if (!address) return '';
    if (address.name) {
      return `${address.name} <${address.email}>`;
    }
    return address.email;
  };

  const formatDate = (dateString) => {
    try {
      const date = parseISO(dateString);
      return format(date, 'PPP p'); // Full date and time
    } catch (error) {
      return 'Unknown date';
    }
  };

  const getContentHtml = () => {
    if (!email) return '';
    
    // Try HTML content first if available and preferred
    if (showHtmlContent && email.body_html) {
      return email.body_html;
    }
    
    // Fall back to plain text content
    if (email.body_text) {
      // Convert plain text to HTML, preserving line breaks
      return email.body_text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
    
    // Legacy fallback
    if (email.htmlContent) {
      return email.htmlContent;
    }
    
    if (email.textContent) {
      return email.textContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
    
    return email.content || email.snippet || 'No content available';
  };

  const AttachmentItem = ({ attachment }) => (
    <div className="flex items-center justify-between p-3 bg-app-panel-secondary rounded-lg">
      <div className="flex items-center gap-3">
        <Paperclip className="w-4 h-4 text-app-text-secondary" />
        <div>
          <p className="text-sm font-medium">{attachment.filename}</p>
          <p className="text-xs text-app-text-secondary">
            {attachment.mimeType} • {attachment.size ? `${Math.round(attachment.size / 1024)} KB` : 'Unknown size'}
          </p>
        </div>
      </div>
      <button
        onClick={() => downloadAttachment(attachment)}
        className="obsidian-button icon-only"
        title="Download attachment"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );

  if (!email) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-app-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-app-border bg-app-panel">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold truncate max-w-md">
            {email.subject || '(no subject)'}
          </h2>
          {email.hasAttachments && (
            <Paperclip className="w-4 h-4 text-app-text-secondary" />
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleReply}
            className="obsidian-button icon-only"
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>
          <button
            onClick={handleReplyAll}
            className="obsidian-button icon-only"
            title="Reply All"
          >
            <ReplyAll className="w-4 h-4" />
          </button>
          <button
            onClick={handleForward}
            className="obsidian-button icon-only"
            title="Forward"
          >
            <Forward className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-app-border mx-1" />
          
          <button
            onClick={handleStarToggle}
            className="obsidian-button icon-only"
            title={email.isStarred ? "Remove star" : "Add star"}
          >
            <Star 
              className={`w-4 h-4 ${
                email.isStarred 
                  ? 'text-yellow-400 fill-current' 
                  : 'text-app-text-secondary'
              }`} 
            />
          </button>
          <button
            onClick={handleArchive}
            className="obsidian-button icon-only"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="obsidian-button icon-only"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-app-border mx-1" />
          
          <button
            onClick={handleSaveAsNote}
            className="obsidian-button icon-only"
            title="Save as Note"
            disabled={savingNote || !workspacePath}
          >
            <FileText className={`w-4 h-4 ${savingNote ? 'animate-pulse' : ''}`} />
          </button>
          
          <button
            className="obsidian-button icon-only"
            title="More actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Email Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Email Headers */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-app-accent/10 text-app-accent rounded-full flex items-center justify-center font-medium">
                    {
                      Array.isArray(email.from) && email.from.length > 0
                        ? (email.from[0].name?.[0] || email.from[0].email?.[0] || '?')
                        : '?'
                    }
                  </div>
                  <div>
                    <p className="font-semibold">
                      {
                        Array.isArray(email.from) && email.from.length > 0
                          ? (email.from[0].name || email.from[0].email || 'Unknown Sender')
                          : 'Unknown Sender'
                      }
                    </p>
                    <p className="text-sm text-app-text-secondary">
                      {
                        Array.isArray(email.from) && email.from.length > 0
                          ? email.from[0].email
                          : ''
                      }
                    </p>
                  </div>
                </div>
                
                <div className="text-sm text-app-text-secondary space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">To:</span>
                    <span>{email.to?.map(formatEmailAddress).join(', ') || 'Unknown'}</span>
                  </div>
                  
                  {email.cc && email.cc.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">CC:</span>
                      <span>{email.cc.map(formatEmailAddress).join(', ')}</span>
                    </div>
                  )}
                  
                  {email.bcc && email.bcc.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">BCC:</span>
                      <span>{email.bcc.map(formatEmailAddress).join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-app-text-secondary text-right">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4" />
                  <span>{formatDate(email.date)}</span>
                </div>
                <button
                  onClick={() => setShowAllHeaders(!showAllHeaders)}
                  className="text-xs text-app-accent hover:underline flex items-center gap-1"
                >
                  {showAllHeaders ? (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Hide details
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      Show details
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Extended Headers */}
            {showAllHeaders && (
              <div className="bg-app-panel rounded-lg p-4 text-sm space-y-2">
                <div><strong>Message ID:</strong> {email.messageId || 'Unknown'}</div>
                <div><strong>Thread ID:</strong> {email.threadId || 'Unknown'}</div>
                {email.inReplyTo && (
                  <div><strong>In Reply To:</strong> {email.inReplyTo}</div>
                )}
                {email.references && (
                  <div><strong>References:</strong> {email.references}</div>
                )}
              </div>
            )}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setExpandedAttachments(!expandedAttachments)}
                className="flex items-center gap-2 text-sm font-medium text-app-text mb-3"
              >
                {expandedAttachments ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Paperclip className="w-4 h-4" />
                {attachments.length} {attachments.length === 1 ? 'attachment' : 'attachments'}
              </button>
              
              {expandedAttachments && (
                <div className="space-y-2">
                  {attachments.map((attachment, index) => (
                    <AttachmentItem key={index} attachment={attachment} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Content Type Toggle */}
          {(email.body_html || email.htmlContent) && (email.body_text || email.textContent) && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span>View:</span>
                <button
                  onClick={() => setShowHtmlContent(!showHtmlContent)}
                  className="obsidian-button text-xs flex items-center gap-1"
                >
                  {showHtmlContent ? (
                    <>
                      <Eye className="w-3 h-3" />
                      HTML
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3" />
                      Plain Text
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Email Body */}
          <div className="border border-app-border rounded-lg p-6 bg-app-panel text-app-text">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-app-text-secondary">Loading email content...</div>
              </div>
            ) : (
              <div 
                ref={contentRef}
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: getContentHtml() }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}