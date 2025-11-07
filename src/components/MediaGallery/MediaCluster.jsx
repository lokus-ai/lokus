import React from 'react';
import './MediaCluster.css';

const MediaCluster = ({ files, onSelect }) => {
  // Placeholder clustering - in production, this would use semantic similarity
  const clusters = React.useMemo(() => {
    const typeGroups = {};

    files.forEach(file => {
      const type = file.mediaType || 'Unknown';
      if (!typeGroups[type]) {
        typeGroups[type] = {
          label: type,
          items: []
        };
      }
      typeGroups[type].items.push(file);
    });

    return Object.values(typeGroups);
  }, [files]);

  return (
    <div className="media-cluster">
      {clusters.map(cluster => (
        <div key={cluster.label} className="cluster-group">
          <h3 className="cluster-title">{cluster.label}</h3>
          <div className="cluster-items">
            {cluster.items.map(file => (
              <div
                key={file.path}
                className="cluster-item"
                onClick={() => onSelect(file)}
              >
                <span className="item-name">{file.name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MediaCluster;