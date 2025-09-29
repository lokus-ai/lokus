/**
 * ForceControlsPanel - Obsidian-inspired force controls for graph visualization
 *
 * Features:
 * - Real-time force parameter adjustment with sliders
 * - Center force, repel force, link force, and link distance controls
 * - Visual feedback and smooth animations
 * - Preset configurations for quick adjustments
 * - Glassmorphism design matching app aesthetic
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  RotateCcw,
  Zap,
  ArrowLeftRight,
  Circle,
  Link2,
  Target,
  Minimize2,
  Maximize2,
  Play,
  Pause
} from 'lucide-react';

const ForceControlsPanel = ({
  onForceChange,
  onPresetSelect,
  isVisible = true,
  isAnimationRunning = false,
  onAnimationToggle,
  className = ''
}) => {
  // Force parameters with Obsidian-like ranges
  const [forces, setForces] = useState({
    centerForce: 300,      // 0-1000: Pull toward center
    repelForce: -400,      // -1000 to 0: Node repulsion (charge)
    linkForce: 1,          // 0-2: Connection strength
    linkDistance: 100,     // 20-500: Default link length
    collisionRadius: 8,    // 0-100: Minimum node spacing
    alphaDecay: 0.02,      // 0.001-0.1: Simulation decay rate
    velocityDecay: 0.3     // 0.1-0.9: Friction
  });

  const [isExpanded, setIsExpanded] = useState(true);
  const [activePreset, setActivePreset] = useState('default');

  // Preset configurations inspired by Obsidian
  const presets = {
    default: {
      centerForce: 300,
      repelForce: -400,
      linkForce: 1,
      linkDistance: 100,
      collisionRadius: 8,
      alphaDecay: 0.02,
      velocityDecay: 0.3
    },
    tight: {
      centerForce: 500,
      repelForce: -200,
      linkForce: 1.5,
      linkDistance: 60,
      collisionRadius: 5,
      alphaDecay: 0.03,
      velocityDecay: 0.4
    },
    spread: {
      centerForce: 100,
      repelForce: -800,
      linkForce: 0.5,
      linkDistance: 150,
      collisionRadius: 15,
      alphaDecay: 0.015,
      velocityDecay: 0.2
    },
    hierarchical: {
      centerForce: 400,
      repelForce: -300,
      linkForce: 1.2,
      linkDistance: 120,
      collisionRadius: 10,
      alphaDecay: 0.025,
      velocityDecay: 0.35
    },
    minimal: {
      centerForce: 200,
      repelForce: -600,
      linkForce: 0.8,
      linkDistance: 80,
      collisionRadius: 12,
      alphaDecay: 0.01,
      velocityDecay: 0.25
    }
  };

  // Handle force parameter changes with debouncing
  const handleForceChange = useCallback((parameter, value) => {
    const newForces = { ...forces, [parameter]: value };
    setForces(newForces);

    // Convert to d3ForceConfig format
    const d3Config = {
      charge: { strength: newForces.repelForce },
      link: {
        distance: newForces.linkDistance,
        strength: newForces.linkForce
      },
      center: { strength: newForces.centerForce / 1000 },
      collision: { radius: newForces.collisionRadius },
      alphaDecay: newForces.alphaDecay,
      velocityDecay: newForces.velocityDecay
    };

    onForceChange?.(d3Config);
    setActivePreset('custom');
  }, [forces, onForceChange]);

  // Apply preset configuration
  const applyPreset = useCallback((presetName) => {
    const preset = presets[presetName];
    if (!preset) return;

    setForces(preset);
    setActivePreset(presetName);

    // Convert to d3ForceConfig format
    const d3Config = {
      charge: { strength: preset.repelForce },
      link: {
        distance: preset.linkDistance,
        strength: preset.linkForce
      },
      center: { strength: preset.centerForce / 1000 },
      collision: { radius: preset.collisionRadius },
      alphaDecay: preset.alphaDecay,
      velocityDecay: preset.velocityDecay
    };

    onForceChange?.(d3Config);
    onPresetSelect?.(presetName, d3Config);
  }, [onForceChange, onPresetSelect]);

  // Reset to default
  const resetToDefault = useCallback(() => {
    applyPreset('default');
  }, [applyPreset]);

  // Force parameter definitions
  const forceParams = [
    {
      key: 'centerForce',
      label: 'Center Force',
      icon: Target,
      min: 0,
      max: 1000,
      step: 10,
      description: 'Pull strength toward center'
    },
    {
      key: 'repelForce',
      label: 'Repel Force',
      icon: Minimize2,
      min: -1000,
      max: 0,
      step: 10,
      description: 'Node repulsion strength'
    },
    {
      key: 'linkForce',
      label: 'Link Force',
      icon: Link2,
      min: 0,
      max: 2,
      step: 0.1,
      description: 'Connection tightness'
    },
    {
      key: 'linkDistance',
      label: 'Link Distance',
      icon: ArrowLeftRight,
      min: 20,
      max: 500,
      step: 5,
      description: 'Default link length'
    },
    {
      key: 'collisionRadius',
      label: 'Collision Radius',
      icon: Circle,
      min: 0,
      max: 100,
      step: 1,
      description: 'Minimum node spacing'
    }
  ];

  if (!isVisible) return null;

  return (
    <motion.div
      className={`force-controls-panel ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Panel Header */}
      <div className="force-controls-header">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-app-accent/20 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-app-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-app-text">Forces</h3>
            <p className="text-xs text-app-text-secondary">Physics simulation controls</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Animation Toggle */}
          <button
            onClick={onAnimationToggle}
            className={`p-1.5 rounded-md transition-colors ${
              isAnimationRunning
                ? 'bg-app-accent text-white'
                : 'bg-app-panel hover:bg-app-bg text-app-text-secondary'
            }`}
            title={isAnimationRunning ? 'Pause Animation' : 'Start Animation'}
          >
            {isAnimationRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>

          {/* Reset Button */}
          <button
            onClick={resetToDefault}
            className="p-1.5 rounded-md bg-app-panel hover:bg-app-bg text-app-text-secondary transition-colors"
            title="Reset to Default"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          {/* Collapse Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-md bg-app-panel hover:bg-app-bg text-app-text-secondary transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="force-controls-content"
          >
            {/* Preset Buttons */}
            <div className="mb-4">
              <div className="text-xs font-medium text-app-text-secondary mb-2">Presets</div>
              <div className="grid grid-cols-3 gap-1">
                {Object.keys(presets).map((presetName) => (
                  <button
                    key={presetName}
                    onClick={() => applyPreset(presetName)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors capitalize ${
                      activePreset === presetName
                        ? 'bg-app-accent text-white'
                        : 'bg-app-panel hover:bg-app-bg text-app-text-secondary'
                    }`}
                  >
                    {presetName}
                  </button>
                ))}
              </div>
            </div>

            {/* Force Parameter Sliders */}
            <div className="space-y-3">
              {forceParams.map(({ key, label, icon: Icon, min, max, step, description }) => (
                <div key={key} className="force-param">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3 h-3 text-app-text-secondary" />
                      <label className="text-xs font-medium text-app-text">{label}</label>
                    </div>
                    <span className="text-xs text-app-text-secondary font-mono">
                      {forces[key]}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={forces[key]}
                    onChange={(e) => handleForceChange(key, parseFloat(e.target.value))}
                    className="force-slider w-full"
                    title={description}
                  />

                  <div className="text-xs text-app-text-secondary mt-1 opacity-80">
                    {description}
                  </div>
                </div>
              ))}
            </div>

            {/* Advanced Controls */}
            <div className="mt-4 pt-3 border-t border-app-border">
              <div className="text-xs font-medium text-app-text-secondary mb-2">Advanced</div>

              <div className="grid grid-cols-2 gap-3">
                <div className="force-param">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-app-text">Alpha Decay</label>
                    <span className="text-xs text-app-text-secondary font-mono">
                      {forces.alphaDecay}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.001}
                    max={0.1}
                    step={0.001}
                    value={forces.alphaDecay}
                    onChange={(e) => handleForceChange('alphaDecay', parseFloat(e.target.value))}
                    className="force-slider w-full"
                    title="Simulation decay rate"
                  />
                </div>

                <div className="force-param">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-app-text">Velocity Decay</label>
                    <span className="text-xs text-app-text-secondary font-mono">
                      {forces.velocityDecay}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    value={forces.velocityDecay}
                    onChange={(e) => handleForceChange('velocityDecay', parseFloat(e.target.value))}
                    className="force-slider w-full"
                    title="Friction/damping"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ForceControlsPanel;