# Terminal Panel Component

A UI panel to display and interact with plugin terminals managed by the TerminalManager.

## Files Created

1. **TerminalPanel.jsx** - Main React component
2. **TerminalPanel.css** - Terminal styling (VS Code-like theme)
3. **useTerminals.js** - React hook for accessing terminal state

## Features

- **Tab Management**: Shows tabs for each terminal with close buttons
- **Terminal Switching**: Click tabs to switch between terminals
- **Output Display**: Monospace font display with syntax coloring for input/stdout/stderr
- **Text Input**: Send text to active terminal with Enter key support
- **Auto-scroll**: Automatically scrolls to bottom when new output arrives
- **Real-time Updates**: Subscribes to TerminalManager events for live updates
- **Empty States**: Shows helpful messages when no terminals exist

## Integration Example

```jsx
import React, { useState } from 'react';
import TerminalPanel from './components/TerminalPanel/TerminalPanel';

function YourComponent() {
  const [isTerminalOpen, setTerminalOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setTerminalOpen(!isTerminalOpen)}>
        Toggle Terminal
      </button>

      <TerminalPanel
        isOpen={isTerminalOpen}
        onClose={() => setTerminalOpen(false)}
      />
    </div>
  );
}
```

## Using the Hook

```jsx
import { useTerminals } from './hooks/useTerminals';

function MyComponent() {
  const {
    terminals,          // Array of all terminals
    activeTerminal,     // Currently active terminal
    sendText,          // Send text to terminal
    showTerminal,      // Show a terminal
    hideTerminal,      // Hide a terminal
    disposeTerminal,   // Close/dispose a terminal
    clearTerminal,     // Clear terminal output
    getTerminal,       // Get terminal by ID
  } = useTerminals();

  return (
    <div>
      <h2>Active Terminal: {activeTerminal?.name || 'None'}</h2>
      <p>Total Terminals: {terminals.length}</p>
    </div>
  );
}
```

## Terminal Manager Events

The component subscribes to these TerminalManager events:
- `terminal-created` - New terminal created
- `terminal-disposed` - Terminal closed
- `terminal-data` - Input text sent to terminal
- `terminal-output` - Output received from terminal
- `active-terminal-changed` - Active terminal changed
- `terminal-shown` - Terminal visibility changed
- `terminal-hidden` - Terminal hidden

## Output Line Types

The terminal displays three types of output with different colors:
- **input** - Blue (user input/commands)
- **stdout** - Default text color (standard output)
- **stderr** - Red/orange (error output)

## Styling

The component uses a VS Code-inspired dark theme with:
- Dark background (#1e1e1e)
- Monospace font (Consolas, Courier New)
- Tab-based navigation
- Auto-scrolling output area
- Responsive input field

Light theme support is included via media query for future use.

## Props

### TerminalPanel

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| isOpen | boolean | Yes | Whether the panel is visible |
| onClose | function | Yes | Callback when panel is closed |

## Success Criteria

- ✓ Panel renders when isOpen is true
- ✓ Shows all terminals from TerminalManager
- ✓ Can switch between terminals via tabs
- ✓ Shows terminal output with proper formatting
- ✓ Can send text to active terminal
- ✓ Updates in real-time when terminal events fire
- ✓ Can close individual terminals
- ✓ Can close entire panel
- ✓ Auto-scrolls to newest output
- ✓ Handles empty state gracefully

## Next Steps

To integrate into your app:
1. Import TerminalPanel in your main view component
2. Add state to control panel visibility
3. Add a button/shortcut to toggle the panel
4. Optionally integrate with status bar or command palette
