/** @part-of ui.onboarding */
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { aiConnectors, type Connector } from "../../bridge/ai";
import { track } from "../../bridge/analytics";
import { pickFolder } from "../../bridge/core";
import { Icon } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { app } from "../../shell/workspace";
import { Logo } from "../connections/logos";
import { ConnectModel, useModel } from "../ai/Connect";
import { useMe } from "../profile/profiles";
import { AIMS, aimInWords, type Answers, connectService, EMPTY, finish, HEARD, type Job, jobs, leaveOnboarding, LOOKS, type Option, TEAMS, USES, wear } from "./onboarding";
import { chime, done as doneSound, muteSounds, pop, soundsMuted, sweep, tick, wakeSounds } from "./sounds";

type Step = "hello" | "uses" | "aim" | "team" | "look" | "assistant" | "tools" | "heard" | "folder" | "building";

/** `--i` is a thing's place in line: the stylesheet turns it into when it arrives. */
const nth = (i: number) => ({ "--i": i }) as CSSProperties;

/** A heading that arrives a word at a time. */
function Said({ text, from = 0 }: { text: string; from?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span key={i} className="ob-word" style={nth(from + i)}>
          {word}{" "}
        </span>
      ))}
    </>
  );
}

function Choice({ option, on, index, onPick, big }: { option: Option; on: boolean; index: number; onPick(): void; big?: boolean }) {
  return (
    <button className={`ob-choice${on ? " on" : ""}${big ? " big" : ""}`} style={nth(index)} aria-pressed={on} onClick={onPick}>
      {option.icon && (
        <span className="ob-choice-icon">
          <Icon name={option.icon} size={big ? 18 : 16} />
        </span>
      )}
      <span className="ob-choice-text">
        <strong>{option.label}</strong>
        {option.hint && <small>{option.hint}</small>}
      </span>
      <span className="ob-check">
        <Icon name="check" size={12} />
      </span>
    </button>
  );
}

/**
 * A small picture of their Lokus that fills in as they answer: the pages they asked for appear
 * in its sidebar, their aim is pinned at the top, the tools they use line up to be connected.
 */
function Preview({ answers, name }: { answers: Answers; name: string }) {
  const pages = USES.filter((u) => answers.uses.includes(u.id));
  const aim = aimInWords(answers);
  const people = answers.team === "solo" ? 1 : answers.team === "small" ? 4 : answers.team === "large" ? 7 : 0;
  const empty = !pages.length && !aim && !people && !answers.tools.length;
  // The look they chose shows here at once: fewer, roomier rows when calm; more, tighter ones
  // with every detail and the assistant beside them when dense.
  const look = answers.look || "balanced";
  const rows = look === "calm" ? ["Waiting on us", ""] : look === "dense" ? ["Waiting on us", "", "At risk", "", "Waiting on us"] : ["Waiting on us", "", "At risk"];
  const columns = look === "calm" ? [1, 2, 1] : look === "dense" ? [3, 4, 2] : [2, 3, 1];
  return (
    <div className={`ob-mini look-${look}`} aria-hidden>
      <div className="ob-mini-side">
        <p>
          <i>{(name || "L").slice(0, 1).toUpperCase()}</i>
          {name ? `${name}’s Lokus` : "Your Lokus"}
        </p>
        {pages.map((p) => (
          <span key={p.id} className="ob-mini-row">
            {p.icon && <Icon name={p.icon} size={12} />}
            {p.label.replace(/^(Keeping up with|Running our|A team|My own) /, "").replace(/^./, (c) => c.toUpperCase())}
          </span>
        ))}
        {people > 0 && (
          <span className="ob-mini-team">
            {Array.from({ length: Math.min(people, 5) }, (_, i) => (
              <i key={i} style={nth(i)} />
            ))}
            {people > 5 && <em>+</em>}
          </span>
        )}
      </div>
      <div className="ob-mini-main">
        {empty && <p className="ob-mini-empty">Your Lokus takes shape here as you answer.</p>}
        {aim && (
          <div className="ob-mini-aim" key={aim}>
            <small>What matters here</small>
            {aim}
          </div>
        )}
        {answers.uses.includes("customers") && (
          <div className="ob-mini-table">
            {rows.map((chip, i) => (
              <span key={`${look}${i}`} style={nth(i)}>
                <i />
                <b />
                {look === "dense" && <u />}
                {chip && look !== "calm" && <em className={chip === "At risk" ? "risk" : ""}>{chip}</em>}
              </span>
            ))}
          </div>
        )}
        {answers.uses.includes("tasks") && (
          <div className="ob-mini-board">
            {columns.map((cards, column) => (
              <span key={`${look}${column}`}>
                {Array.from({ length: cards }, (_, i) => (
                  <i key={i} style={nth(column * 2 + i)} />
                ))}
              </span>
            ))}
          </div>
        )}
        {(answers.uses.includes("notes") || answers.uses.includes("meetings") || answers.uses.includes("wiki") || answers.uses.includes("personal")) && (
          <div className="ob-mini-note">
            <b />
            <i />
            <i />
            <i className="short" />
          </div>
        )}
        {answers.tools.length > 0 && (
          <div className="ob-mini-tools">
            {answers.tools.map((id, i) => (
              <span key={id} style={nth(i)}>
                <Logo id={id} name={id} size={22} />
              </span>
            ))}
          </div>
        )}
      </div>
      {look === "dense" && (
        <div className="ob-mini-chat">
          <small>Assistant</small>
          <i />
          <i className="short" />
          <b />
        </div>
      )}
    </div>
  );
}

