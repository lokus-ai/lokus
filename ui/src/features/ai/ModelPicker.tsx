/** @part-of ui.ai */
import { useEffect, useState } from "react";

import { aiModels, type AiSettings, aiSettings, saveAiConfig } from "../../bridge/ai";
import { Icon } from "../../shell/Icon";
import { useStore } from "../../shell/store";
import { app } from "../../shell/workspace";

const PROVIDERS = { anthropic: "Claude", openai: "OpenAI-compatible", chatgpt: "ChatGPT plan" } as const;
/** What an empty model setting means for each provider. */
const DEFAULT_MODEL = { anthropic: "Claude Opus 5.5", openai: "", chatgpt: "" } as const;

/** The model the next message goes to, chosen in the chat box. The provider and its key stay in Settings. */
export function ModelPicker() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // The provider or key may have changed while the settings dialog was open.
  const settingsOpen = useStore(app, (s) => s.settings !== null);

  useEffect(() => {
    if (settingsOpen) return;
    setModels(null);
    void aiSettings().then(setSettings, () => setSettings(null));
  }, [settingsOpen]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  if (!settings) return <span />;
  const { config } = settings;
  const ready = settings.keys[config.provider];
  const fallback = DEFAULT_MODEL[config.provider];
  const toSettings = () => {
    setOpen(false);
    app.set({ settings: "assistant" });
  };
  const toggle = () => {
    setOpen((o) => !o);
    setFilter("");
    if (!open && ready && models === null) {
      setProblem(null);
      void aiModels().then(setModels, (e) => {
        setModels([]);
        setProblem(e instanceof Error ? e.message : String(e));
      });
    }
  };
  const choose = (model: string) => {
    const next = { ...config, model };
    setSettings({ ...settings, config: next });
    setOpen(false);
    void saveAiConfig(next);
  };

  const wanted = filter.trim();
  const shown = (models ?? []).filter((m) => m.toLowerCase().includes(wanted.toLowerCase()));
  const typed = wanted && !(models ?? []).includes(wanted);

  return (
    <div className="ai-model" onMouseDown={(e) => e.stopPropagation()}>
      <button className={`ai-model-chip${open ? " open" : ""}`} title="Choose a model" onClick={toggle}>
        <span className="tree-name">{ready ? config.model || fallback || "Choose a model" : "Set up the assistant"}</span>
        <Icon name="down" size={12} />
      </button>
      {open && (
        <div className="ai-model-menu">
          {ready ? (
            <>
              <input autoFocus placeholder="Find or type a model" value={filter} spellCheck={false} onChange={(e) => setFilter(e.target.value)} onKeyDown={(e) => e.key === "Enter" && wanted && choose(shown[0] ?? wanted)} />
              <div className="ai-model-list">
                {fallback && !wanted && (
                  <button onClick={() => choose("")}>
                    <span className="tree-name">{fallback}</span>
                    <small>Default</small>
                    {!config.model && <Icon name="check" size={14} />}
                  </button>
                )}
                {shown.map((m) => (
                  <button key={m} onClick={() => choose(m)}>
                    <span className="tree-name">{m}</span>
                    {m === config.model && <Icon name="check" size={14} />}
                  </button>
                ))}
                {typed && (
                  <button onClick={() => choose(wanted)}>
                    <span className="tree-name">Use “{wanted}”</span>
                  </button>
                )}
                {models === null && <p>Loading models…</p>}
                {models !== null && shown.length === 0 && !typed && !fallback && <p>{problem ?? "No models listed. Type a model's name."}</p>}
              </div>
            </>
          ) : (
            <p className="ai-model-setup">{config.provider === "chatgpt" ? "Sign in with ChatGPT to choose a model." : "Add your key to choose a model."}</p>
          )}
          <footer>
            <span>{PROVIDERS[config.provider]}</span>
            <button onClick={toSettings}>{ready ? "Change provider" : "Open settings"}</button>
          </footer>
        </div>
      )}
    </div>
  );
}
