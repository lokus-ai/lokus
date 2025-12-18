# Output Panel Component

A UI panel for displaying plugin output channels. The panel integrates with the `OutputChannelManager` backend to provide a live view of plugin output.

## Features

- **Channel Selection**: Dropdown to switch between available output channels
- **Live Updates**: Automatically updates when plugins write to channels
- **Auto-scroll**: Scrolls to bottom when new content is added
- **Clear Button**: Clear channel content
- **Theme Aware**: Supports light and dark themes
- **Monospace Display**: Uses monospace font for proper code/log formatting

## Usage

### Basic Integration

```jsx
import { useState } from 'react';
import OutputPanel from './components/OutputPanel/OutputPanel';

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <div className="app">
      <button onClick={() => setIsPanelOpen(true)}>
        Show Output
      </button>

      <OutputPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  );
}
```

### Using the Hook

```jsx
import { useOutputChannels } from '../hooks/useOutputChannels';

function MyComponent() {
  const {
    channels,
    activeChannel,
    getChannelOutput,
    clearChannel,
    showChannel
  } = useOutputChannels();

  return (
    <div>
      <h3>Active Channel: {activeChannel?.name || 'None'}</h3>
      <p>Total Channels: {channels.length}</p>

      <button onClick={() => showChannel('My Plugin')}>
        Show My Plugin Output
      </button>

      <button onClick={() => clearChannel('My Plugin')}>
        Clear Output
      </button>
    </div>
  );
}
```

## Props

### OutputPanel

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | Yes | Whether the panel is visible |
| `onClose` | `function` | Yes | Callback when close button is clicked |

## Hook API

### useOutputChannels()

Returns an object with:

- `channels` (Array): All available output channels
- `activeChannel` (Object|null): Currently active channel
- `getChannelOutput(name)`: Get output text for a channel
- `clearChannel(name)`: Clear a channel's content
- `showChannel(name, preserveFocus)`: Show/activate a channel

## Styling

The component uses CSS custom properties from the global theme system:

- `--bg`: Background color
- `--panel`: Panel background
- `--border`: Border color
- `--text`: Text color
- `--font-mono`: Monospace font family
- `--radius`: Border radius

## Events

The component listens to these OutputChannelManager events:

- `channel-created`: When a new channel is created
- `channel-disposed`: When a channel is removed
- `channel-updated`: When channel content changes

## Example: Plugin Output

```js
// In your plugin
const channel = lokus.output.createOutputChannel('My Plugin');

channel.appendLine('Plugin initialized');
channel.appendLine('Processing file...');
channel.appendLine('Done!');

channel.show(); // Show the output panel
```

The Output Panel will automatically display this content when the channel is selected.