/** The last screen: each thing the answers turn into, done in front of them. */
function Building({ answers, name, onOpen }: { answers: Answers; name: string; onOpen(): void }) {
  const list = useMemo<Job[]>(() => jobs(answers), [answers]);
  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      for (let i = 0; i < list.length; i++) {
        // Each line stays long enough to be read; the work itself is quicker than that.
        const pause = new Promise((r) => setTimeout(r, 700));
        try {
          await list[i].run();
        } catch (e) {
          setFailed(e instanceof Error ? e.message : String(e));
          return;
        }
        await pause;
        doneSound(i);
        setAt(i + 1);
      }
      setTimeout(chime, 250);
    })();
  }, [list]);
  const ready = at >= list.length;
  return (
    <section className="ob-ask building">
      <h1>{ready ? <Said key="ready" text={name ? `You’re all set, ${name}.` : "You’re all set."} /> : <Said text="Setting up your Lokus" />}</h1>
      <ul className="ob-jobs">
        {list.map((job, i) => (
          <li key={job.id} className={i < at ? "done" : i === at ? (failed ? "failed" : "doing") : ""} style={nth(i)}>
            <span className="ob-job-mark">{i < at ? <Icon name="check" size={12} /> : null}</span>
            {job.says}
          </li>
        ))}
      </ul>
      {failed && <p className="ob-problem">That step did not work: {failed}. You can open Lokus anyway and nothing is lost.</p>}
      {(ready || failed) && (
        <button className="primary ob-go" autoFocus onClick={onOpen}>
          Open Lokus
        </button>
      )}
    </section>
  );
}

