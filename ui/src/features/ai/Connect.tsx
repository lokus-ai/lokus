/** @part-of ui.ai */
import { useCallback, useEffect, useState } from "react";

import { aiSettings, chatgptLogin, saveAiConfig, setAiSecret } from "../../bridge/ai";
import { track } from "../../bridge/analytics";
import { useStore } from "../../shell/store";
import { app } from "../../shell/workspace";

/**
 * Whether the assistant has a model to think with. Null while it is being found out. If the
 * person is signed in to ChatGPT but another provider is chosen with no key, ChatGPT is used:
 * a working assistant beats a correct setting.
 */
export function useModel(): { ready: boolean | null; recheck(): void } {
  const [ready, setReady] = useState<boolean | null>(null);
  const settingsOpen = useStore(app, (s) => s.settings);
  const recheck = useCallback(() => {
    void aiSettings().then(
      async (s) => {
        if (s.keys[s.config.provider]) return setReady(true);
        if (s.keys.chatgpt) {
          await saveAiConfig({ ...s.config, provider: "chatgpt", model: "", base_url: "" }).catch(() => {});
          return setReady(true);
        }
        setReady(false);
      },
      () => setReady(false),
    );
  }, []);
  // Looked at again whenever Settings closes: a key can be pasted there too.
  useEffect(recheck, [recheck, settingsOpen]);
  return { ready, recheck };
}

const KEYS = { anthropic: "Claude", openai: "OpenAI" } as const;

/**
 * What shows in place of the question box until a model is connected. A key is pasted right
 * here: first-run setup has no Settings to send anyone to.
 */
export function ConnectModel({ onDone, from }: { onDone(): void; from: "panel" | "setup" }) {
  const [waiting, setWaiting] = useState(false);
  const [problem, setProblem] = useState("");
  const [keyFor, setKeyFor] = useState<keyof typeof KEYS | "">("");
  const [key, setKey] = useState("");
  const connect = async (provider: "chatgpt" | keyof typeof KEYS, prove: () => Promise<void>) => {
    setProblem("");
    setWaiting(true);
    try {
      await prove();
      const { config } = await aiSettings();
      // The address was typed for another provider: this key or sign-in is never sent there.
      // A ChatGPT plan and an OpenAI key name their models alike, so the model stays across
      // that switch, as it does in Settings. Connecting the same provider again keeps it too.
      const alike = provider === config.provider || (provider !== "anthropic" && config.provider !== "anthropic");
      const model = alike && !config.base_url ? config.model : "";
      await saveAiConfig({ ...config, provider, model, base_url: "" });
      track("connection_added", { service: provider, from });
      onDone();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
    setWaiting(false);
  };
  return (
    <div className="ai-connect">
      <button className="primary" disabled={waiting} onClick={() => void connect("chatgpt", chatgptLogin)}>
        {waiting && !keyFor ? "Waiting for your browser…" : "Sign in with ChatGPT"}
      </button>
      <small>Uses the ChatGPT plan you already have. Nothing extra to pay.</small>
      {keyFor ? (
        <form
          className="ai-connect-key"
          // Enter saves the key; in first-run setup it would otherwise move on to the next question.
          onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) void connect(keyFor, () => setAiSecret("provider", keyFor, key.trim()));
          }}
        >
          <div className="segmented">
            {(Object.keys(KEYS) as (keyof typeof KEYS)[]).map((k) => (
              <button type="button" key={k} className={k === keyFor ? "active" : ""} onClick={() => setKeyFor(k)}>
                {KEYS[k]}
              </button>
            ))}
          </div>
          <input type="password" value={key} placeholder={`Paste your ${KEYS[keyFor]} key`} aria-label={`${KEYS[keyFor]} key`} onChange={(e) => setKey(e.target.value)} autoComplete="off" autoFocus />
          <button className="settings-button" disabled={waiting || !key.trim()}>
            Save
          </button>
          <small>Kept in this computer’s keychain. Requests go straight from Lokus to {KEYS[keyFor]}.</small>
        </form>
      ) : (
        <button className="settings-button" onClick={() => setKeyFor("anthropic")}>
          I have a Claude or OpenAI key
        </button>
      )}
      {problem && <p className="ai-connect-problem">{problem}</p>}
    </div>
  );
}
