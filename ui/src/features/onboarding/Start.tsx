/** @part-of ui.onboarding */
import { useEffect, useState } from "react";

import { aiSettings } from "../../bridge/ai";
import { formatKeys, runCommand } from "../../shell/commands";
import { Icon, type IconName } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { allNotes, app, openNote } from "../../shell/workspace";
import { Logo } from "../connections/logos";
import { NoticedOnStart } from "../noticed/NoticedList";
import { useMe } from "../profile/profiles";
import { aimInWords, keptAnswers } from "./onboarding";

interface Card {
  command: string;
  icon: IconName;
  title: string;
  about: string;
  keys?: string;
  /** The setup answer that moves this card to the front. */
  use?: string;
}

const CARDS: Card[] = [
  { command: "customers.open", icon: "customers", title: "Customers", about: "Who is waiting on you", keys: "Mod-Shift-c", use: "customers" },
  { command: "tasks.open", icon: "board", title: "Tasks", about: "The board your team works from", keys: "Mod-Shift-t", use: "tasks" },
  { command: "note.new", icon: "compose", title: "New note", about: "Start writing", keys: "Mod-n" },
  { command: "ai.open", icon: "assistant", title: "Ask the assistant", about: "It knows your notes and tools", keys: "Mod-j" },
];

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** What shows when nothing is open: where to go next, chosen by what they said they are here for. */
export function Start() {
  const me = useMe();
  const tree = useStore(app, (s) => s.tree);
  const [connected, setConnected] = useState<string[] | null>(null);
  const answers = keptAnswers();
  useEffect(() => void aiSettings().then((s) => setConnected(s.config.mcp.map((m) => m.name)), () => setConnected([])), []);

  const uses = answers?.uses ?? [];
  const cards = [...CARDS].sort((a, b) => Number(uses.includes(b.use ?? "")) - Number(uses.includes(a.use ?? "")));
  const notes = allNotes(tree)
    .filter((path) => !path.includes("/") && !["Customers.md", "Tasks.md", "Assistant.md"].includes(path))
    .slice(0, 6);
  const aim = answers ? aimInWords(answers) : "";
  const waiting = connected ? (answers?.tools ?? []).filter((id) => !connected.includes(id)) : [];
  const first = (me?.name ?? "").split(" ")[0];

  return (
    <div className="start">
      <div className="start-inner">
        <h1>
          {greeting()}
          {first ? `, ${first}` : ""}
        </h1>
        <p className="start-sub">Where do you want to start?</p>
        {aim && (
          <p className="start-aim">
            <b>What matters here</b>
            {aim}
          </p>
        )}
        <div className="start-grid">
          {cards.map((card) => (
            <button key={card.command} className="start-card" onClick={() => void runCommand(card.command)}>
              <span>
                <Icon name={card.icon} size={16} />
              </span>
              <span>
                <strong>{card.title}</strong>
                <small>{card.about}</small>
              </span>
              {card.keys && <kbd>{formatKeys(card.keys)}</kbd>}
            </button>
          ))}
        </div>

        <NoticedOnStart />

        {waiting.length > 0 && (
          <div className="start-tools">
            {waiting.slice(0, 4).map((id) => (
              <Logo key={id} id={id} name={id} size={24} />
            ))}
            <span>You said you use {waiting.length === 1 ? "this" : "these"}. Connect {waiting.length === 1 ? "it" : "them"} and what happens there shows up here.</span>
            <button className="settings-button" onClick={() => void runCommand("settings.open", { page: "connections" })}>
              Connect
            </button>
          </div>
        )}

        {notes.length > 0 ? (
          <>
            <h2>Notes</h2>
            <div className="start-notes">
              {notes.map((path) => (
                <button key={path} onClick={() => void openNote(path)}>
                  <Icon name="note" size={14} />
                  {path.replace(/\.md$/, "")}
                </button>
              ))}
              <button onClick={() => void runCommand("palette.notes")}>
                <Icon name="goto" size={14} />
                Go to any note
                <kbd style={{ marginLeft: "auto" }}>{formatKeys("Mod-o")}</kbd>
              </button>
            </div>
          </>
        ) : (
          <div className="start-tools">
            <span>This folder has no notes yet. Want a few examples to look around with?</span>
            <button className="settings-button" onClick={() => void runCommand("vault.examples")}>
              Add example notes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
