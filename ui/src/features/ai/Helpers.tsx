/** @part-of ui.ai */
import { useEffect, useState } from "react";
import type { Helper, Stage } from "../../bridge/ai";
import { Icon } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { openNote } from "../../shell/workspace";
import { describe } from "./AiPanel";
import { type HelperRow, type Item, helpers, helperWork, stop, stopHelper } from "./chat";

const STATE: Record<Helper["state"], string> = { waiting: "Waiting", running: "Working", done: "Done", stopped: "Stopped", failed: "Failed" };
const MARK: Record<Helper["state"], string> = { waiting: "○", running: "●", done: "✓", stopped: "■", failed: "✕" };
const active = (row: HelperRow) => row.state === "running" || row.state === "waiting";

function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Counts once a second while something is working, so the times on the rows move. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [running]);
  return running ? now : Date.now();
}

/** What a row says beside the name: the step it is on, or how it ended. */
function line(row: HelperRow): string {
  if (row.state === "failed") return `Failed: ${row.error ?? "it could not finish"}`;
  if (row.state === "stopped") return `Stopped after ${row.steps} ${row.steps === 1 ? "step" : "steps"}`;
  if (row.state === "done") return `${row.steps} ${row.steps === 1 ? "step" : "steps"}${row.asked ? ", asked again" : ""}`;
  if (row.state === "waiting") return "Waiting for its turn";
  if (row.tool) return describe(row.tool, row.input ?? {});
  return row.asked ? "Asked again" : "Starting";
}

/** One helper: a button that unfolds to its brief, its steps and its answer. */
function Row({ row, now }: { row: HelperRow; now: number }) {
  const [open, setOpen] = useState(false);
  const [work, setWork] = useState<Helper | null>(null);
  useEffect(() => {
    if (open) void helperWork(row.id).then(setWork, () => setWork(null));
  }, [open, row.id, row.state, row.steps]);
  const time = row.began ? clock((row.ended ?? now) - row.began) : "";
  return (
    <li className={`ai-helper ${row.state}`}>
      <div className="ai-helper-line">
        <button className="ai-helper-head" aria-expanded={open} title={`Helper ${row.id}`} onClick={() => setOpen((o) => !o)}>
          <span className="ai-helper-mark" aria-hidden="true">
            {MARK[row.state]}
          </span>
          <span className="ai-helper-name">{row.name}</span>
          <span className="ai-helper-state">{STATE[row.state]}</span>
          <span className={`ai-helper-doing${row.state === "running" ? " ai-working" : ""}`}>{line(row)}</span>
          <small>{time}</small>
        </button>
        {active(row) && (
          <button className="ai-helper-stop" title={`Stop ${row.name}`} aria-label={`Stop ${row.name}`} onClick={() => stopHelper(row.id)}>
            <Icon name="stop" size={9} />
          </button>
        )}
      </div>
      {open && (
        <div className="ai-helper-work">
          <small>
            Helper {row.id}
            {row.asked ? ` · asked again ${row.asked === 1 ? "once" : `${row.asked} times`}` : ""}
          </small>
          {work?.task && (
            <dl>
              {(["goal", "context", "look_in", "return"] as const).map((key) => (
                <div key={key}>
                  <dt>{key === "look_in" ? "Look in" : key.replace(/^./, (c) => c.toUpperCase())}</dt>
                  <dd>{work.task?.[key]}</dd>
                </div>
              ))}
            </dl>
          )}
          {work?.calls && work.calls.length > 0 && (
            <ol>
              {work.calls.map((call, n) => (
                <li key={n}>{describe(call.name, call.input)}</li>
              ))}
            </ol>
          )}
          {work?.findings && (
            <button className="ai-helper-note" onClick={() => void openNote(work.findings!)}>
              {work.findings}
            </button>
          )}
          {work?.answer ? <pre className="ai-tool-detail">{work.answer}</pre> : row.state === "failed" && <p>{row.error}</p>}
        </div>
      )}
    </li>
  );
}

