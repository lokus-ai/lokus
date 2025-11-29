import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import mermaid from "mermaid";
import { Eye, SquarePen, Maximize2 } from "lucide-react";
import { MermaidViewerModal } from "../../components/MermaidViewerModal.jsx";
import { logger } from "../../utils/logger.js";

// Helper function to read CSS custom property and convert RGB to hex
const getCSSVariable = (varName) => {
  const rgbValue = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();

  if (!rgbValue) return null;

  // Convert "30 30 30" to "#1e1e1e"
  const [r, g, b] = rgbValue.split(/\s+/).map(v => parseInt(v, 10));
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

// Get dynamic theme colors from CSS custom properties
const getThemeColors = () => {
  return {
    background: getCSSVariable('--bg') || '#ffffff',
    primaryColor: getCSSVariable('--panel') || '#f5f5f5',
    primaryTextColor: getCSSVariable('--text') || '#000000',
    lineColor: getCSSVariable('--border') || '#cccccc',
    edgeLabelBackground: getCSSVariable('--panel') || '#f5f5f5',
  };
};

const MermaidComponent = ({ node, updateAttributes }) => {
  const { code = "" } = node.attrs;  // Start in edit mode if there's no code or only whitespace
  const [isEditing, setIsEditing] = useState(() => {
    const hasCode = code && code.trim().length > 0;    return !hasCode;
  });
  const [localCode, setLocalCode] = useState(code);
  const [themeVersion, setThemeVersion] = useState(0);
  const [forceRender, setForceRender] = useState(0);

  // Fullscreen viewer state
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [svgContent, setSvgContent] = useState(null);  const containerRef = useRef(null);
  const diagramIdRef = useRef(`m-${Math.random().toString(36).substring(2, 9)}`);

  // On mount, if we have code, force a render after layout
  useEffect(() => {
    if (code && code.trim()) {
      // Force re-render after a tick so container has dimensions
      setTimeout(() => setForceRender(1), 50);
    }
  }, []);

  // Sync localCode when node code changes
  useEffect(() => {
    if (code !== localCode) {      setLocalCode(code);
    }
  }, [code]);

  // Watch for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      setThemeVersion(prev => prev + 1);
    };

    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    return () => observer.disconnect();
  }, []);

  // Initialize and render Mermaid diagram
  useEffect(() => {    if (!localCode.trim()) {      return;
    }    const renderDiagram = async () => {
      try {        // Get dynamic theme colors
        const themeColors = getThemeColors();
        const isDark = document.documentElement.classList.contains("dark");        // Initialize Mermaid with dynamic theme
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "strict",
          themeVariables: themeColors,
        });        // Render diagram
        const { svg } = await mermaid.render(diagramIdRef.current, localCode);        if (containerRef.current) {
          containerRef.current.innerHTML = svg;          const dimensions = {
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight,
            clientHeight: containerRef.current.clientHeight,
            scrollHeight: containerRef.current.scrollHeight
          };          // If container has no dimensions, retry after layout
          if (dimensions.width === 0 || dimensions.height === 0) {            setTimeout(() => {
              if (containerRef.current) {
                containerRef.current.innerHTML = svg;              }
            }, 100);
          }
        } else {        }
      } catch (e) {
        logger.error('MermaidComponent', 'Mermaid render error:', e);
        if (containerRef.current) {
          // Create error message DOM safely using textContent instead of innerHTML with template strings
          const errorDiv = document.createElement('div');
          errorDiv.style.cssText = `
            padding: 8px 12px;
            background: rgb(var(--danger) / 0.1);
            border-left: 3px solid rgb(var(--danger));
            border-radius: 4px;
            font-size: 13px;
            color: rgb(var(--danger));
            font-family: ui-monospace, monospace;
          `;

          const errorTitle = document.createElement('strong');
          errorTitle.textContent = 'Mermaid Syntax Error: ';

          const errorMessage = document.createTextNode(e.message);

          errorDiv.appendChild(errorTitle);
          errorDiv.appendChild(errorMessage);

          // Clear and append safely
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(errorDiv);
        }
      }
    };

    renderDiagram();
  }, [localCode, themeVersion, forceRender]);


  // Handlers
  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {    updateAttributes({ code: localCode });
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();      updateAttributes({ code: localCode });
      setIsEditing(false);
    }
  };

  // Fullscreen viewer handlers
  const handleOpenViewer = () => {
    if (containerRef.current && !isEditing) {
      const svgElement = containerRef.current.querySelector('svg');
      if (svgElement) {
        // Serialize SVG to string
        const svgString = new XMLSerializer().serializeToString(svgElement);
        setSvgContent(svgString);
        setIsViewerOpen(true);
      }
    }
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setSvgContent(null);
  };

  const handleDiagramClick = () => {
    if (!isEditing) {
      handleOpenViewer();
    }
  };

  return (
    <NodeViewWrapper
      className="mermaid-node-view relative rounded-xl border my-4 p-3 shadow-sm transition-colors duration-300"
      style={{
        borderColor: 'rgb(var(--border))',
        backgroundColor: 'rgb(var(--bg))',
        color: 'rgb(var(--text))',
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Control buttons */}
      <div className="absolute top-1 right-0 flex gap-1">
        {/* Fullscreen button - only show when viewing diagram */}
        {!isEditing && localCode.trim() && (
          <button
            onClick={handleOpenViewer}
            className="p-1 rounded-md"
            style={{
              color: 'rgb(var(--text))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--panel))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="View fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}

        {/* Edit/View toggle button */}
        <button
          onClick={() => setIsEditing((prev) => !prev)}
          className="p-1 rounded-md"
          style={{
            color: 'rgb(var(--text))',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgb(var(--panel))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title={isEditing ? "View Diagram" : "Edit Diagram"}
        >
          {isEditing ? (
            <Eye className="w-4 h-4" />
          ) : (
            <SquarePen className="w-4 h-4" />
          )}
        </button>
      </div>

      {isEditing && (
        <div className="flex flex-col items-center">
          <h4
            className="text-sm font-semibold"
            style={{ color: 'rgb(var(--text))' }}
          >
            Write mermaid code
          </h4>
          <textarea
            className="w-full h-48 font-mono text-sm p-2 bg-transparent focus:outline-none resize-none"
            style={{ color: 'rgb(var(--text))' }}
            value={localCode}
            onChange={(e) => setLocalCode(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
      )}

      <div
        ref={containerRef}
        className="mermaid-diagram w-full overflow-x-auto p-2"
        style={{
          minHeight: '100px',
          display: isEditing ? 'none' : 'block',
          cursor: !isEditing && localCode.trim() ? 'pointer' : 'default',
          transition: 'filter 0.2s ease'
        }}
        onClick={handleDiagramClick}
        onMouseEnter={(e) => {
          if (!isEditing && localCode.trim()) {
            e.currentTarget.style.filter = 'brightness(1.1)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'brightness(1)';
        }}
      />

      {/* Fullscreen Mermaid Viewer Modal */}
      <MermaidViewerModal
        isOpen={isViewerOpen}
        svgContent={svgContent}
        onClose={handleCloseViewer}
      />
    </NodeViewWrapper>
  );
};

export default MermaidComponent;
