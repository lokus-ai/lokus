import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Clock, RotateCcw, FileText, ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const VersionHistoryPanel = ({ workspacePath, filePath, onClose, onSelectVersion, onRestore }) => {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set(["today"]));

  useEffect(() => {
    if (workspacePath && filePath) {
      loadVersions();
    }
  }, [workspacePath, filePath]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const result = await invoke("get_file_versions", {
        workspacePath,
        filePath,
      });
      setVersions(result || []);
    } catch { } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version) => {
    try {
      await invoke("restore_version", {
        workspacePath,
        filePath,
        timestamp: version.timestamp,
      });
      // Reload versions to show the new restore entry
      await loadVersions();
      // Reload the editor content with restored version
      if (onRestore) {
        await onRestore();
      }
      // Notify parent to refresh editor (legacy support)
      if (onSelectVersion) {
        onSelectVersion(null);
      }
    } catch { }
  };

  const handleViewDiff = (version) => {
    setSelectedVersion(version);
    if (onSelectVersion) {
      onSelectVersion(version);
    }
  };

  const groupVersionsByTime = (versions) => {
    const now = new Date();
    const groups = {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    };

    versions.forEach((version) => {
      const versionDate = new Date(version.timestamp);
      const diffDays = Math.floor((now - versionDate) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        groups.today.push(version);
      } else if (diffDays === 1) {
        groups.yesterday.push(version);
      } else if (diffDays <= 7) {
        groups.lastWeek.push(version);
      } else if (diffDays <= 30) {
        groups.lastMonth.push(version);
      } else {
        groups.older.push(version);
      }
    });

    return groups;
  };

  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const groupLabels = {
    today: "Today",
    yesterday: "Yesterday",
    lastWeek: "Last 7 days",
    lastMonth: "Last 30 days",
    older: "Older",
  };

  const groups = groupVersionsByTime(versions);

  return (
    <div className="version-history-panel">
      <div className="version-history-header">
        <div className="version-history-title">
          <Clock size={16} />
          <span>Version History</span>
        </div>
        {onClose && (
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      <div className="version-history-file-info">
        <FileText size={14} />
        <span className="file-name">{filePath?.split("/").pop() || "Unknown file"}</span>
      </div>

      {loading ? (
        <div className="version-history-loading">
          <div className="spinner" />
          <span>Loading versions...</span>
        </div>
      ) : versions.length === 0 ? (
        <div className="version-history-empty">
          <Calendar size={32} />
          <p>No version history yet</p>
          <span>Versions are saved automatically when you edit this file</span>
        </div>
      ) : (
        <div className="version-history-timeline">
          {Object.entries(groups).map(([groupKey, groupVersions]) => {
            if (groupVersions.length === 0) return null;

            const isExpanded = expandedGroups.has(groupKey);

            return (
              <div key={groupKey} className="version-group">
                <button
                  className="version-group-header"
                  onClick={() => toggleGroup(groupKey)}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="group-label">{groupLabels[groupKey]}</span>
                  <span className="group-count">{groupVersions.length}</span>
                </button>

                {isExpanded && (
                  <div className="version-group-content">
                    {groupVersions.map((version, index) => {
                      const isSelected = selectedVersion?.timestamp === version.timestamp;
                      const versionDate = new Date(version.timestamp);
                      const timeAgo = formatDistanceToNow(versionDate, { addSuffix: true });

                      return (
                        <div
                          key={version.timestamp}
                          className={`version-item ${isSelected ? "selected" : ""}`}
                        >
                          <div className="version-timeline-marker" />

                          <div className="version-content">
                            <div className="version-header">
                              <span className="version-time">{timeAgo}</span>
                              <span className="version-action">{version.action}</span>
                            </div>

                            <div className="version-details">
                              <span className="version-stat">
                                {version.lines} lines
                              </span>
                              <span className="version-stat">
                                {(version.size / 1024).toFixed(1)} KB
                              </span>
                            </div>

                            {version.preview && (
                              <div className="version-preview">{version.preview}</div>
                            )}

                            <div className="version-actions">
                              <button
                                className="version-action-button view"
                                onClick={() => handleViewDiff(version)}
                              >
                                <FileText size={14} />
                                View
                              </button>
                              <button
                                className="version-action-button restore"
                                onClick={() => handleRestore(version)}
                              >
                                <RotateCcw size={14} />
                                Restore
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VersionHistoryPanel;
