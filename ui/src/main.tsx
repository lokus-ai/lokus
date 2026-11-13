/** @part-of ui.shell */
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./shell/styles/tokens.css";
import "./shell/styles/app.css";
import "./editor/editor.css";
import "./shell/preferences";

import { createRoot } from "react-dom/client";

import { startAnalytics } from "./bridge/analytics";
import { serveDevCommands } from "./bridge/dev";
import { startPlugins } from "./features/plugins/host";
import { App } from "./shell/App";
import { installShortcuts, runCommand } from "./shell/commands";
import { registerAllCommands } from "./shell/registerCommands";
import { boot, saveAll } from "./shell/workspace";

void startAnalytics();
registerAllCommands();
installShortcuts();
serveDevCommands(runCommand);
startPlugins();
if (import.meta.env.DEV) void import("./shell/devCommands").then((m) => m.registerDevCommands());
window.addEventListener("blur", () => void saveAll());

createRoot(document.getElementById("root")!).render(<App />);
void boot();
