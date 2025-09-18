/**
 * Integration test for GraphDataProcessor with Lokus workspace
 * This file can be used to test the graph data processing system
 */

import { GraphDataProcessor } from './GraphDataProcessor.js';
import { GraphEngine } from './GraphEngine.js';

/**
 * Test the complete graph processing pipeline
 */
export async function testGraphIntegration(workspacePath, containerId = null) {
  
  try {
    // Test 1: Create and initialize GraphDataProcessor
    const processor = new GraphDataProcessor(workspacePath);
    
    // Test 2: Process workspace files
    const graphData = await processor.buildGraphFromWorkspace({
      includeNonMarkdown: false,
      maxDepth: 5,
      excludePatterns: ['.git', 'node_modules', '.lokus', 'target'],
      onProgress: (progress) => {
      }
    });
    
    
    // Test 3: Initialize GraphEngine if container provided
    if (containerId) {
      const container = document.getElementById(containerId);
      
      if (!container) {
        return { processor, graphData, engine: null };
      }
      
      const engine = new GraphEngine(container, {
        maxNodes: 1000,
        nodeColorScheme: {
          '.md': '#10b981',
          '.txt': '#6b7280',
          'folder': '#3b82f6',
          'phantom': '#ef4444',
          'default': '#6366f1'
        }
      });
      
      // Initialize and import data
      engine.initialize();
      engine.importData(graphData);
      
      // Start layout algorithm
      engine.startLayout();
      
      // Fit to viewport after a brief delay
      setTimeout(() => {
        engine.fitToViewport();
      }, 1000);
      
      
      return { processor, graphData, engine };
    }
    
    return { processor, graphData, engine: null };
    
  } catch (error) {
    throw error;
  }
}

/**
 * Test wiki link extraction functionality
 */
export function testWikiLinkExtraction() {
  
  const processor = new GraphDataProcessor('/test/path');
  
  const testContent = `
# Test Document

This document has several types of links:

1. Standard wiki links: [[Home]], [[Projects/README]]
2. Wiki links with aliases: [[Home|Go to Home]], [[docs/api|API Documentation]]
3. Markdown links: [External Link](https://example.com), [Local File](./local.md)
4. Reference links: [Reference Text][ref1], [Another Ref][ref2]

[ref1]: internal-file.md
[ref2]: https://example.com

Some text with [[nested]] and [[multiple|alias]] wiki links in the same paragraph.

Code blocks should be ignored:
\`\`\`
[[this should not be a link]]
\`\`\`

And inline code: \`[[also not a link]]\`
  `;
  
  const links = processor.extractWikiLinks(testContent);
  
  
  // Verify extraction results
  const expectedLinks = [
    { type: 'wiki', target: 'Home' },
    { type: 'wiki', target: 'Projects/README' },
    { type: 'wiki', target: 'Home', alias: 'Go to Home' },
    { type: 'wiki', target: 'docs/api', alias: 'API Documentation' },
    { type: 'markdown', target: './local.md', alias: 'External Link' },
    { type: 'reference', target: 'ref1', alias: 'Reference Text' },
    { type: 'reference', target: 'ref2', alias: 'Another Ref' },
    { type: 'wiki', target: 'nested' },
    { type: 'wiki', target: 'multiple', alias: 'alias' }
  ];
  
  
  return links;
}

/**
 * Performance test for large workspace processing
 */
export async function testPerformance(workspacePath, options = {}) {
  
  const {
    batchSizes = [10, 25, 50, 100],
    iterations = 3
  } = options;
  
  const results = [];
  
  for (const batchSize of batchSizes) {
    
    const iterationResults = [];
    
    for (let i = 0; i < iterations; i++) {
      const processor = new GraphDataProcessor(workspacePath);
      processor.batchSize = batchSize;
      
      const startTime = performance.now();
      
      try {
        const graphData = await processor.buildGraphFromWorkspace({
          includeNonMarkdown: false,
          maxDepth: 3 // Limit depth for performance testing
        });
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        iterationResults.push({
          duration,
          nodes: graphData.nodes.length,
          edges: graphData.edges.length,
          stats: graphData.stats
        });
        
        
      } catch (error) {
        iterationResults.push({ error: error.message });
      }
    }
    
    const avgDuration = iterationResults
      .filter(r => !r.error)
      .reduce((sum, r) => sum + r.duration, 0) / iterations;
    
    results.push({
      batchSize,
      avgDuration: avgDuration.toFixed(2),
      results: iterationResults
    });
    
  }
  
  
  return results;
}

/**
 * Test error handling and edge cases
 */
export async function testErrorHandling(workspacePath) {
  
  try {
    // Test 1: Invalid workspace path
    const invalidProcessor = new GraphDataProcessor('/nonexistent/path');
    
    try {
      await invalidProcessor.buildGraphFromWorkspace();
    } catch (error) {
    }
    
    // Test 2: Valid processor with error conditions
    const processor = new GraphDataProcessor(workspacePath);
    
    // Test with very small batch size
    processor.batchSize = 1;
    processor.maxFileSize = 1; // Very small max file size
    
    const graphData = await processor.buildGraphFromWorkspace({
      maxDepth: 1 // Limit to prevent long processing
    });
    
    
    return true;
    
  } catch (error) {
    return false;
  }
}

// Export utilities for testing
export const GraphTestUtils = {
  testGraphIntegration,
  testWikiLinkExtraction,
  testPerformance,
  testErrorHandling
};

// Make available globally for easy testing in browser console
if (typeof window !== 'undefined') {
  window.GraphTestUtils = GraphTestUtils;
}

export default GraphTestUtils;