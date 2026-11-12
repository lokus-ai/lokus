/** @part-of ui.page-header */
import { useEffect, useState } from "react";

/** Built-in covers, stored in frontmatter as `cover: <name>`. */
export const COVERS = ["dawn", "moss", "ocean", "plum", "sand", "slate"];
export const ICONS = ["📄", "📝", "💡", "🚀", "🎯", "📚", "🧭", "🌱", "🔥", "⭐", "🧠", "🗂️", "🛠️", "📌", "🎨", "☕"];

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

interface Props {
  path: string;
  properties: Record<string, string>;
  onRename(name: string): void;
  onProperty(key: string, value: string | null): void;
  onEnter(): void;
}

/** Cover, icon and title above the note, Notion style. All of it is frontmatter. */
export function PageHeader({ path, properties, onRename, onProperty, onEnter }: Props) {
  const name = path.split("/").pop()!.replace(/\.md$/i, "");
  const [title, setTitle] = useState(name);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    setTitle(name);
    setPicking(false);
  }, [name, path]);

  const { cover, icon } = properties;
  const isImage = cover ? /^https?:\/\//.test(cover) : false;
  const commit = () => {
    const next = title.trim().replace(/[\\/:]/g, "-");
    if (next && next !== name) onRename(next);
    else setTitle(name);
  };

  return (
    <header className={`page-header${cover ? " has-cover" : ""}`}>
      {cover && (
        <div
          className={`cover${isImage ? "" : ` cover-${COVERS.includes(cover) ? cover : "slate"}`}`}
          style={isImage ? { backgroundImage: `url("${encodeURI(cover)}")` } : undefined}
        >
          <div className="cover-actions">
            <button onClick={() => onProperty("cover", pick(COVERS.filter((c) => c !== cover)))}>Change</button>
            <button onClick={() => onProperty("cover", null)}>Remove</button>
          </div>
        </div>
      )}
      <div className="page-column">
        {icon && (
          <button className="page-icon" title="Change icon" onClick={() => setPicking((p) => !p)}>
            {icon}
          </button>
        )}
        {(!icon || !cover) && (
          <div className="page-ghosts">
            {!icon && <button onClick={() => onProperty("icon", pick(ICONS))}>Add icon</button>}
            {!cover && <button onClick={() => onProperty("cover", pick(COVERS))}>Add cover</button>}
          </div>
        )}
        {picking && (
          <div className="icon-picker">
            {ICONS.map((i) => (
              <button
                key={i}
                onClick={() => {
                  onProperty("icon", i);
                  setPicking(false);
                }}
              >
                {i}
              </button>
            ))}
            <button
              className="icon-remove"
              onClick={() => {
                onProperty("icon", null);
                setPicking(false);
              }}
            >
              Remove
            </button>
          </div>
        )}
        <input
          className="page-title"
          value={title}
          placeholder="Untitled"
          spellCheck={false}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
              onEnter();
            }
            if (e.key === "Escape") {
              setTitle(name);
              e.currentTarget.blur();
            }
          }}
        />
      </div>
    </header>
  );
}
