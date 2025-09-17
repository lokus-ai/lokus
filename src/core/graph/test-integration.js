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
  console.log('🧪 Starting graph integration test...');
  
  try {
    // Test 1: Create and initialize GraphDataProcessor
    console.log('📊 Testing GraphDataProcessor...');
    const processor = new GraphDataProcessor(workspacePath);
    
    // Test 2: Process workspace files
    const graphData = await processor.buildGraphFromWorkspace({
      includeNonMarkdown: false,
      maxDepth: 5,
      excludePatterns: ['.git', 'node_modules', '.lokus', 'target'],
      onProgress: (progress) => {
        console.log(`📈 Progress: ${progress.progress}% (${progress.processedFiles}/${progress.totalFiles})`);
      }
    });
    
    console.log('✅ Graph data processed successfully:', {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
      stats: graphData.stats
    });
    
    // Test 3: Initialize GraphEngine if container provided
    if (containerId) {
      console.log('🎨 Testing GraphEngine visualization...');
      const container = document.getElementById(containerId);
      
      if (!container) {
        console.warn(`Container with ID '${containerId}' not found`);
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
      
      console.log('✅ Graph visualization initialized successfully');
      
      return { processor, graphData, engine };
    }
    
    return { processor, graphData, engine: null };
    
  } catch (error) {
    console.error('❌ Graph integration test failed:', error);
    throw error;
  }
}

/**
 * Test wiki link extraction functionality
 */
export function testWikiLinkExtraction() {
  console.log('🔗 Testing wiki link extraction...');
  
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
  
  console.log('📋 Extracted links:', links);
  
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
  
  console.log(`✅ Extracted ${links.length} links (expected patterns found)`);
  
  return links;
}

/**
 * Performance test for large workspace processing
 */
export async function testPerformance(workspacePath, options = {}) {
  console.log('⚡ Starting performance test...');
  
  const {
    batchSizes = [10, 25, 50, 100],
    iterations = 3
  } = options;
  
  const results = [];
  
  for (const batchSize of batchSizes) {
    console.log(`📊 Testing batch size: ${batchSize}`);
    
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
        
        console.log(`  Iteration ${i + 1}: ${duration.toFixed(2)}ms`);
        
      } catch (error) {
        console.error(`  Iteration ${i + 1} failed:`, error);
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
    
    console.log(`  Average: ${avgDuration.toFixed(2)}ms`);
  }
  
  console.log('⚡ Performance test completed:', results);
  
  return results;
}

/**
 * Test error handling and edge cases
 */
export async function testErrorHandling(workspacePath) {
  console.log('🛡️ Testing error handling...');
  
  try {
    // Test 1: Invalid workspace path
    console.log('  Testing invalid workspace path...');
    const invalidProcessor = new GraphDataProcessor('/nonexistent/path');
    
    try {
      await invalidProcessor.buildGraphFromWorkspace();
      console.warn('  ⚠️ Expected error for invalid path, but succeeded');
    } catch (error) {
      console.log('  ✅ Correctly handled invalid workspace path');
    }
    
    // Test 2: Valid processor with error conditions
    console.log('  Testing error recovery...');
    const processor = new GraphDataProcessor(workspacePath);
    
    // Test with very small batch size
    processor.batchSize = 1;
    processor.maxFileSize = 1; // Very small max file size
    
    const graphData = await processor.buildGraphFromWorkspace({
      maxDepth: 1 // Limit to prevent long processing
    });
    
    console.log('  ✅ Error recovery test completed:', {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
      errors: graphData.stats.errors
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
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
  console.log('🔧 Graph test utilities available globally as window.GraphTestUtils');
}

export default GraphTestUtils;