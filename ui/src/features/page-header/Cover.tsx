/** @part-of ui.page-header */
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";

import { Icon } from "../../shell/Icon";

/**
 * Covers are stored in frontmatter as `cover: <value>`: one of these built-in names, a picture in
 * the vault (`attachments/hills.jpg`), or a web address.
 */
export const COVERS = ["dawn", "ember", "rose", "plum", "ocean", "lagoon", "moss", "sand", "mist", "slate", "graphite", "night"];

/**
 * How a cover is framed, stored as `cover_layout: tall page 50 30 1.4`: its height, whether it
 * spans the window or the page column, and for a picture the point kept in view (x and y, in
 * percent) and the zoom. The picture file itself is never changed.
 */
interface Layout {
  height: "short" | "medium" | "tall";
  width: "full" | "page";
  x: number;
  y: number;
  zoom: number;
}

const PLAIN: Layout = { height: "medium", width: "full", x: 50, y: 50, zoom: 1 };
const HEIGHTS = ["short", "medium", "tall"] as const;
const WIDTHS = ["full", "page"] as const;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function readLayout(raw: string | undefined): Layout {
  const out = { ...PLAIN };
  const numbers: number[] = [];
  for (const word of (raw ?? "").toLowerCase().split(/\s+/)) {
    if ((HEIGHTS as readonly string[]).includes(word)) out.height = word as Layout["height"];
    else if ((WIDTHS as readonly string[]).includes(word)) out.width = word as Layout["width"];
    else if (word && Number.isFinite(Number(word))) numbers.push(Number(word));
  }
  if (numbers.length >= 2) {
    out.x = clamp(numbers[0], 0, 100);
    out.y = clamp(numbers[1], 0, 100);
  }
  if (numbers.length >= 3) out.zoom = clamp(numbers[2], 1, 3);
  return out;
}

/** Null when nothing differs from the plain framing, so the property is not written at all. */
function writeLayout(l: Layout): string | null {
  const framed = l.x !== 50 || l.y !== 50 || l.zoom !== 1;
  const words = [l.height !== "medium" ? l.height : "", l.width !== "full" ? l.width : "", framed ? `${Math.round(l.x)} ${Math.round(l.y)} ${Number(l.zoom.toFixed(2))}` : ""];
  return words.filter(Boolean).join(" ") || null;
}

interface Props {
  cover: string;
  layout: string | undefined;
  onProperty(key: string, value: string | null): void;
  /** A loadable address for a picture in the vault or on the web; null if it cannot be found. */
  resolveImage(src: string): string | null;
  /** Save a picture beside the note and give back the path to store. */
  saveImage(file: File): Promise<string | null>;
}

