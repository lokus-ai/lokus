import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import mermaid from "mermaid";
import { Eye, SquarePen } from "lucide-react";

const MermaidComponent = ({ node, updateAttributes }) => {
  const { code = "" } = node.attrs;
  console.log(code);
  
  const [isEditing, setIsEditing] = useState(!code);
  const [localCode, setLocalCode] = useState(code);
  const [theme, setTheme] = useState(
    document.documentElement.classList.contains("dark") ? "dark" : "default"
  );


  const containerRef = useRef(null);
  const diagramIdRef = useRef(`m-${Math.random().toString(36).substring(2, 9)}`); // Stable ID


   // Watch for theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      const newTheme = document.documentElement.classList.contains("dark")
        ? "dark"
        : "default";
      setTheme(newTheme);
    };

    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);



  //  Initialize Mermaid whenever theme changes
  useEffect(() => {
    const isDark = theme === "dark";

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? "dark" : "default",
      securityLevel: "loose",
      themeVariables: isDark
        ? {
            background: "#0f172a",
            primaryColor: "#1e293b",
            primaryTextColor: "#f8fafc",
            lineColor: "#94a3b8",
            edgeLabelBackground: "#1e293b",
          }
        : {
            background: "#ffffff",
            primaryColor: "#f1f5f9",
            primaryTextColor: "#1e293b",
            lineColor: "#475569",
            edgeLabelBackground: "#f8fafc",
          },
    });

     if (localCode.trim()) {
    mermaid
      .render(diagramIdRef.current, localCode)
      .then(({ svg }) => {
        if (containerRef.current) containerRef.current.innerHTML = svg;
      })
      .catch((e) => {
        if (containerRef.current)
          containerRef.current.innerHTML = `<pre style="color:red;">${e.message}</pre>`;
      });
  }
  }, [theme]);


  // Re-render diagram when code changes
  useEffect(() => {

    if (!localCode.trim()) return;

    const renderMermaid = async () => {
      console.log("Inside renderer", localCode);
      try {
        console.log("id", diagramIdRef.current);
        
        const { svg } = await mermaid.render(diagramIdRef.current, localCode);
        console.log("svg", svg);
        

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }

      } catch (e) {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre style="color:red;">${e.message}</pre>`;
        }
      }
    };

    // delay to ensure DOM is ready after node update
    setTimeout(renderMermaid, 30);
  }, [localCode, theme]);


  // Handlers
  const handleDoubleClick = () => {
    // setLocalCode(code);
    setIsEditing(true);
  };

  const handleBlur = () => {
    console.log("code", code);
    console.log("localCode", localCode);
    
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
  console.log("localcode⚡", localCode);
  console.log("containerRef", containerRef);
  console.log("containerRef.current", containerRef.current);
  


  return (
    <NodeViewWrapper
      className="mermaid-node-view relative rounded-xl border border-red-200 dark:border-gray-700 my-4 p-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-300  shadow-sm dark:shadow-none transition-colors duration-300  "
      onDoubleClick={handleDoubleClick}
    >
        
        <button
          onClick={() => setIsEditing((prev) => !prev)}
          className="absolute top-1 right-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md"
          title={isEditing ? "View Diagram" : "Edit Diagram"}
        >
          {isEditing ? (
            <Eye className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          ):(
            <SquarePen className="w-4 h-4 text-gray-700 dark:text-gray-200" />

          )}
        </button>

      {isEditing && (
        <div className="flex flex-col items-center">
        <h4 className="text-sm font-semibold ">
          Write mermaid code
        </h4>
        <textarea
          className="w-full h-48 font-mono text-sm p-2 bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none resize-none"
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
        className={`mermaid-diagram w-full overflow-x-auto p-2  dark:text-gray-900 `}
      />

    </NodeViewWrapper>

  );
};

export default MermaidComponent;
