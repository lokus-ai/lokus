/** @part-of ui.page-header */
import { useEffect, useRef, useState } from "react";

import { Icon } from "../../shell/Icon";
import { Cover, COVERS } from "./Cover";

export const ICONS = ["📄", "📝", "💡", "🚀", "🎯", "📚", "🧭", "🌱", "🔥", "⭐", "🧠", "🗂️", "🛠️", "📌", "🎨", "☕"];

/** A page's icon is an emoji, or a picture: a file in the vault or a web address. */
export const isPicture = (icon: string | undefined): icon is string => !!icon && (/^(https?:|data:image\/)/i.test(icon) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(icon));

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

interface Props {
  path: string;
  properties: Record<string, string>;
  onRename(name: string): void;
  onProperty(key: string, value: string | null): void;
  onEnter(): void;
  /** A loadable address for a picture in the vault or on the web; null if it cannot be found. */
  resolveImage(src: string): string | null;
  /** Save a picture beside the note and give back the path to store. */
  saveImage(file: File): Promise<string | null>;
}

/** Cover, icon and title above the note, Notion style. All of it is frontmatter. */
export function PageHeader({ path, properties, onRename, onProperty, onEnter, resolveImage, saveImage }: Props) {
  const name = path.split("/").pop()!.replace(/\.md$/i, "");
  const [title, setTitle] = useState(name);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    setTitle(name);
    setPicking(false);
  }, [name, path]);

  const { cover, icon } = properties;
  const upload = useRef<HTMLInputElement>(null);
  // A customer or a person is shown by a picture (a logo, a face) rather than an emoji.
  const pictured = properties.type === "customer" || properties.type === "person";
  const picture = isPicture(icon) ? resolveImage(icon) : null;
  const usePicture = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const saved = await saveImage(file);
    if (saved) onProperty("icon", saved);
    setPicking(false);
  };
  const commit = () => {
    const next = title.trim().replace(/[\\/:]/g, "-");
    if (next && next !== name) onRename(next);
    else setTitle(name);
  };

  return (
    <header className={`page-header${cover ? " has-cover" : ""}`}>
      {cover && <Cover key={path} cover={cover} layout={properties.cover_layout} onProperty={onProperty} resolveImage={resolveImage} saveImage={saveImage} />}
      <div className="page-column">
        <input
          ref={upload}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void usePicture(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {icon && (
          <button className={`page-icon${isPicture(icon) ? " picture" : ""}${properties.type === "person" ? " round" : ""}`} title="Change icon" onClick={() => setPicking((p) => !p)}>
            {isPicture(icon) ? picture ? <img src={picture} alt="" /> : <Icon name="addCover" size={28} /> : icon}
          </button>
        )}
        {(!icon || !cover) && (
          <div className="page-ghosts">
            {!icon && pictured && <button onClick={() => upload.current?.click()}><Icon name="addCover" size={14} />Add a picture</button>}
            {!icon && !pictured && <button onClick={() => onProperty("icon", pick(ICONS))}><Icon name="addIcon" size={14} />Add icon</button>}
            {!cover && <button onClick={() => onProperty("cover", pick(COVERS))}><Icon name="addCover" size={14} />Add cover</button>}
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
            <button className="icon-remove" onClick={() => upload.current?.click()}>
              Upload a picture
            </button>
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
