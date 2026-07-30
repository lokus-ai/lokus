import { useFeatureFlags } from '../contexts/RemoteConfigContext';
import { isDesktop } from '../platform/index.js';
import platformService from '../services/platform/PlatformService.js';

function Kbd({ children }) {
  return (
    <span className="font-mono text-[13px] px-[5px] py-[2px] rounded bg-app-panel-secondary text-app-text">
      {children}
    </span>
  );
}

/**
 * WelcomeScreen — shown when no file is open.
 * Vellum-style editorial landing: a plain reading column, no cards,
 * no accent tiles. Typography does the work.
 */
export default function WelcomeScreen({
  onCreateFile,
  onCreateFolder,
  onCreateCanvas,
  onOpenCommandPalette,
  recentFiles = [],
  onFileOpen,
}) {
  const featureFlags = useFeatureFlags();
  const mod = platformService.getModifierSymbol();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-10 pt-[12vh] pb-16">
        <h1 className="font-display text-[31px] leading-[1.15] font-bold tracking-[-0.01em] text-app-text mb-4">
          Welcome to Lokus
        </h1>
        <p className="text-[15px] leading-[1.72] text-app-text-secondary mb-12">
          Everything you write here is a plain markdown file in a folder you own.
          No database, no lock-in — move the folder and the vault moves with it.
        </p>

        <h2 className="font-display text-[22px] leading-[1.2] font-bold text-app-text mb-5">Start here</h2>
        <ul className="flex flex-col gap-[9px] text-[15px] leading-[1.6] text-app-text-secondary mb-12">
          <li>
            <button onClick={onCreateFile} className="hover:text-app-text transition-colors cursor-pointer">
              Press <Kbd>{mod}N</Kbd> to make your first note.
            </button>
          </li>
          <li className="text-app-text-secondary">
            Type <Kbd>[[</Kbd> to link one note to another.
          </li>
          <li>
            <button onClick={onOpenCommandPalette} className="hover:text-app-text transition-colors cursor-pointer">
              Press <Kbd>{mod}K</Kbd> for every command in the app.
            </button>
          </li>
          {featureFlags.enable_canvas && (
            <li>
              <button onClick={onCreateCanvas} className="hover:text-app-text transition-colors cursor-pointer">
                Open a canvas to think in diagrams.
              </button>
            </li>
          )}
        </ul>

        {recentFiles.length > 0 && (
          <>
            <h2 className="font-display text-[22px] leading-[1.2] font-bold text-app-text mb-5">Recent</h2>
            <ul className="flex flex-col gap-[2px] text-[15px] mb-12">
              {recentFiles.map((file, idx) => (
                <li key={idx}>
                  <button
                    onClick={() => onFileOpen?.(file)}
                    className="w-full text-left px-2 py-[6px] -mx-2 rounded-md text-app-text-secondary hover:bg-app-panel-secondary hover:text-app-text transition-colors truncate"
                  >
                    {file.name?.replace(/\.(md|txt|canvas)$/, '') ?? file.path?.split('/').pop()}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {isDesktop() && (
          <>
            <h2 className="font-display text-[22px] leading-[1.2] font-bold text-app-text mb-5">Make it yours</h2>
            <ul className="flex flex-col gap-[9px] text-[15px] leading-[1.6] text-app-text-secondary">
              <li><Kbd>{mod}S</Kbd> saves — though autosave usually gets there first.</li>
              <li><Kbd>{mod}P</Kbd> jumps to any file by name.</li>
              <li>Drag files onto a folder in the explorer to move them.</li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