/** The first-run setup. One question at a time, and a workspace made from the answers. */
export default function Onboarding() {
  const me = useMe();
  const vault = useStore(app, (s) => s.vault);
  const name = (me?.name ?? "").split(" ")[0];
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState<Step>("hello");
  const [catalog, setCatalog] = useState<Connector[]>([]);
  const [linked, setLinked] = useState<Record<string, "busy" | "done" | string>>({});
  const [muted, setMuted] = useState(soundsMuted());
  // Whether a folder was open when setup began decides if the folder question is asked at all.
  const model = useModel();
  // Asked only of someone with no model connected when setup began.
  const [needsModel, setNeedsModel] = useState(false);
  useEffect(() => {
    if (model.ready === false) setNeedsModel(true);
  }, [model.ready]);
  const hadVault = useRef(Boolean(vault));
  const order = useMemo<Step[]>(() => ["hello", "uses", "aim", "team", "look", ...(needsModel ? (["assistant"] as Step[]) : []), "tools", "heard", ...(hadVault.current ? [] : (["folder"] as Step[])), "building"], [needsModel]);
  const index = order.indexOf(step);
  const set = (patch: Partial<Answers>) => setAnswers((a) => ({ ...a, ...patch }));

  useEffect(() => void aiConnectors().then(setCatalog, () => {}), []);

  const optionCount = { hello: 0, uses: USES.length, aim: AIMS.length, team: TEAMS.length, look: LOOKS.length, assistant: 0, tools: catalog.length, heard: HEARD.length, folder: 2, building: 0 }[step];
  useEffect(() => {
    track("onboarding_step", { step });
    if (step !== "hello") sweep();
    // One tick per thing as it lands, in time with the stylesheet's delays.
    for (let i = 0; i < Math.min(optionCount, 12); i++) tick(i, 0.42 + i * 0.055);
  }, [step, optionCount]);

  const go = useCallback(
    (to: number) => {
      wakeSounds();
      setStep(order[Math.max(0, Math.min(order.length - 1, to))]);
    },
    [order],
  );
  const can =
    step === "uses" ? answers.uses.length > 0 : step === "aim" ? Boolean(answers.aim) && (answers.aim !== "other" || answers.aimText.trim().length > 1) : step === "team" ? Boolean(answers.team) : step === "look" ? Boolean(answers.look) : step !== "building";
  const next = useCallback(() => can && go(index + 1), [can, go, index]);
  const skip = () => leaveOnboarding(true, step);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement;
      if (e.key === "Enter" && step !== "building") {
        e.preventDefault();
        next();
      }
      if (e.key === "Escape" && typing) (e.target as HTMLInputElement).blur();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [next, step]);

  const toggle = (key: "uses" | "tools", id: string) => {
    wakeSounds();
    const has = answers[key].includes(id);
    pop(!has, answers[key].length);
    set({ [key]: has ? answers[key].filter((x) => x !== id) : [...answers[key], id] });
  };
  const choose = (key: "aim" | "team" | "heard" | "look", id: string, options: Option[]) => {
    wakeSounds();
    pop(true, options.findIndex((o) => o.id === id));
    set({ [key]: id });
  };
  const connect = async (c: Connector) => {
    setLinked((l) => ({ ...l, [c.id]: "busy" }));
    try {
      await connectService(c);
      doneSound(2);
      setLinked((l) => ({ ...l, [c.id]: "done" }));
    } catch (e) {
      setLinked((l) => ({ ...l, [c.id]: e instanceof Error ? e.message : String(e) }));
    }
  };

  const ready = catalog.filter((c) => c.ready === "yes");
  const coming = catalog.filter((c) => c.ready !== "yes");
  const picked = ready.filter((c) => answers.tools.includes(c.id));
  let ask: ReactNode = null;

  if (step === "hello") {
    ask = (
      <section className="ob-ask hello">
        <h1>
          <Said text={name ? `Hi ${name}.` : "Hi there."} />
        </h1>
        <p className="ob-line" style={nth(5)}>
          This is Lokus.
        </p>
        <p className="ob-line" style={nth(9)}>
          Your customers, your tasks and your notes in one place, with the linking done for you.
        </p>
        <p className="ob-line quiet" style={nth(15)}>
          A few questions so we can set it up around how you work. It takes about a minute.
        </p>
        <button className="primary ob-go" style={nth(19)} autoFocus onClick={() => go(1)}>
          Set it up
        </button>
      </section>
    );
  } else if (step === "uses") {
    ask = (
      <section className="ob-ask">
        <h1>
          <Said text="What will you use Lokus for?" />
        </h1>
        <p className="ob-sub">Choose as many as you like. Each one adds a page made for it.</p>
        <div className="ob-grid">
          {USES.map((o, i) => (
            <Choice key={o.id} option={o} index={i} big on={answers.uses.includes(o.id)} onPick={() => toggle("uses", o.id)} />
          ))}
        </div>
      </section>
    );
  } else if (step === "aim") {
    ask = (
      <section className="ob-ask">
        <h1>
          <Said text="A month from now, what would make it worth it?" />
        </h1>
        <p className="ob-sub">Pick the one that matters most. The assistant keeps it in mind.</p>
        <div className="ob-list">
          {AIMS.map((o, i) => (
            <Choice key={o.id} option={o} index={i} on={answers.aim === o.id} onPick={() => choose("aim", o.id, AIMS)} />
          ))}
        </div>
        {answers.aim === "other" && <input className="ob-input" autoFocus placeholder="In your own words" aria-label="What would make it worth it" maxLength={160} value={answers.aimText} onChange={(e) => set({ aimText: e.target.value })} />}
      </section>
    );
  } else if (step === "team") {
    ask = (
      <section className="ob-ask">
        <h1>
          <Said text="Who is it for?" />
        </h1>
        <p className="ob-sub">Lokus works for one person and for a team. You can invite people later.</p>
        <div className="ob-grid three">
          {TEAMS.map((o, i) => (
            <Choice key={o.id} option={o} index={i} big on={answers.team === o.id} onPick={() => choose("team", o.id, TEAMS)} />
          ))}
        </div>
      </section>
    );
  } else if (step === "look") {
    ask = (
      <section className="ob-ask">
        <h1>
          <Said text="How do you like your screen?" />
        </h1>
        <p className="ob-sub">Some people want room to think, some want everything in view. You can change this any time in Settings.</p>
        <div className="ob-grid three looks">
          {LOOKS.map((o, i) => (
            <button
              key={o.id}
              className={`ob-choice big ob-look ${o.id}${answers.look === o.id ? " on" : ""}`}
              style={nth(i)}
              aria-pressed={answers.look === o.id}
              onClick={() => {
                choose("look", o.id, LOOKS);
                wear(o.id);
              }}
            >
              <span className="ob-look-pic" aria-hidden>
                {Array.from({ length: o.id === "calm" ? 3 : o.id === "balanced" ? 4 : 6 }, (_, row) => (
                  <i key={row}>
                    <b />
                    {o.id !== "calm" && <em />}
                    {o.id === "dense" && <em />}
                  </i>
                ))}
              </span>
              <span className="ob-choice-text">
                <strong>{o.label}</strong>
                <small>{o.hint}</small>
              </span>
              <span className="ob-check">
                <Icon name="check" size={12} />
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  } else if (step === "assistant") {
    ask = (
      <section className="ask ob-ask">
        <h1>
          <Said text="Turn the assistant on" />
        </h1>
        <p className="ob-sub">It is what does the linking for you: reads what customers say, updates the board, tells you what needs you. It needs a model to think with.</p>
        {model.ready ? (
          <p className="ob-line" style={nth(0)}>
            Connected. It is ready.
          </p>
        ) : (
          <ConnectModel from="setup" onDone={model.recheck} />
        )}
      </section>
    );
  } else if (step === "tools") {
    ask = (
      <section className="ob-ask">
        <h1>
          <Said text="Which of these do you already use?" />
        </h1>
        <p className="ob-sub">Lokus can read them, so what your customers say and what your team is doing shows up here by itself.</p>
        <div className="ob-chips">
          {[...ready, ...coming].map((c, i) => (
            <button key={c.id} className={`ob-chip${answers.tools.includes(c.id) ? " on" : ""}`} style={nth(i)} aria-pressed={answers.tools.includes(c.id)} onClick={() => toggle("tools", c.id)}>
              <Logo id={c.id} name={c.name} size={20} />
              {c.name}
            </button>
          ))}
        </div>
        {picked.length > 0 && (
          <div className="ob-connect">
            <small>Connect them now, or later in Settings. Connecting opens your browser so you can sign in.</small>
            {picked.map((c) => {
              const state = linked[c.id];
              return (
                <div key={c.id} className="ob-connect-row">
                  <Logo id={c.id} name={c.name} size={24} />
                  <span>
                    {c.name}
                    {state && state !== "busy" && state !== "done" && <em>{state}</em>}
                  </span>
                  {state === "done" ? (
                    <b>
                      <Icon name="check" size={12} /> Connected
                    </b>
                  ) : (
                    <button className="settings-button" disabled={state === "busy"} onClick={() => void connect(c)}>
                      {state === "busy" ? "Waiting for your browser…" : state ? "Try again" : "Connect"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {answers.tools.some((id) => coming.some((c) => c.id === id)) && <p className="ob-note">{coming.filter((c) => answers.tools.includes(c.id)).map((c) => c.name).join(", ")}: not ready to connect yet. We have noted that you want it.</p>}
      </section>
    );
  } else if (step === "heard") {
    ask = (
      <section className="ob-ask">
        <h1>
          <Said text="Last one. Where did you hear about Lokus?" />
        </h1>
        <p className="ob-sub">It helps us find more people like you.</p>
        <div className="ob-chips">
          {HEARD.map((o, i) => (
            <button key={o.id} className={`ob-chip${answers.heard === o.id ? " on" : ""}`} style={nth(i)} aria-pressed={answers.heard === o.id} onClick={() => choose("heard", o.id, HEARD)}>
              {o.label}
            </button>
          ))}
        </div>
        {answers.heard === "other" && <input className="ob-input" autoFocus placeholder="Where was it?" aria-label="Where you heard about Lokus" maxLength={120} value={answers.heardText} onChange={(e) => set({ heardText: e.target.value })} />}
      </section>
    );
  } else if (step === "folder") {
    ask = (
      <section className="ob-ask">
        <h1>
          <Said text="Where should your notes live?" />
        </h1>
        <p className="ob-sub">They are ordinary files on your computer. You can open them in Finder any time, with or without Lokus.</p>
        <div className="ob-list">
          <Choice option={{ id: "default", label: "In Documents, in a folder called Lokus", hint: "Recommended. We make it for you.", icon: "folder" }} index={0} on={!answers.folder} onPick={() => set({ folder: "" })} />
          <Choice
            option={{ id: "pick", label: answers.folder ? answers.folder.split("/").slice(-2).join(" / ") : "Somewhere else", hint: answers.folder ? "Chosen. Click to change." : "Choose a folder you already have", icon: "open" }}
            index={1}
            on={Boolean(answers.folder)}
            onPick={() => void pickFolder().then((path) => path && set({ folder: path }))}
          />
        </div>
      </section>
    );
  } else {
    ask = <Building answers={answers} name={name} onOpen={() => void finish(answers)} />;
  }

  return (
    <div className="ob" data-step={step}>
      <header className="ob-top" data-tauri-drag-region>
        <span className="ob-dots" aria-label={`Step ${index + 1} of ${order.length}`}>
          {order.map((s, i) => (
            <i key={s} className={i < index ? "past" : i === index ? "now" : ""} />
          ))}
        </span>
        <button
          className="ob-quiet"
          title={muted ? "Turn sounds on" : "Turn sounds off"}
          onClick={() => {
            muteSounds(!muted);
            setMuted(!muted);
          }}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
        {step !== "building" && (
          <button className="ob-quiet" onClick={skip}>
            Skip setup
          </button>
        )}
      </header>
      <div className="ob-body">
        <div className="ob-left" key={step}>
          {ask}
        </div>
        {step !== "hello" && (
          <aside className="ob-right">
            <Preview answers={answers} name={name} />
          </aside>
        )}
      </div>
      {step !== "hello" && step !== "building" && (
        <footer className="ob-foot">
          <button className="link" onClick={() => go(index - 1)}>
            Back
          </button>
          <span />
          {(step === "tools" || step === "heard") && !(step === "tools" ? answers.tools.length : answers.heard) && (
            <button className="link" onClick={() => go(index + 1)}>
              {step === "tools" ? "None of these" : "Skip this one"}
            </button>
          )}
          {step === "assistant" && !model.ready && (
            <button className="link" onClick={() => go(index + 1)}>
              Later
            </button>
          )}
          <button className="primary" disabled={!can} onClick={next}>
            Continue
          </button>
        </footer>
      )}
    </div>
  );
}
