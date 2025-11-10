import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import mermaid from "mermaid";
import { Eye, SquarePen } from "lucide-react";

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
  const { code = "" } = node.attrs;

  console.log('[MermaidComponent] Mount/Update - code length:', code.length);
  console.log('[MermaidComponent] Mount/Update - first 100 chars:', code.substring(0, 100));

  const [isEditing, setIsEditing] = useState(!code);  // Start in edit mode only if no code
  const [localCode, setLocalCode] = useState(code);
  const [themeVersion, setThemeVersion] = useState(0);
  const [forceRender, setForceRender] = useState(0);

  console.log('[MermaidComponent] State - isEditing:', isEditing, 'localCode length:', localCode.length);

  const containerRef = useRef(null);
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
    if (code !== localCode) {
      console.log('[MermaidComponent] Code changed, updating localCode');
      setLocalCode(code);
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
  useEffect(() => {
    console.log('[MermaidComponent] Render effect triggered - localCode length:', localCode.length);
    console.log('[MermaidComponent] Render effect - localCode.trim():', localCode.trim().substring(0, 50));

    if (!localCode.trim()) {
      console.log('[MermaidComponent] Render effect - skipping, no code');
      return;
    }

    console.log('[MermaidComponent] Render effect - will render diagram');

    const renderDiagram = async () => {
      try {
        console.log('[MermaidComponent] Starting mermaid render...');

        // Get dynamic theme colors
        const themeColors = getThemeColors();
        const isDark = document.documentElement.classList.contains("dark");

        console.log('[MermaidComponent] Theme colors:', themeColors);

        // Initialize Mermaid with dynamic theme
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "strict",
          themeVariables: themeColors,
        });

        console.log('[MermaidComponent] Mermaid initialized, calling render...');

        // Render diagram
        const { svg } = await mermaid.render(diagramIdRef.current, localCode);

        console.log('[MermaidComponent] Mermaid render success, svg length:', svg.length);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          console.log('[MermaidComponent] SVG inserted into container');

          const dimensions = {
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight,
            clientHeight: containerRef.current.clientHeight,
            scrollHeight: containerRef.current.scrollHeight
          };
          console.log('[MermaidComponent] Container dimensions:', dimensions);
          console.log('[MermaidComponent] Container innerHTML length:', containerRef.current.innerHTML.length);

          // If container has no dimensions, retry after layout
          if (dimensions.width === 0 || dimensions.height === 0) {
            console.log('[MermaidComponent] Container has no dimensions, retrying after layout...');
            setTimeout(() => {
              if (containerRef.current) {
                containerRef.current.innerHTML = svg;
                console.log('[MermaidComponent] SVG re-inserted after delay');
              }
            }, 100);
          }
        } else {
          console.log('[MermaidComponent] ERROR: containerRef.current is null!');
        }
      } catch (e) {
        console.error('[MermaidComponent] Mermaid render error:', e);
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div style="
              padding: 8px 12px;
              background: rgb(var(--danger) / 0.1);
              border-left: 3px solid rgb(var(--danger));
              border-radius: 4px;
              font-size: 13px;
              color: rgb(var(--danger));
              font-family: ui-monospace, monospace;
            ">
              <strong>Mermaid Syntax Error:</strong> ${e.message}
            </div>
          `;
        }
      }
    };

    renderDiagram();
  }, [localCode, themeVersion, forceRender]);


  // Handlers
  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    updateAttributes({ code: localCode });
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      updateAttributes({ code: localCode });
      setIsEditing(false);
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
      <button
        onClick={() => setIsEditing((prev) => !prev)}
        className="absolute top-1 right-0 p-1 rounded-md"
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
          display: isEditing ? 'none' : 'block'
        }}
      />
    </NodeViewWrapper>
  );
};

export default MermaidComponent;
