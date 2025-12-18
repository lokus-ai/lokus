import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useServiceStatus } from '../contexts/RemoteConfigContext';

/**
 * ServiceStatus - Displays maintenance mode and service status banners
 *
 * Server config example:
 * {
 *   "service_status": {
 *     "sync": { "status": "operational", "message": null },
 *     "registry": { "status": "degraded", "message": "Slow responses expected" },
 *     "maintenance": {
 *       "active": true,
 *       "message": "Scheduled maintenance in progress",
 *       "end_time": "2025-01-15T10:00:00Z"
 *     }
 *   }
 * }
 */
const ServiceStatus = () => {
  const serviceStatus = useServiceStatus();
  const [dismissed, setDismissed] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  const { maintenance, sync, registry } = serviceStatus;

  // Calculate time remaining for maintenance
  useEffect(() => {
    if (!maintenance?.active || !maintenance?.end_time) {
      setTimeRemaining(null);
      return;
    }

    const updateTimeRemaining = () => {
      const endTime = new Date(maintenance.end_time).getTime();
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeRemaining(null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m remaining`);
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m remaining`);
      } else {
        setTimeRemaining('Ending soon');
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [maintenance?.active, maintenance?.end_time]);

  // Reset dismissed state when maintenance status changes
  useEffect(() => {
    setDismissed(false);
  }, [maintenance?.active, maintenance?.message]);

  // Check for degraded services
  const degradedServices = [];
  if (sync?.status === 'degraded' || sync?.status === 'down') {
    degradedServices.push({ name: 'Sync', ...sync });
  }
  if (registry?.status === 'degraded' || registry?.status === 'down') {
    degradedServices.push({ name: 'Plugin Registry', ...registry });
  }

  // Don't show if dismissed or nothing to show
  if (dismissed) return null;
  if (!maintenance?.active && degradedServices.length === 0) return null;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'down':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20">
      {/* Maintenance Banner */}
      {maintenance?.active && (
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <span className="text-sm text-yellow-600 dark:text-yellow-400">
              {maintenance.message || 'Scheduled maintenance in progress'}
            </span>
            {timeRemaining && (
              <span className="text-xs text-yellow-500/70 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeRemaining}
              </span>
            )}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-yellow-500/20 text-yellow-500/70 hover:text-yellow-500"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Degraded Services */}
      {degradedServices.length > 0 && !maintenance?.active && (
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {degradedServices.map((service) => (
              <div key={service.name} className="flex items-center gap-2">
                {getStatusIcon(service.status)}
                <span className="text-sm text-app-muted">
                  {service.name}: {service.status === 'down' ? 'Unavailable' : 'Degraded'}
                  {service.message && ` - ${service.message}`}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-app-hover text-app-muted hover:text-app-text"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceStatus;
