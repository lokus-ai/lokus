/** @part-of ui.ai */
import { useCallback, useEffect, useState } from "react";

import { aiSettings, chatgptLogin, saveAiConfig } from "../../bridge/ai";
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
          await saveAiConfig({ ...s.config, provider: "chatgpt", model: "" }).catch(() => {});
          return setReady(true);
        }
        setReady(false);
      },
      () => setReady(false),
    );
  }, []);
  // Looked at again whenever Settings closes: that is where a key gets pasted.
  useEffect(recheck, [recheck, settingsOpen]);
  return { ready, recheck };
}

/** What shows in place of the question box until a model is connected. */
export function ConnectModel({ onDone, from }: { onDone(): void; from: "panel" | "setup" }) {
  const [waiting, setWaiting] = useState(false);
  const [problem, setProblem] = useState("");
  const chatgpt = async () => {
    setProblem("");
    setWaiting(true);
    try {
      await chatgptLogin();
      const { config } = await aiSettings();
      await saveAiConfig({ ...config, provider: "chatgpt", model: "" });
      track("connection_added", { service: "chatgpt", from });
      onDone();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
    setWaiting(false);
  };
  return (
    <div className="ai-connect">
      <button className="primary" disabled={waiting} onClick={() => void chatgpt()}>
        {waiting ? "Waiting for your browser…" : "Sign in with ChatGPT"}
      </button>
      <small>Uses the ChatGPT plan you already have. Nothing extra to pay.</small>
      <button className="settings-button" onClick={() => app.set({ settings: "assistant" })}>
        I have a Claude or OpenAI key
      </button>
      {problem && <p className="ai-connect-problem">{problem}</p>}
    </div>
  );
}
