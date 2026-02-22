import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { WALKTHROUGH_STEPS } from "./data/walkthrough-steps.js";
import "./walkthrough.css";

const PADDING = 8;

function getRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.x - PADDING,
    y: r.y - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
    element: el,
  };
}

function getTooltipPosition(rect, position, tooltipWidth = 320, tooltipHeight = 160) {
  if (!rect) return { top: "50%", left: "50%" };

  const gap = 12;
  const style = {};

  switch (position) {
    case "top":
      style.top = rect.y - tooltipHeight - gap;
      style.left = rect.x;
      break;
    case "bottom":
      style.top = rect.y + rect.height + gap;
      style.left = rect.x;
      break;
    case "left":
      style.top = rect.y;
      style.left = rect.x - tooltipWidth - gap;
      break;
    case "right":
      style.top = rect.y;
      style.left = rect.x + rect.width + gap;
      break;
    default:
      style.top = rect.y + rect.height + gap;
      style.left = rect.x;
  }

  // Clamp to viewport
  style.top = Math.max(8, Math.min(style.top, window.innerHeight - tooltipHeight - 8));
  style.left = Math.max(8, Math.min(style.left, window.innerWidth - tooltipWidth - 8));

  return style;
}

function getArrowClass(position) {
  switch (position) {
    case "top": return "walkthrough-arrow-bottom";
    case "bottom": return "walkthrough-arrow-top";
    case "left": return "walkthrough-arrow-right";
    case "right": return "walkthrough-arrow-left";
    default: return "walkthrough-arrow-top";
  }
}

export function InteractiveWalkthrough({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [visible, setVisible] = useState(true);
  const listenerRef = useRef(null);

  const step = WALKTHROUGH_STEPS[currentStep];

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!step) return;
    const rect = getRect(step.target);
    setTargetRect(rect);
  }, [step]);

  useEffect(() => {
    measureTarget();
    // Re-measure on resize/scroll
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [measureTarget]);

  // Re-measure periodically in case DOM shifts (panels opening, etc.)
  useEffect(() => {
    const interval = setInterval(measureTarget, 500);
    return () => clearInterval(interval);
  }, [measureTarget]);

  // Listen for the user's action to advance
  useEffect(() => {
    if (!step || !targetRect) return;

    // Clean up previous listener
    if (listenerRef.current) {
      listenerRef.current();
      listenerRef.current = null;
    }

    if (step.action === "click") {
      const handler = () => {
        advance();
      };
      targetRect.element.addEventListener("click", handler, { once: true });
      listenerRef.current = () => targetRect.element.removeEventListener("click", handler);
    } else if (step.action === "keyboard") {
      const handler = (e) => {
        if (step.actionKey === "mod+k") {
          if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            advance();
          }
        } else if (step.actionKey === "task") {
          // Advance when user types anything in editor (simplified — task creation is complex)
          if (e.key === "[" || e.key === "]" || e.key === " ") {
            advance();
          }
        } else if (step.actionKey === "[[") {
          if (e.key === "[") {
            advance();
          }
        } else if (e.key === step.actionKey) {
          advance();
        }
      };
      document.addEventListener("keydown", handler);
      listenerRef.current = () => document.removeEventListener("keydown", handler);
    }

    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
    };
  }, [step, targetRect, currentStep]);

  const advance = useCallback(() => {
    if (currentStep >= WALKTHROUGH_STEPS.length - 1) {
      finish();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  const finish = useCallback(() => {
    setVisible(false);
    if (onComplete) onComplete();
  }, [onComplete]);

  if (!visible || !step) return null;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = targetRect;

  return createPortal(
    <>
      {/* SVG overlay with cutout */}
      <div className="walkthrough-overlay">
        <svg>
          <defs>
            <mask id="walkthrough-mask">
              <rect x="0" y="0" width={w} height={h} fill="white" />
              {r && (
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width={w}
            height={h}
            fill="rgba(0,0,0,0.6)"
            mask="url(#walkthrough-mask)"
          />
        </svg>
      </div>

      {/* Pulsing ring around target */}
      {r && (
        <div
          className="walkthrough-pulse"
          style={{
            top: r.y,
            left: r.x,
            width: r.width,
            height: r.height,
          }}
        />
      )}

      {/* Tooltip */}
      {r && (
        <div
          className="walkthrough-tooltip"
          style={getTooltipPosition(r, step.position)}
        >
          <div className={`walkthrough-arrow ${getArrowClass(step.position)}`} />
          <div className="walkthrough-tooltip-title">{step.title}</div>
          <div className="walkthrough-tooltip-desc">{step.description}</div>
          <div className="walkthrough-tooltip-footer">
            <span className="walkthrough-tooltip-progress">
              {currentStep + 1} / {WALKTHROUGH_STEPS.length}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="walkthrough-tooltip-skip" onClick={finish}>
                Skip tour
              </button>
              <button className="walkthrough-tooltip-next" onClick={advance}>
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
