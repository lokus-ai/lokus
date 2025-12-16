import React from 'react';
import { Laptop, Wifi, WifiOff, Radio } from 'lucide-react';

export default function PeerList({ peers }) {
  if (!peers || peers.length === 0) {
    return (
      <div className="text-center py-8 text-app-muted">
        <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No peers connected</p>
        <p className="text-xs mt-1">
          Other devices will appear here when they connect to the same document
        </p>
      </div>
    );
  }

  const getConnectionTypeBadge = (addresses) => {
    if (!addresses || addresses.length === 0) {
      return { label: 'Unknown', color: 'bg-gray-500/20 text-gray-500', icon: Wifi };
    }

    // Check if any address is a direct connection (local network)
    const hasDirectConnection = addresses.some(addr =>
      addr.includes('192.168.') ||
      addr.includes('10.') ||
      addr.includes('172.') ||
      addr.includes('[::1]') ||
      addr.includes('127.0.0.1')
    );

    if (hasDirectConnection) {
      return { label: 'Direct', color: 'bg-green-500/20 text-green-500', icon: Wifi };
    }

    // Otherwise, it's using relay
    return { label: 'Relay', color: 'bg-blue-500/20 text-blue-500', icon: Radio };
  };

  const getDeviceName = (nodeId) => {
    // Truncate node ID for display
    return `Device ${nodeId.substring(0, 8)}`;
  };

  return (
    <div className="space-y-2">
      {peers.map((peer, index) => {
        const connectionBadge = getConnectionTypeBadge(peer.addresses);
        const ConnectionIcon = connectionBadge.icon;
        const deviceName = getDeviceName(peer.node_id);

        return (
          <div
            key={peer.node_id || index}
            className="flex items-center justify-between p-3 bg-app-bg rounded-lg border border-app-border hover:border-app-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              {/* Device Icon */}
              <div className="w-8 h-8 flex items-center justify-center bg-app-accent/10 rounded-full">
                <Laptop className="w-4 h-4 text-app-accent" />
              </div>

              {/* Device Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-app-text truncate">
                  {deviceName}
                </div>
                <div className="text-xs text-app-muted font-mono truncate" title={peer.node_id}>
                  {peer.node_id}
                </div>
                {peer.addresses && peer.addresses.length > 0 && (
                  <div className="text-xs text-app-muted mt-0.5">
                    {peer.addresses.length} {peer.addresses.length === 1 ? 'address' : 'addresses'}
                  </div>
                )}
              </div>
            </div>

            {/* Connection Type Badge */}
            <div className="flex items-center gap-2">
              {/* Status Indicator */}
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${peer.connected ? 'bg-green-500' : 'bg-gray-500'}`} />
              </div>

              {/* Connection Badge */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${connectionBadge.color} text-xs font-medium`}>
                <ConnectionIcon className="w-3 h-3" />
                {connectionBadge.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
