import React from 'react';
import './MediaTimeline.css';

const MediaTimeline = ({ files, onSelect }) => {
  // Group files by date
  const timelineData = React.useMemo(() => {
    const groups = {};

    files.forEach(file => {
      const date = new Date(file.metadata?.modified_at || file.modified);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(file);
    });

    return Object.entries(groups).sort((a, b) =>
      new Date(b[0]) - new Date(a[0])
    );
  }, [files]);

  return (
    <div className="media-timeline">
      {timelineData.map(([monthYear, monthFiles]) => (
        <div key={monthYear} className="timeline-section">
          <h3 className="timeline-header">{monthYear}</h3>
          <div className="timeline-items">
            {monthFiles.map(file => (
              <div
                key={file.path}
                className="timeline-item"
                onClick={() => onSelect(file)}
              >
                <span className="item-name">{file.name}</span>
                <span className="item-type">{file.mediaType}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MediaTimeline;