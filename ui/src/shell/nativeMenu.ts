/** @part-of ui.shell */
import { isMainWindow } from "../bridge/core";
import { enableNativeCommands, nativeCommands, onNativeCommand, type NativeCommand } from "../bridge/menus";
import { onboarding } from "../features/onboarding/onboarding";
import { ownNativeShortcuts, runCommand } from "./commands";
import { app, getEditor, notify } from "./workspace";

/** Menu availability describes the visible surface; command implementations stay in the registry. */
function available(command: NativeCommand): boolean {
  const state = app.get();
  if (!state.ready) return false;
  if (command.id === "settings.open") return !onboarding.get().open && !state.accountDialog && !state.palette && (!!state.settings || !document.querySelector(".overlay, [role=dialog]"));
  if (state.settings || state.palette || state.accountDialog || onboarding.get().open || document.querySelector(".overlay, [role=dialog]")) return false;
  if (command.id === "note.close") return state.tabs.length > 0 || !isMainWindow();
  if (command.scope === "app") return true;
  if (!state.vault) return false;
  if (command.scope === "workspace") return true;
  if (command.scope === "tabs") return state.tabs.length > 1;
  if (state.view !== "note" || !state.active) return false;
  if (command.scope === "note") return true;
  return getEditor()?.view.contentDOM === document.activeElement;
}

export async function installNativeMenu(): Promise<void> {
  const commands = await nativeCommands();
  await onNativeCommand((id) => {
    const command = commands.find((c) => c.id === id);
    if (!command || !available(command)) return;
    // Settings is an opening action here, not a toggle that closes the dialog on a second click.
    const args = id === "settings.open" ? { page: app.get().settings ?? "appearance" } : {};
    void runCommand(id, args).catch((error) => notify(error instanceof Error ? error.message : String(error)));
  });
  const ids = commands.map((c) => c.id);
  let previous = "";
  const update = () => {
    const enabled = commands.filter(available).map((c) => c.id);
    ownNativeShortcuts(ids, enabled);
    const key = enabled.join(",");
    if (key === previous) return;
    previous = key;
    void enableNativeCommands(enabled).catch((error) => {
      previous = "";
      console.error("Could not update native menus", error);
    });
  };
  app.subscribe(update);
  onboarding.subscribe(update);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", () => queueMicrotask(update));
  // Dialogs from other features may mount without changing workspace state.
  new MutationObserver(update).observe(document.body, { childList: true, subtree: true });
  update();
}
