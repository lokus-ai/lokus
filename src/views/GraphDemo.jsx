/**
 * GraphDemo - Demonstration of the professional graph visualization system
 * 
 * This component showcases all the features of our new graph system:
 * - Multiple view modes (2D, 3D, force-directed)
 * - Beautiful glassmorphism UI
 * - Real-time WikiLink integration
 * - Advanced search and filtering
 * - Performance with large datasets
 * - Web Worker physics calculations
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ProfessionalGraphView } from './ProfessionalGraphView.jsx';

export const GraphDemo = () => {
  const [showDemo, setShowDemo] = useState(false);
  
  if (!showDemo) {
    return (
      <div className="flex items-center justify-center h-full bg-app-bg text-app-text">
        <motion.div
          className="text-center space-y-6 max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Professional Graph System
          </h1>
          
          <p className="text-app-muted text-lg leading-relaxed">
            Experience the next-generation graph visualization with WebGL rendering, 
            beautiful glassmorphism UI, and professional-grade performance.
          </p>
          
          <div className="space-y-4 text-left bg-app-panel border border-app-border rounded-lg p-6">
            <h3 className="font-semibold text-app-text">Features:</h3>
            <ul className="space-y-2 text-sm text-app-muted">
              <li>✨ Multiple view modes (2D, 3D, Force-directed)</li>
              <li>🚀 WebGL-accelerated rendering (60fps with 10,000+ nodes)</li>
              <li>🎨 Beautiful glassmorphism UI design</li>
              <li>🔗 Real-time WikiLink integration</li>
              <li>🔍 Advanced search and filtering</li>
              <li>⚡ Web Worker physics calculations</li>
              <li>📊 Performance monitoring and optimization</li>
              <li>🎯 Node clustering and community detection</li>
            </ul>
          </div>
          
          <motion.button
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => setShowDemo(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Launch Graph Demo
          </motion.button>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="h-full w-full">
      <ProfessionalGraphView 
        isVisible={true}
        workspacePath={null}
        onOpenFile={(path) => console.log('Opening file:', path)}
      />
    </div>
  );
};

export default GraphDemo;