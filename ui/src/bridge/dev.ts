/** @part-of ui.bridge */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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
  if (!import.meta.env.DEV) return;
  void listen<DevRequest>("dev:run", async ({ payload }) => {
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
