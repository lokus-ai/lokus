import { describe, it, expect } from 'vitest';

describe('Graph Worker Threshold', () => {
  it('should use worker for graphs with more than 50 nodes', () => {
    // Verify the threshold constant
    // Since we can't easily instantiate GraphEngine in a unit test,
    // we verify the threshold by reading the source
    const fs = require('fs');
    const source = fs.readFileSync('src/core/graph/GraphEngine.js', 'utf8');

    // Should use worker for > 50 nodes (not 500)
    expect(source).toContain('this.graph.order > 50');
    expect(source).not.toContain('this.graph.order > 500');
  });
});
