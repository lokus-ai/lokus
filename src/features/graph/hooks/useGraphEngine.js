import { useRef, useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../../stores/workspace';
import { GraphDataProcessor } from '../../../core/graph/GraphDataProcessor';
import { GraphData } from '../../../core/graph/GraphData';
import { GraphEngine } from '../../../core/graph/GraphEngine';
import posthog from '../../../services/posthog.js';

const MAX_OPEN_TABS = 10;

export function useGraphEngine({ workspacePath }) {
  const graphProcessorRef = useRef(null);
  const graphDataInstanceRef = useRef(null);
  const persistentGraphEngineRef = useRef(null);

  // Initialize graph processor and set up real-time event listeners
  const initializeGraphProcessor = useCallback(() => {
    if (!workspacePath || graphProcessorRef.current) return;

    graphProcessorRef.current = new GraphDataProcessor(workspacePath);

    // Initialize GraphData instance for backlinks
    if (!graphDataInstanceRef.current) {
      graphDataInstanceRef.current = new GraphData({
        enablePersistence: false,
        enableRealTimeSync: true,
        maxCacheSize: 10000
      });
    }

    // Set up event listeners for real-time graph updates
    const graphDatabase = graphProcessorRef.current.getGraphDatabase();

    const handleFileLinksUpdated = () => {
      const { activeFile, graphData } = useWorkspaceStore.getState();
      if (activeFile === '__graph__' && graphData) {
        const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
        useWorkspaceStore.getState().setGraphData(updatedGraphData);
      }
    };

    const handleConnectionChanged = () => {
      const { activeFile, graphData } = useWorkspaceStore.getState();
      if (activeFile === '__graph__' && graphData) {
        const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
        useWorkspaceStore.getState().setGraphData(updatedGraphData);
      }
    };

    graphDatabase.on('fileLinksUpdated', handleFileLinksUpdated);
    graphDatabase.on('connectionAdded', handleConnectionChanged);
    graphDatabase.on('connectionRemoved', handleConnectionChanged);

    // Store cleanup function
    graphProcessorRef.current._cleanup = () => {
      graphDatabase.off('fileLinksUpdated', handleFileLinksUpdated);
      graphDatabase.off('connectionAdded', handleConnectionChanged);
      graphDatabase.off('connectionRemoved', handleConnectionChanged);
    };
  }, [workspacePath]);

  // Handle graph state updates from ProfessionalGraphView
  const handleGraphStateChange = useCallback((state) => {
    useWorkspaceStore.getState().setGraphSidebar(state);
  }, []);

  // Build graph data for backlinks panel
  // Note: ProfessionalGraphView has its own data loading, but BacklinksPanel needs GraphDatabase
  const buildGraphData = useCallback(async () => {
    const { isLoadingGraph } = useWorkspaceStore.getState();
    if (!graphProcessorRef.current || isLoadingGraph) return;

    useWorkspaceStore.getState().setLoadingGraph(true);

    try {
      const data = await graphProcessorRef.current.buildGraphFromWorkspace({
        includeNonMarkdown: false,
        maxDepth: 10,
        excludePatterns: ['.git', 'node_modules', '.lokus', '.DS_Store']
      });

      useWorkspaceStore.getState().setGraphData(data);
    } catch (error) {
      useWorkspaceStore.getState().setGraphData(null);
    } finally {
      useWorkspaceStore.getState().setLoadingGraph(false);
    }
  }, []);

  const handleGraphNodeClick = useCallback((event) => {
    const { nodeId, nodeData } = event;

    // If it's a file node (not phantom), open the file
    if (nodeData && nodeData.path && !nodeData.isPhantom) {
      const store = useWorkspaceStore.getState();
      const fileName = nodeData.path.split('/').pop();
      store.openTab(nodeData.path, fileName);
    }
  }, []);

  const handleOpenGraphView = useCallback(() => {
    const graphPath = '__graph__';
    const graphName = 'Graph View';

    posthog.trackFeatureActivation('graph');

    useWorkspaceStore.setState((s) => {
      const newTabs = s.openTabs.filter(t => t.path !== graphPath);
      newTabs.unshift({ path: graphPath, name: graphName });
      if (newTabs.length > MAX_OPEN_TABS) {
        newTabs.pop();
      }
      return { openTabs: newTabs };
    });
    useWorkspaceStore.setState({ activeFile: graphPath });
  }, []);

  const updateFileInGraph = useCallback(async (filePath, content) => {
    if (!graphProcessorRef.current) return;
    try {
      const updateResult = await graphProcessorRef.current.updateFileContent(filePath, content);
      if (updateResult.added > 0 || updateResult.removed > 0) {
        const updatedGraphData = graphProcessorRef.current.buildGraphStructure();
        useWorkspaceStore.getState().setGraphData(updatedGraphData);
      }
    } catch (e) {
      try {
        const updatedGraphData = await graphProcessorRef.current.updateChangedFiles([filePath]);
        if (updatedGraphData) useWorkspaceStore.getState().setGraphData(updatedGraphData);
      } catch (_) { /* silent */ }
    }
  }, []);

  // Initialize graph processor when workspace path changes
  useEffect(() => {
    if (workspacePath) {
      initializeGraphProcessor();
    }
  }, [workspacePath, initializeGraphProcessor]);

  // Build graph data ONCE when workspace is initialized (for backlinks)
  useEffect(() => {
    const { graphData, isLoadingGraph } = useWorkspaceStore.getState();
    if (workspacePath && graphProcessorRef.current && !graphData && !isLoadingGraph) {
      buildGraphData();
    }
  }, [workspacePath, buildGraphData]);

  // Cleanup persistent GraphEngine and GraphDatabase when workspace unmounts
  useEffect(() => {
    return () => {
      if (persistentGraphEngineRef.current) {
        persistentGraphEngineRef.current.destroy();
        persistentGraphEngineRef.current = null;
      }

      if (graphProcessorRef.current) {
        if (graphProcessorRef.current._cleanup) {
          graphProcessorRef.current._cleanup();
        }
        graphProcessorRef.current.destroy();
        graphProcessorRef.current = null;
      }
    };
  }, []);

  return {
    buildGraphData,
    updateFileInGraph,
    handleGraphNodeClick,
    handleGraphStateChange,
    handleOpenGraphView,
    initializeGraphProcessor,
    graphProcessorRef,
    graphDataInstanceRef,
    persistentGraphEngineRef,
  };
}
