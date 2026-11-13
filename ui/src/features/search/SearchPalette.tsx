/** @part-of ui.search */
import { type ReactNode, useEffect, useRef, useState } from "react";

import { runCore, type SearchHit } from "../../bridge/core";

interface Props {
  onOpen(path: string): void;
  onClose(): void;
}

/** `[[[hit]]]` markers from the index become highlighted text. */
function highlight(snippet: string): ReactNode[] {
  return snippet.split(/\[\[\[|\]\]\]/).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/** Search inside every note. Results come from the Rust index as you type. */
export function SearchPalette({ onOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      void runCore<SearchHit[]>("search.query", { q: query, limit: 40 })
        .then((found) => {
          if (!current) return;
          setHits(found);
          setIndex(0);
        })
        .catch(() => current && setHits([]));
    }, 90);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    list.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const choose = (hit: SearchHit | undefined) => {
    if (!hit) return;
    onClose();
    onOpen(hit.path);
  };

  return (
    <div className="overlay top" onMouseDown={onClose}>
      <div className="palette wide" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder="Search in all notes…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "Enter") choose(hits[index]);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            }
          }}
        />
        <div className="palette-list" ref={list}>
          {hits.map((hit, i) => (
            <button
              key={hit.path}
              className={`search-row${i === index ? " active" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(hit)}
            >
              <span className="search-title">
                {hit.title}
                <span className="palette-hint">{hit.path.replace(/\.md$/i, "")}</span>
              </span>
              <span className="search-snippet">{highlight(hit.snippet.replace(/\s+/g, " "))}</span>
            </button>
          ))}
          {hits.length === 0 && <p className="palette-empty">{query.trim() ? "No notes match." : "Type to search."}</p>}
        </div>
      </div>
    </div>
  );
}
