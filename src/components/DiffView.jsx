import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parseDiff, Diff, Hunk } from "react-diff-view";
import { diffLines, formatLines } from "unidiff";
import "react-diff-view/style/index.css";
import { X, GitCompare, Maximize2, Minimize2 } from "lucide-react";

const DiffView = ({ workspacePath, filePath, version1, version2, onClose }) => {
  const [diffContent, setDiffContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewType, setViewType] = useState("split"); // 'split' or 'unified'
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (workspacePath && filePath && version1 && version2) {
      loadDiff();
    }
  }, [workspacePath, filePath, version1, version2]);

  const loadDiff = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get content for both versions
      const content1 = await invoke("get_version_content", {
        workspacePath,
        filePath,
        timestamp: version1.timestamp,
      });

      const content2 = await invoke("get_version_content", {
        workspacePath,
        filePath,
        timestamp: version2.timestamp,
      });

      // Generate unified diff format
      const fileName = filePath?.split("/").pop() || "file";
      const diffText = formatLines(diffLines(content1, content2), {
        context: 3,
      });

      // Parse diff for react-diff-view
      const files = parseDiff(diffText);

      setDiffContent({
        files,
        oldContent: content1,
        newContent: content2,
      });
    } catch (error) {
      setError(error.toString());
    } finally {
      setLoading(false);
    }
  };

  const renderFile = (file) => {
    return (
      <Diff
        key={file.oldPath}
        viewType={viewType}
        diffType={file.type}
        hunks={file.hunks || []}
        oldPath={file.oldPath}
        newPath={file.newPath}
      >
        {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
      </Diff>
    );
  };

  if (loading) {
    return (
      <div className="diff-view loading">
        <div className="spinner" />
        <span>Loading diff...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="diff-view error">
        <p>Failed to load diff</p>
        <span>{error}</span>
      </div>
    );
  }

  if (!diffContent || !diffContent.files || diffContent.files.length === 0) {
    return (
      <div className="diff-view empty">
        <GitCompare size={32} />
        <p>No changes detected</p>
        <span>The two versions are identical</span>
      </div>
    );
  }

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className={`diff-view ${isFullscreen ? "fullscreen" : ""}`}>
      <div className="diff-view-header">
        <div className="diff-view-title">
          <GitCompare size={16} />
          <span>Comparing Versions</span>
        </div>

        <div className="diff-view-controls">
          <div className="view-type-toggle">
            <button
              className={viewType === "split" ? "active" : ""}
              onClick={() => setViewType("split")}
              title="Split view"
            >
              Split
            </button>
            <button
              className={viewType === "unified" ? "active" : ""}
              onClick={() => setViewType("unified")}
              title="Unified view"
            >
              Unified
            </button>
          </div>

          <button
            className="icon-button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {onClose && (
            <button className="icon-button" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="diff-view-info">
        <div className="version-info old">
          <span className="label">Old:</span>
          <span className="timestamp">{formatTimestamp(version1.timestamp)}</span>
          <span className="meta">
            {version1.lines} lines, {(version1.size / 1024).toFixed(1)} KB
          </span>
        </div>
        <div className="version-divider">→</div>
        <div className="version-info new">
          <span className="label">New:</span>
          <span className="timestamp">{formatTimestamp(version2.timestamp)}</span>
          <span className="meta">
            {version2.lines} lines, {(version2.size / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>

      <div className="diff-view-content">
        {diffContent.files.map(renderFile)}
      </div>
    </div>
  );
};

export default DiffView;
