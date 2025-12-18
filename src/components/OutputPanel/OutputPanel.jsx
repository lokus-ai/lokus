import React, { useState, useEffect, useRef } from 'react';
import outputChannelManager from '../../plugins/managers/OutputChannelManager.js';
import './OutputPanel.css';

export function OutputPanel({ isOpen, onClose }) {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState('');
  const [content, setContent] = useState('');
  const outputRef = useRef(null);

  useEffect(() => {
    // Load channels
    const loadChannels = () => {
      const allChannels = outputChannelManager.getChannels();
      setChannels(allChannels);

      const active = outputChannelManager.getActiveChannel();
      if (active && !activeChannel) {
        setActiveChannel(active.name);
      }
    };

    loadChannels();

    // Subscribe to events
    const handleChannelCreated = loadChannels;
    const handleChannelDisposed = loadChannels;
    const handleChannelUpdated = ({ name }) => {
      if (name === activeChannel) {
        setContent(outputChannelManager.getChannelOutput(name));
      }
    };

    outputChannelManager.on('channel-created', handleChannelCreated);
    outputChannelManager.on('channel-disposed', handleChannelDisposed);
    outputChannelManager.on('channel-updated', handleChannelUpdated);

    return () => {
      outputChannelManager.off('channel-created', handleChannelCreated);
      outputChannelManager.off('channel-disposed', handleChannelDisposed);
      outputChannelManager.off('channel-updated', handleChannelUpdated);
    };
  }, [activeChannel]);

  // Update content when channel changes
  useEffect(() => {
    if (activeChannel) {
      setContent(outputChannelManager.getChannelOutput(activeChannel));
    }
  }, [activeChannel]);

  // Auto-scroll to bottom on content update
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]);

  const handleClear = () => {
    if (activeChannel) {
      outputChannelManager.clear(activeChannel);
      setContent('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="output-panel">
      <div className="output-panel-header">
        <select
          value={activeChannel}
          onChange={e => setActiveChannel(e.target.value)}
          className="output-channel-select"
        >
          <option value="">Select channel...</option>
          {channels.map(ch => (
            <option key={ch.name} value={ch.name}>{ch.name}</option>
          ))}
        </select>
        <button onClick={handleClear} className="output-clear" disabled={!activeChannel}>
          Clear
        </button>
        <button onClick={onClose} className="output-close">×</button>
      </div>

      <div className="output-content" ref={outputRef}>
        {content ? (
          <pre className="output-text">{content}</pre>
        ) : (
          <span className="output-empty">No output</span>
        )}
      </div>
    </div>
  );
}

export default OutputPanel;
