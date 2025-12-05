# Gmail Components for Lokus

This directory contains comprehensive Gmail UI components that integrate seamlessly with the existing Lokus interface. The components provide a professional email experience with full Gmail functionality.

## Components Overview

### 1. Gmail Main View (`/src/views/Gmail.jsx`)
The main Gmail interface that orchestrates all other components.

**Features:**
- Authentication flow integration
- Main layout with sidebar, email list, and viewer
- Search functionality
- Bulk email operations
- Email composition integration
- Real-time status updates

**Key Props:**
- Handles authentication state automatically
- Manages email data and state
- Provides navigation between different email views

### 2. Gmail Sidebar (`GmailSidebar.jsx`)
Navigation sidebar with labels, folders, and user information.

**Features:**
- System labels (Inbox, Sent, Drafts, etc.) with unread counts
- Custom labels support
- Compose button
- Storage usage indicator
- User profile display
- Collapsible custom labels section

**Props:**
- `currentView` - Currently selected label/folder
- `onViewChange` - Callback when user selects different view
- `onCompose` - Callback for compose button
- `userProfile` - User profile information

### 3. Gmail Login (`GmailLogin.jsx`)
OAuth authentication interface with deep link support.

**Features:**
- Secure OAuth 2.0 flow
- Deep link callback handling
- Multiple authentication states (loading, waiting, success, error)
- Privacy information display
- Error handling with retry functionality

**Props:**
- `onLoginSuccess` - Callback when authentication succeeds

### 4. Email List (`EmailList.jsx`)
Displays emails in a scrollable list with selection capabilities.

**Features:**
- Email previews with sender, subject, snippet, and date
- Read/unread status indicators
- Star indicators
- Attachment indicators
- Bulk selection with checkboxes
- Select all functionality
- Empty state handling
- Loading states
- Responsive date formatting

**Props:**
- `emails` - Array of email objects
- `selectedEmail` - Currently selected email
- `selectedEmails` - Set of selected email IDs
- `onEmailSelect` - Callback when email is clicked
- `onEmailsSelect` - Callback for bulk selection
- `onCompose` - Callback for compose actions
- `refreshing` - Loading state indicator
- `currentView` - Current folder/label view

### 5. Email Viewer (`EmailViewer.jsx`)
Full email content display with rich formatting support.

**Features:**
- HTML and plain text email rendering
- Email headers (from, to, cc, bcc, date)
- Attachment display and download
- Reply/Reply All/Forward actions
- Star/Archive/Delete actions
- Expandable headers for technical details
- Content type toggle (HTML/Plain text)
- Safe HTML rendering in isolated container

**Props:**
- `email` - Email object to display
- `onCompose` - Callback for reply/forward actions
- `onRefresh` - Callback to refresh email list

### 6. Email Composer (`EmailComposer.jsx`)
Rich email composition interface with multiple modes.

**Features:**
- New email composition
- Reply/Reply All/Forward modes
- Rich text formatting toolbar
- Auto-quote original content for replies
- CC/BCC fields (show/hide)
- Auto-save drafts
- Attachment support (placeholder)
- Resizable window (minimize/maximize)
- Send/Save draft actions
- HTML/Plain text toggle

**Props:**
- `mode` - Composition mode ('new', 'reply', 'replyAll', 'forward')
- `replyToEmail` - Original email for replies/forwards
- `onClose` - Callback when composer is closed
- `onSend` - Callback when email is sent

## Integration with Lokus

### Styling Consistency
All components use Lokus's existing CSS custom properties and styling patterns:
- `bg-app-bg`, `bg-app-panel` for backgrounds
- `text-app-text`, `text-app-text-secondary` for text colors
- `border-app-border` for borders
- `obsidian-button` for consistent button styling
- Responsive design matching Lokus patterns

### Component Architecture
- Follow Lokus's React component patterns
- Use existing UI components from `src/components/ui/`
- Integrate with Lokus's theme system
- Consistent icon usage with Lucide React

### Backend Integration
Components integrate with the Gmail service layer:
- `src/services/gmail.js` - Main service interface
- Tauri commands for Gmail API operations
- OAuth authentication flow
- Email operations (read, send, delete, etc.)

## Usage Example

```jsx
import { Gmail } from './components/gmail';

function App() {
  return (
    <div className="h-screen">
      <Gmail />
    </div>
  );
}
```

Or individual components:

```jsx
import { 
  GmailSidebar, 
  EmailList, 
  EmailViewer, 
  EmailComposer 
} from './components/gmail';

function CustomGmailLayout() {
  // Your custom implementation
}
```

## Dependencies

### Required
- React with hooks
- Lucide React (icons)
- Tauri API (@tauri-apps/api)
- Gmail service layer (src/services/gmail.js)

### Utilities
- Date formatting utilities (src/utils/dateUtils.js)
- Existing Lokus UI components
- Lokus theme system

## Keyboard Shortcuts

The components support various keyboard shortcuts for efficient email management:
- `C` - Compose new email
- `R` - Reply to selected email
- `A` - Reply all to selected email
- `F` - Forward selected email
- `E` - Archive selected email
- `#` / `Delete` - Delete selected email
- `S` - Star/unstar selected email
- `Escape` - Close composer

## Accessibility

- Full keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management
- ARIA labels for interactive elements

## Performance Considerations

- Lazy loading for large email lists
- Debounced search functionality
- Efficient re-renders with proper memoization
- Virtual scrolling for large datasets (can be added)
- Image lazy loading in email content

## Security

- Safe HTML rendering with content isolation
- XSS prevention in email content
- Secure OAuth implementation
- No sensitive data in local storage
- Content Security Policy compliance

## Browser Compatibility

Supports all modern browsers through Tauri's webview:
- Chrome/Chromium-based browsers
- Safari (macOS)
- Edge (Windows)
- Firefox (limited Tauri support)