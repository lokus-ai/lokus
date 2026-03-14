import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X, ChevronDown, Layers } from 'lucide-react';

/**
 * MeetingOverlay — Notion-style floating banner that appears above all apps.
 * Rendered in its own transparent, always-on-top, frameless Tauri window.
 */
export default function MeetingOverlay() {
  const [isClosing, setIsClosing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Position window at top-center of screen on mount
  useEffect(() => {
    async function positionWindow() {
      try {
        const win = getCurrentWindow();
        const monitor = await win.currentMonitor();
        if (monitor) {
          const screenWidth = monitor.size.width / monitor.scaleFactor;
          const windowWidth = 620;
          const x = Math.round((screenWidth - windowWidth) / 2);
          await win.setPosition({ type: 'Logical', x, y: 12 });
        }
      } catch (err) {
        console.error('[MeetingOverlay] position error:', err);
      }
    }
    positionWindow();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClose = async () => {
    setIsClosing(true);
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('meeting:dismiss');
    } catch (_) {}
    setTimeout(() => {
      invoke('close_meeting_overlay').catch(() => {});
    }, 150);
  };

  const handleStart = async () => {
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('meeting:start-recording');
      await invoke('close_meeting_overlay');
    } catch (err) {
      console.error('[MeetingOverlay] start error:', err);
    }
  };

  return (
    <div className={`overlay-root ${isClosing ? 'closing' : ''}`}>
      {/* Left controls — outside the card, like Notion */}
      <div className="overlay-controls">
        <button className="ctrl-btn" aria-label="Collapse">
          <Layers size={13} />
        </button>
        <button className="ctrl-btn" onClick={handleClose} aria-label="Close">
          <X size={13} />
        </button>
      </div>

      {/* Main card */}
      <div className="overlay-card" data-tauri-drag-region>
        {/* App icon */}
        <div className="overlay-icon">
          <svg width="28" height="28" viewBox="0 0 480 495" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M204 1.1333C199.6 1.79999 192.133 3.26666 187.333 4.33331C182.533 5.39999 177.6 6.33331 176.267 6.33331C174.8 6.33331 171.867 7.13333 169.6 8.06665C163.467 10.7333 156.533 13.1333 152 14.2C149.733 14.7333 146.8 15.9333 145.333 16.7333C143.867 17.5333 140 19.4 136.667 21C130.133 24.0667 128.4 25 119.6 30.6C116.4 32.7333 113.6 34.3333 113.2 34.3333C112.667 34.3333 103.6 40.8666 92 49.6667C80 58.8666 44.8 99 40.2666 109C39.7333 110.067 38.1333 112.733 36.8 115C27.7333 129.4 16.1333 155.933 10.9333 174.333C2.26663 205.133 0.666626 216.333 0.666626 246.867C0.666626 273.133 2.13329 286.067 6.79996 303.133C7.86663 306.867 8.66663 311 8.66663 312.467C8.66663 313.8 10.2666 319.133 12.1333 324.333C14 329.4 16 335.133 16.6666 337C20 347.133 32.8 373.133 40.4 385.267C64.5333 423.533 96.9333 453 135.333 471.8C158.933 483.267 171.6 487.933 185.333 490.333C189.067 491 195.067 492.2 198.667 493.133C202.8 494.067 216.533 494.733 235.333 494.733C265.067 494.867 274.667 493.8 293.333 488.733C296.267 487.933 300.8 486.867 303.333 486.2C311.2 484.467 319.333 481.267 336 472.867C353.6 464.2 355.067 463.267 362.133 457.933C364.8 455.933 367.467 454.333 368 454.333C369.733 454.333 384.533 442.2 396.4 431C419.467 409.4 440.933 377.933 454.667 345.667C455.6 343.4 457.333 339.4 458.533 336.6C459.733 333.8 460.667 330.6 460.667 329.267C460.667 328.067 461.6 325.8 462.667 324.467C463.867 323 464.667 319 464.667 315.267C464.667 307.4 465.467 308.467 420 254.867C415.6 249.667 409.6 242.467 406.667 239C403.733 235.4 400.4 231.667 399.2 230.467C398.133 229.267 395.2 225.667 392.667 222.333C390.133 219 386.8 215 385.2 213.267C383.6 211.667 381.333 207.533 380 204.2C378 198.733 377.867 197.4 379.467 192.467C380.933 187.8 385.467 179 390 171.667C390.667 170.6 392.533 167 394.267 163.667C396.8 158.333 406.533 141.133 410 135.667C410.667 134.6 412.8 130.6 414.667 127C416.533 123.267 419.2 118.467 420.533 116.333C421.733 114.067 425.467 107.533 428.667 101.667C431.867 95.8 435.467 89.1333 436.8 87C438.133 84.7333 440.8 79.9333 442.667 76.3333C444.667 72.6 448.267 66.0667 450.667 61.6667C453.2 57.2667 455.867 52.4666 456.667 51C457.467 49.5333 460.133 44.7333 462.667 40.3333C465.067 35.9333 468.8 29.2667 470.667 25.6667C472.533 21.9333 475.6 16.4666 477.333 13.4C481.067 6.59998 479.867 5.1333 474.667 10.0667C469.867 14.4666 461.867 21.4 453.333 28.3333C449.867 31.2667 446 34.6 444.8 35.8C443.6 36.8666 440 39.9333 436.667 42.3333C433.333 44.8666 426.8 50.2 422 54.0667C417.2 57.9333 410.933 63.1333 408.133 65.4C405.2 67.8 402 70.6 400.8 71.8C399.6 72.8666 394.8 76.7333 390 80.3333C385.2 83.9333 381.067 87.2667 380.667 87.6667C380.267 88.0667 376.667 91 372.667 94.3333C368.667 97.6667 363.2 102.333 360.533 104.733C357.867 107.133 352.533 111.4 348.533 114.333C344.667 117.267 341.2 120.2 340.8 120.733C340.267 121.4 334 126.867 326.667 133C315.067 142.733 306.667 150.067 301.467 155.133C300.667 155.933 294 161.8 286.667 168.333C265.733 186.867 259.333 193.667 259.333 197.267C259.333 200.067 264 208.067 266.933 210.2C267.6 210.6 274.533 218.467 282.667 227.667C290.667 236.867 300.533 247.8 304.667 252.2C308.667 256.467 312.667 260.6 313.467 261.533C315.2 263.4 337.467 288.467 341.333 292.867C342.8 294.467 345.333 297.4 347.067 299.267C351.333 303.933 356.667 316.333 356.667 321.667C356.667 337.933 325.733 369.8 296.667 383.667C293.333 385.267 289.6 387.133 288.133 387.933C284.933 389.667 273.6 392.733 259.333 395.667C236.667 400.333 206.533 396.6 183.6 386.2C179.067 384.067 175.067 382.333 174.8 382.333C174.4 382.333 170.4 379.8 165.733 376.733C112.667 341.667 87.8666 286.467 96.4 222.333C98.1333 209.4 102.8 192.2 106.133 186.333C106.8 185.267 107.733 183.4 108.133 182.333C110.667 175.667 117.2 164.467 124.267 154.867C136.533 138.333 156.267 121.133 174 111.8C180.4 108.467 182.533 107.533 187.6 105.667C205.733 99 222.533 95.8 238.533 95.6667C251.6 95.5333 270.133 98.2 275.333 101C276.667 101.667 278.8 102.333 280 102.333C281.2 102.333 285.733 104.067 290.267 106.333C299.867 111.133 306.533 111.4 311.467 107.267C313.467 105.667 323.733 97 334.4 87.9333C345.2 79 355.067 70.6 356.267 69.2667C357.6 67.9333 361.333 64.7333 364.667 62.0667C368 59.4 373.067 55.1333 376 52.3333L381.333 47.5333L376.667 43.5333C374.133 41.2667 370.8 38.8666 369.333 38.2C367.867 37.5333 364.933 35.8 362.667 34.3333C360.533 32.8666 357.733 31.4 356.667 30.8666C355.6 30.4666 353.733 29.5333 352.667 28.8666C351.6 28.2 349.733 27.2667 348.667 26.8666C347.6 26.4666 342.8 24.2 338 22.0667C321.467 14.6 314.667 11.9333 307.2 10.4666C304.667 9.93332 301.733 8.99997 300.8 8.46664C298.533 6.99997 283.6 3.79999 272 2.06665C259.467 0.333313 214 -0.333344 204 1.1333Z" fill="black"/>
          </svg>
        </div>

        {/* Text */}
        <div className="overlay-text" data-tauri-drag-region>
          <span className="overlay-title">Start AI Meeting Note</span>
          <span className="overlay-subtitle">Transcribing opens Lokus</span>
        </div>

        {/* Start button */}
        <div className="overlay-action" ref={dropdownRef}>
          <button className="start-btn" onClick={handleStart}>
            Start transcribing
          </button>
          <button
            className="start-chevron"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-label="More options"
          >
            <ChevronDown size={15} />
          </button>

          {dropdownOpen && (
            <div className="overlay-dropdown">
              <button onClick={() => { setDropdownOpen(false); handleStart(); }}>
                Start with default mic
              </button>
              <button onClick={() => { setDropdownOpen(false); handleClose(); }}>
                Dismiss for this meeting
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        html, body, #root {
          background: transparent !important;
          overflow: visible;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .overlay-root {
          display: flex;
          align-items: flex-start;
          gap: 0;
          padding: 6px 8px;
          width: 100vw;
          user-select: none;
          animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .overlay-root.closing {
          animation: slideUp 0.15s ease-in both;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideUp {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-10px); }
        }

        /* Left control buttons — outside the card */
        .overlay-controls {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-right: 4px;
          flex-shrink: 0;
        }

        .ctrl-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ctrl-btn:hover {
          color: rgba(255,255,255,0.8);
        }

        /* Main card */
        .overlay-card {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 10px 12px 10px 14px;
          border-radius: 12px;
          background: rgba(50, 50, 50, 0.75);
          backdrop-filter: blur(50px) saturate(180%);
          -webkit-backdrop-filter: blur(50px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow:
            0 8px 32px rgba(0,0,0,0.4),
            0 2px 8px rgba(0,0,0,0.2),
            inset 0 1px 0 rgba(255,255,255,0.06);
        }

        /* App icon — white rounded square */
        .overlay-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        /* Text block */
        .overlay-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .overlay-title {
          font-size: 14px;
          font-weight: 600;
          color: white;
          line-height: 1.2;
        }

        .overlay-subtitle {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
          line-height: 1.2;
        }

        /* Action button group */
        .overlay-action {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          position: relative;
        }

        .start-btn {
          height: 36px;
          padding: 0 18px;
          border: none;
          border-radius: 10px 0 0 10px;
          background: linear-gradient(180deg, #4A9EFF 0%, #2F81F7 100%);
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .start-btn:hover {
          background: linear-gradient(180deg, #5BA8FF 0%, #388BF9 100%);
        }

        .start-btn:active {
          transform: scale(0.98);
        }

        .start-chevron {
          height: 36px;
          width: 32px;
          border: none;
          border-radius: 0 10px 10px 0;
          background: linear-gradient(180deg, #4A9EFF 0%, #2F81F7 100%);
          border-left: 1px solid rgba(255,255,255,0.2);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }

        .start-chevron:hover {
          background: linear-gradient(180deg, #5BA8FF 0%, #388BF9 100%);
        }

        /* Dropdown */
        .overlay-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 6px);
          width: 200px;
          border-radius: 10px;
          background: rgba(40, 40, 40, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
          padding: 4px;
          z-index: 100;
        }

        .overlay-dropdown button {
          display: block;
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: rgba(255,255,255,0.8);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: all 0.1s;
        }

        .overlay-dropdown button:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }
      `}</style>
    </div>
  );
}
