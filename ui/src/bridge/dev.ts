/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** On in development, and in a test build made to be driven from a terminal. */
export const DEV_CHANNEL = import.meta.env.DEV || import.meta.env.VITE_LOKUS_DEV_CHANNEL === "1";

interface DevRequest {
  id: number;
  name: string;
  args: Record<string, unknown> | null;
}

/**
 * Dev builds only: lets `lokus app <command>` run UI commands in the live
 * app. The shell forwards the request; we answer with the command's result.
 */
export function serveDevCommands(run: (name: string, args: Record<string, unknown>) => unknown): void {
  if (!DEV_CHANNEL) return;
  // One window answers each request: the first one, unless `window=` names another.
  const me = getCurrentWindow().label;
  void listen<DevRequest>("dev:run", async ({ payload }) => {
    if (((payload.args?.window as string | undefined) ?? "main") !== me) return;
    let reply: unknown;
    try {
      const value = await run(payload.name, payload.args ?? {});
      reply = { ok: true, value: value ?? null };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      reply = { ok: false, error: { code: err.code ?? "ui_error", message: err.message ?? String(e) } };
    }
    await invoke("dev_reply", { id: payload.id, reply });
  });
}

/** The bytes at an address the window can load (a file in the vault). Used by scripts that stand in for a file chooser. */
export async function readAddress(address: string): Promise<Blob> {
  return (await fetch(address)).blob();
}