function useRows(calls: string[]): HelperRow[] {
  const rows = useStore(helpers, (s) => s.rows);
  return Object.values(rows)
    .filter((row) => calls.includes(row.call))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

function Rows({ rows, now }: { rows: HelperRow[]; now: number }) {
  return (
    <ul className="ai-helper-rows">
      {rows.map((row) => (
        <Row key={row.id} row={row} now={now} />
      ))}
    </ul>
  );
}

const total = (rows: HelperRow[], now: number) => {
  const began = Math.min(...rows.map((r) => r.began || now));
  const ended = Math.max(...rows.map((r) => r.ended ?? now));
  return clock(ended - began);
};
const stepsOf = (rows: HelperRow[]) => rows.reduce((sum, row) => sum + row.steps, 0);

/** The helpers one `delegate` started: a row each while any works, one line once all are done. */
export function HelperBlock({ calls, live }: { calls: string[]; live: boolean }) {
  const rows = useRows(calls);
  const working = rows.some(active);
  const now = useNow(working);
  const [open, setOpen] = useState(false);
  if (!rows.length) return live ? <div className="ai-helpers ai-working">Starting helpers…</div> : null;
  const done = rows.filter((r) => r.state === "done").length;
  const other = rows.filter((r) => r.state === "failed" || r.state === "stopped").length;
  if (!working && !open) {
    return (
      <div className="ai-helpers folded">
        <button className="ai-helpers-head" aria-expanded={false} onClick={() => setOpen(true)}>
          <span>
            {rows.length} {rows.length === 1 ? "helper" : "helpers"} · {stepsOf(rows)} steps · {total(rows, now)}
            {other ? ` · ${other} did not finish` : ""}
          </span>
          <Icon name="chevron" size={12} />
        </button>
      </div>
    );
  }
  return (
    <div className="ai-helpers">
      <div className="ai-helpers-top">
        <button className="ai-helpers-head" aria-expanded={true} disabled={working} onClick={() => setOpen(false)}>
          Helpers · {done} of {rows.length} done
        </button>
        {working && (
          <button className="ai-helpers-stop" onClick={() => stopHelper()}>
            Stop all
          </button>
        )}
      </div>
      <Rows rows={rows} now={now} />
    </div>
  );
}

const STAGES: [Stage, string][] = [
  ["plan", "Plan"],
  ["gather", "Gather"],
  ["check", "Check"],
  ["report", "Report"],
  ["changes", "Changes"],
];

/** A research run as one card: its five stages, the helpers inside Gather, and what it changed. */
export function ResearchCard({ card, calls, live, changes }: { card: Extract<Item, { kind: "research" }>; calls: string[]; live: boolean; changes: { text: string; path?: string }[] }) {
  const rows = useRows(calls);
  const working = rows.some(active);
  const now = useNow(working);
  const at = STAGES.findIndex(([stage]) => stage === card.stage);
  return (
    <section className="ai-research" aria-label={`Research: ${card.topic}`}>
      <header>
        <strong>Research</strong>
        <span className="tree-name">{card.topic}</span>
        {live && (
          <button className="ai-helpers-stop" onClick={stop}>
            Stop
          </button>
        )}
      </header>
      <ol className="ai-stages">
        {STAGES.map(([stage, label], n) => {
          const state = n < at || (n === at && !live) ? "done" : n === at ? "running" : "waiting";
          const note = card.notes[stage];
          return (
            <li key={stage} className={`ai-stage ${state}`}>
              <div className="ai-stage-line">
                <span className="ai-helper-mark" aria-hidden="true">
                  {MARK[state]}
                </span>
                <span className="ai-stage-name">{label}</span>
                <span className="ai-helper-state">{state === "done" ? "Done" : state === "running" ? "Now" : "Not yet"}</span>
                {stage === "gather" && rows.length > 0 ? (
                  <span className="ai-helper-doing">
                    {rows.filter((r) => !active(r)).length} of {rows.length} helpers done · {stepsOf(rows)} steps
                  </span>
                ) : (
                  note && (
                    <button className="ai-helper-note" onClick={() => void openNote(note)}>
                      {note}
                    </button>
                  )
                )}
              </div>
              {stage === "gather" && rows.length > 0 && <Rows rows={rows} now={now} />}
              {stage === "changes" && changes.length > 0 && (
                <ul className="ai-changes">
                  {changes.map((change, i) => (
                    <li key={i}>
                      {change.path ? (
                        <button className="ai-helper-note" onClick={() => void openNote(change.path!)}>
                          {change.text}
                        </button>
                      ) : (
                        change.text
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
