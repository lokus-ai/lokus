/** @part-of ui.backlinks */
import { useEffect, useState } from "react";

import { type Mention, runCore } from "../../bridge/core";
import { Icon } from "../../shell/Icon";

interface Props {
  path: string;
  /** Changes whenever files or the index change, to refetch. */
  version: number;
  onOpen(path: string): void;
}

/** Notes that link to this one, with the line that does. */
export function Backlinks({ path, version, onOpen }: Props) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let current = true;
    void runCore<Mention[]>("links.backlinks", { path })
      .then((found) => current && setMentions(found))
      .catch(() => current && setMentions([]));
    return () => {
      current = false;
    };
  }, [path, version]);

  if (mentions.length === 0) return null;
  return (
    <section className="backlinks">
      <button className="backlinks-head" onClick={() => setOpen((o) => !o)}>
        <span className={`tree-caret${open ? " open" : ""}`}><Icon name="chevron" size={14} /></span>
        Linked mentions
        <span className="backlinks-count">{mentions.length}</span>
      </button>
      {open &&
        mentions.map((m) => (
          <button key={`${m.path}:${m.line}`} className="backlink" onClick={() => onOpen(m.path)}>
            <span className="backlink-title">{m.title}</span>
            <span className="backlink-context">{m.context}</span>
          </button>
        ))}
    </section>
  );
}