/** The band above a note's title: a gradient or a picture, which can be swapped, framed and resized. */
export function Cover({ cover, layout, onProperty, resolveImage, saveImage }: Props) {
  const [picking, setPicking] = useState(false);
  const [tab, setTab] = useState<"gallery" | "upload" | "link">("gallery");
  const [link, setLink] = useState("");
  const [over, setOver] = useState(false);
  /** The framing being tried out; null when not adjusting. */
  const [draft, setDraft] = useState<Layout | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);
  const upload = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!picking) return;
    const close = () => setPicking(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [picking]);
  useEffect(() => {
    if (!draft) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setDraft(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [draft]);

  const image = COVERS.includes(cover) ? null : resolveImage(cover);
  const validLink = /^https?:\/\/\S+$/.test(link.trim());
  const l = draft ?? readLayout(layout);

  const setCover = (value: string | null) => {
    onProperty("cover", value);
    // A new picture starts centred; the height and width chosen for the page stay.
    const kept = writeLayout({ ...readLayout(layout), x: 50, y: 50, zoom: 1 });
    if (value === null || kept !== (layout ?? null)) onProperty("cover_layout", value === null ? null : kept);
    setPicking(false);
    setLink("");
  };
  const useFile = async (file: File | undefined) => {
    if (!file?.type.startsWith("image/")) return;
    const saved = await saveImage(file);
    if (saved) setCover(decodeURI(saved));
  };

  /** Drag the picture inside its frame; it moves with the pointer and stops at its own edges. */
  const startDrag = (e: ReactPointerEvent) => {
    const el = picture.current;
    const frame = box.current;
    if (!draft || !el?.naturalWidth || !frame || (e.target as HTMLElement).closest(".cover-adjust")) return;
    e.preventDefault();
    const rect = frame.getBoundingClientRect();
    const scale = Math.max((rect.width * draft.zoom) / el.naturalWidth, (rect.height * draft.zoom) / el.naturalHeight);
    const roomX = el.naturalWidth * scale - rect.width;
    const roomY = el.naturalHeight * scale - rect.height;
    const from = { px: e.clientX, py: e.clientY, x: draft.x, y: draft.y };
    const move = (ev: PointerEvent) => {
      setDraft((d) =>
        d && {
          ...d,
          x: roomX > 1 ? clamp(from.x - ((ev.clientX - from.px) / roomX) * 100, 0, 100) : d.x,
          y: roomY > 1 ? clamp(from.y - ((ev.clientY - from.py) / roomY) * 100, 0, 100) : d.y,
        },
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const band = (
    <div
      ref={box}
      className={`cover cover-${l.height}${image ? "" : ` cover-${COVERS.includes(cover) ? cover : "slate"}`}${over ? " over" : ""}${draft ? " adjusting" : ""}${draft && image ? " movable" : ""}`}
      onPointerDown={startDrag}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void useFile(e.dataTransfer.files[0]);
      }}
    >
      {image && (
        <div className="cover-clip">
          <img
            ref={picture}
            src={image}
            alt=""
            draggable={false}
            style={{ width: `${l.zoom * 100}%`, height: `${l.zoom * 100}%`, left: `${-(l.zoom - 1) * l.x}%`, top: `${-(l.zoom - 1) * l.y}%`, objectPosition: `${l.x}% ${l.y}%` }}
          />
        </div>
      )}
      {draft ? (
        <>
          {image && <p className="cover-hint">Drag the picture to reposition it</p>}
          <div className="cover-adjust">
            {image && (
              <label>
                Zoom
                <input type="range" min={1} max={3} step={0.02} value={draft.zoom} onChange={(e) => setDraft({ ...draft, zoom: Number(e.target.value) })} />
              </label>
            )}
            <div className="segmented">
              {HEIGHTS.map((h) => (
                <button key={h} className={draft.height === h ? "active" : ""} onClick={() => setDraft({ ...draft, height: h })}>
                  {h === "short" ? "Short" : h === "medium" ? "Medium" : "Tall"}
                </button>
              ))}
            </div>
            <div className="segmented">
              {WIDTHS.map((w) => (
                <button key={w} className={draft.width === w ? "active" : ""} onClick={() => setDraft({ ...draft, width: w })}>
                  {w === "full" ? "Full width" : "Page width"}
                </button>
              ))}
            </div>
            <span className="cover-adjust-end">
              <button onClick={() => setDraft(null)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  onProperty("cover_layout", writeLayout(draft));
                  setDraft(null);
                }}
              >
                Save
              </button>
            </span>
          </div>
        </>
      ) : (
        <div className={`cover-actions${picking ? " open" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={() => setPicking((p) => !p)}>Change cover</button>
          <button
            onClick={() => {
              setPicking(false);
              setDraft(readLayout(layout));
            }}
          >
            {image ? "Reposition" : "Resize"}
          </button>
          {picking && (
            <div className="cover-picker">
              <div className="cover-tabs">
                {(["gallery", "upload", "link"] as const).map((t) => (
                  <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                    {t === "gallery" ? "Gallery" : t === "upload" ? "Upload" : "Link"}
                  </button>
                ))}
                <button className="cover-remove" onClick={() => setCover(null)}>
                  Remove
                </button>
              </div>
              {tab === "gallery" && (
                <div className="cover-gallery">
                  {COVERS.map((c) => (
                    <button key={c} className={`cover-${c}${c === cover ? " active" : ""}`} aria-label={c} onClick={() => setCover(c)} />
                  ))}
                </div>
              )}
              {tab === "upload" && (
                <div className="cover-pane">
                  <button className="cover-choose" onClick={() => upload.current?.click()}>
                    <Icon name="addCover" />
                    Choose a picture
                  </button>
                  <p>Or drag one onto the cover. It is saved in the note's attachments folder.</p>
                  <input
                    ref={upload}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      void useFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
              {tab === "link" && (
                <form
                  className="cover-pane"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (validLink) setCover(link.trim());
                  }}
                >
                  <input className="cover-link" autoFocus placeholder="Paste a picture's link" value={link} spellCheck={false} onChange={(e) => setLink(e.target.value)} />
                  <button className="primary" disabled={!validLink}>
                    Use this picture
                  </button>
                  <p>Works with any picture on the web.</p>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
  return l.width === "page" ? <div className="page-column cover-inset">{band}</div> : band;
}
