import { useState, useEffect } from 'react';
import outputChannelManager from '../plugins/managers/OutputChannelManager.js';

/**
 * Hook to access output channel state and operations
 * @returns {Object} Output channel state and methods
 */
export function useOutputChannels() {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);

  useEffect(() => {
    // Load initial state
    const loadState = () => {
      const allChannels = outputChannelManager.getChannels();
      setChannels(allChannels);

      const active = outputChannelManager.getActiveChannel();
      setActiveChannel(active);
    };

    loadState();

    // Subscribe to events
    const handleChannelCreated = () => {
      setChannels(outputChannelManager.getChannels());
    };

    const handleChannelDisposed = () => {
      setChannels(outputChannelManager.getChannels());
      setActiveChannel(outputChannelManager.getActiveChannel());
    };

    const handleChannelShown = () => {
      setActiveChannel(outputChannelManager.getActiveChannel());
    };

    outputChannelManager.on('channel-created', handleChannelCreated);
    outputChannelManager.on('channel-disposed', handleChannelDisposed);
    outputChannelManager.on('channel-shown', handleChannelShown);

    return () => {
      outputChannelManager.off('channel-created', handleChannelCreated);
      outputChannelManager.off('channel-disposed', handleChannelDisposed);
      outputChannelManager.off('channel-shown', handleChannelShown);
    };
  }, []);

  /**
   * Get output content for a specific channel
   * @param {string} channelName - Channel name
   * @returns {string} Channel output
   */
  const getChannelOutput = (channelName) => {
    return outputChannelManager.getChannelOutput(channelName);
  };

  /**
   * Clear a channel's content
   * @param {string} channelName - Channel name
   */
  const clearChannel = (channelName) => {
    outputChannelManager.clear(channelName);
  };

  /**
   * Show a specific channel
   * @param {string} channelName - Channel name
   * @param {boolean} preserveFocus - Whether to preserve focus
   */
  const showChannel = (channelName, preserveFocus = false) => {
    outputChannelManager.show(channelName, preserveFocus);
  };

  return {
    channels,
    activeChannel,
    getChannelOutput,
    clearChannel,
    showChannel
  };
}

export default useOutputChannels;
