import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus } from 'lucide-react';

const DropZoneOverlay = ({ activeZone, panes }) => {
  const dropZones = [
    { id: 'split-left', zone: 'left', icon: ChevronLeft, label: 'Split Left' },
    { id: 'split-right', zone: 'right', icon: ChevronRight, label: 'Split Right' },
    { id: 'split-top', zone: 'top', icon: ChevronUp, label: 'Split Top' },
    { id: 'split-bottom', zone: 'bottom', icon: ChevronDown, label: 'Split Bottom' },
    { id: 'split-center', zone: 'center', icon: Plus, label: 'Replace' }
  ];

  return (
    <div className="drop-zone-overlay">
      {dropZones.map(({ id, zone, icon: Icon, label }) => (
        <DropZone
          key={id}
          id={id}
          zone={zone}
          isActive={activeZone === zone}
          icon={Icon}
          label={label}
        />
      ))}
    </div>
  );
};

const DropZone = ({ id, zone, isActive, icon: Icon, label }) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'split-zone', zone }
  });

  const getZoneStyle = () => {
    const baseStyle = {
      position: 'absolute',
      pointerEvents: 'auto',
      zIndex: 1000,
      transition: 'all 0.2s ease',
    };

    const activeStyle = {
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      border: '2px dashed rgb(59, 130, 246)',
      borderRadius: '8px',
    };

    const hoverStyle = {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: 'rgb(37, 99, 235)',
      transform: 'scale(1.02)',
    };

    switch (zone) {
      case 'left':
        return {
          ...baseStyle,
          left: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '120px',
          height: '80px',
          ...(isActive && activeStyle),
          ...(isOver && hoverStyle),
        };
      case 'right':
        return {
          ...baseStyle,
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '120px',
          height: '80px',
          ...(isActive && activeStyle),
          ...(isOver && hoverStyle),
        };
      case 'top':
        return {
          ...baseStyle,
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80px',
          height: '120px',
          ...(isActive && activeStyle),
          ...(isOver && hoverStyle),
        };
      case 'bottom':
        return {
          ...baseStyle,
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80px',
          height: '120px',
          ...(isActive && activeStyle),
          ...(isOver && hoverStyle),
        };
      case 'center':
        return {
          ...baseStyle,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          ...(isActive && activeStyle),
          ...(isOver && hoverStyle),
        };
      default:
        return baseStyle;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={getZoneStyle()}
      className="drop-zone-item"
    >
      <div className="drop-zone-content">
        <Icon 
          className={`drop-zone-icon ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
          size={zone === 'center' ? 32 : 24}
        />
        <span className={`drop-zone-label ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
          {label}
        </span>
      </div>
    </div>
  );
};

export default DropZoneOverlay;