import { useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { GraphDataProcessor } from '../../../core/graph/GraphDataProcessor';
import { GraphData } from '../../../core/graph/GraphData';
import { GraphEngine } from '../../../core/graph/GraphEngine';

export function useGraphEngine({ workspacePath }) {
  const graphProcessorRef = useRef(null);
  const graphDataInstanceRef = useRef(null);
  const persistentGraphEngineRef = useRef(null);

  const setGraphData = useWorkspaceStore((s) => s.setGraphData);
  const setLoadingGraph = useWorkspaceStore((s) => s.setLoadingGraph);
  const setGraphSidebar = useWorkspaceStore((s) => s.setGraphSidebar);

  const initializeGraphProcessor = useCallback(async () => {
    if (!workspacePath || graphProcessorRef.current) return graphProcessorRef.current;
    try {
      graphProcessorRef.current = new GraphDataProcessor(workspacePath);
      await graphProcessorRef.current.initialize();
      return graphProcessorRef.current;
    } catch (e) {
      console.error('Graph processor init failed:', e);
      return null;
    }
  }, [workspacePath]);

  const buildGraphData = useCallback(async () => {
    if (!workspacePath) return;
    setLoadingGraph(true);
    try {
      const processor = await initializeGraphProcessor();
      if (!processor) return;
      const data = processor.buildGraphStructure();
      setGraphData(data);
    } catch (e) {
      console.error('Graph build failed:', e);
    } finally {
      setLoadingGraph(false);
    }
  }, [workspacePath, setGraphData, setLoadingGraph, initializeGraphProcessor]);

  const updateFileInGraph = useCallback(async (filePath, content) => {
    if (!graphProcessorRef.current) return;
    try {
      const updateResult = await graphProcessorRef.current.updateFileContent(filePath, content);
      if (updateResult.added > 0 || updateResult.removed > 0) {
        const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
        setGraphData(updatedGraphData);
      }
    } catch (e) {
      try {
        const updatedGraphData = await graphProcessorRef.current.updateChangedFiles([filePath]);
        if (updatedGraphData) setGraphData(updatedGraphData);
      } catch (_) { /* silent */ }
    }
  }, [setGraphData]);

  const handleGraphNodeClick = useCallback((node) => {
    if (!node?.path) return;
    const store = useWorkspaceStore.getState();
    const name = node.path.split('/').pop();
    store.openTab(node.path, name);
  }, []);

  const handleGraphStateChange = useCallback((state) => {
    setGraphSidebar(state);
  }, [setGraphSidebar]);

  return {
    buildGraphData,
    updateFileInGraph,
    handleGraphNodeClick,
    handleGraphStateChange,
    graphProcessorRef,
    graphDataInstanceRef,
    persistentGraphEngineRef,
    initializeGraphProcessor,
  };
}
