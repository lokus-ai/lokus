# Time Tracking Plugin for Lokus

## Plugin Overview
A comprehensive time tracking plugin that monitors time spent on notes and projects within Lokus, providing productivity insights and detailed analytics.

## Plugin Manifest Structure
```json
{
  "id": "lokus-time-tracker",
  "name": "Time Tracker",
  "version": "1.0.0",
  "description": "Track time spent on notes and projects with detailed analytics",
  "author": "Lokus Community",
  "enabled": true,
  "permissions": [
    "file-system",
    "editor-extensions", 
    "storage",
    "notifications"
  ],
  "settings": {
    "autoStart": true,
    "reminderInterval": 30,
    "trackIdleTime": false,
    "showNotifications": true,
    "dailyGoal": 480
  },
  "ui": {
    "panels": [
      {
        "id": "time-tracker-panel",
        "title": "Time Tracker",
        "type": "react-component",
        "component": "TimeTrackerPanel"
      }
    ],
    "statusBar": {
      "component": "TimeTrackerStatus"
    }
  }
}
```

## Core Features

### 1. Timer Management
- **Auto-start**: Automatically start timer when opening a note
- **Manual control**: Play/pause buttons in status bar
- **Session tracking**: Track individual work sessions
- **Idle detection**: Pause timer when inactive (configurable)

### 2. Time Analytics
- **Daily summaries**: Time spent per day
- **Note-level tracking**: Time per individual note
- **Project categorization**: Group notes into projects
- **Weekly/monthly reports**: Comprehensive time analysis
- **Export functionality**: CSV/JSON exports

### 3. UI Components

#### Status Bar Widget
```jsx
// Shows current timer status
<TimeTrackerStatus>
  ⏱️ 2h 15m | Project: Writing
  [▶️] [⏸️] [⏹️]
</TimeTrackerStatus>
```

#### Main Panel
- Current session timer (large display)
- Today's total time
- Quick project selection
- Recent sessions list
- Settings access

#### Analytics Dashboard
- Time distribution charts
- Productivity trends
- Goal progress tracking
- Session history

### 4. Data Structure
```javascript
// Session data
{
  id: "session-uuid",
  noteId: "note-path-or-id",
  projectId: "project-id",
  startTime: "2024-01-15T09:00:00Z",
  endTime: "2024-01-15T10:30:00Z", 
  duration: 5400, // seconds
  isActive: false,
  tags: ["writing", "research"]
}

// Project data
{
  id: "project-uuid",
  name: "Blog Writing",
  color: "#3B82F6",
  notePatterns: ["blog/**", "articles/**"],
  totalTime: 86400,
  lastActive: "2024-01-15T10:30:00Z"
}
```

## API Hooks Available in Lokus

### Editor Hooks
- `onEditorFocus`: Start timer when editor gains focus
- `onEditorBlur`: Pause timer when editor loses focus
- `onNoteOpen`: Start new session for opened note
- `onNoteClose`: End current session

### Storage Hooks
- `saveTimeData(data)`: Persist time tracking data
- `loadTimeData()`: Load existing time data
- `exportTimeData(format)`: Export data in various formats

### Notification Hooks
- `showNotification(message)`: Display system notifications
- `scheduleReminder(interval)`: Set up periodic reminders

## Development Structure

### File Organization
```
lokus-time-tracker/
├── package.json
├── manifest.json
├── src/
│   ├── components/
│   │   ├── TimeTrackerPanel.jsx
│   │   ├── TimeTrackerStatus.jsx
│   │   ├── AnalyticsDashboard.jsx
│   │   └── SettingsPanel.jsx
│   ├── hooks/
│   │   ├── useTimeTracker.js
│   │   ├── useAnalytics.js
│   │   └── useProjects.js
│   ├── utils/
│   │   ├── timeFormatting.js
│   │   ├── dataExport.js
│   │   └── storage.js
│   └── index.js
├── styles/
│   └── time-tracker.css
└── assets/
    └── icons/
```

### Key Component Structure

#### TimeTrackerPanel.jsx
```jsx
import { useState, useEffect } from 'react';
import { useTimeTracker } from '../hooks/useTimeTracker';

export function TimeTrackerPanel() {
  const {
    currentSession,
    isActive,
    todayTotal,
    startTimer,
    pauseTimer,
    stopTimer
  } = useTimeTracker();

  return (
    <div className="time-tracker-panel">
      {/* Current session display */}
      <div className="current-session">
        <div className="timer-display">
          {formatTime(currentSession?.duration || 0)}
        </div>
        <div className="controls">
          <button onClick={startTimer}>▶️</button>
          <button onClick={pauseTimer}>⏸️</button>
          <button onClick={stopTimer}>⏹️</button>
        </div>
      </div>
      
      {/* Today's summary */}
      <div className="daily-summary">
        <span>Today: {formatTime(todayTotal)}</span>
      </div>
      
      {/* Recent sessions */}
      <div className="recent-sessions">
        {/* Session list */}
      </div>
    </div>
  );
}
```

## Plugin Installation via lokus-plugin CLI

### 1. Create Plugin
```bash
# Create new plugin from basic template
lokus-plugin create lokus-time-tracker --template basic

# Or with TypeScript
lokus-plugin create lokus-time-tracker --template basic --typescript
```

### 2. Development Commands
```bash
cd lokus-time-tracker
npm install
npm run dev    # Development mode
npm run build  # Build for production
npm run test   # Run tests
```

### 3. Plugin Structure Generated
The CLI will generate a basic structure that needs to be customized for time tracking functionality.

## Integration Points with Lokus

### 1. Editor Integration
- Hook into TipTap editor events
- Track active document changes
- Monitor typing activity for idle detection

### 2. File System Integration
- Monitor file opens/closes
- Track workspace changes
- Detect project structure

### 3. UI Integration
- Status bar widget integration
- Sidebar panel registration
- Settings page integration

## Publishing Workflow

### 1. Development
- Build and test plugin locally
- Validate manifest with `lokus-plugin validate`
- Test integration with Lokus

### 2. Publishing
- Publish to npm registry
- Update Lokus marketplace integration
- Provide installation instructions

### 3. Distribution
- Plugin available via Extensions panel
- One-click install from marketplace
- Automatic updates via npm

## Settings Configuration

### User Settings
- Timer auto-start behavior
- Idle timeout duration
- Notification preferences
- Daily/weekly goals
- Project categorization rules

### Privacy Considerations
- All data stored locally
- Optional cloud sync
- Data export capabilities
- No tracking of note content

## Future Enhancements
- Integration with calendar apps
- Team time tracking features
- Advanced reporting dashboard
- Time blocking recommendations
- Integration with task management tools

---

This document provides the foundation for developing a comprehensive time tracking plugin for Lokus using the existing plugin architecture and CLI tools.