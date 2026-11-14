/** @part-of ui.shell */
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./shell/styles/tokens.css";
import "./shell/styles/app.css";
import "./shell/styles/work.css";
import "./shell/styles/onboarding.css";
import "./shell/styles/density.css";
import "./editor/editor.css";
import "./shell/preferences";

import { createRoot } from "react-dom/client";

import { startAnalytics } from "./bridge/analytics";
import { DEV_CHANNEL, serveDevCommands } from "./bridge/dev";
import { isMainWindow } from "./bridge/core";
import { startOnboarding } from "./features/onboarding/onboarding";
import { startPlugins } from "./features/plugins/host";
import { startUpdates } from "./features/updates/updates";
import { App } from "./shell/App";
import { installShortcuts, runCommand } from "./shell/commands";
import { registerAllCommands } from "./shell/registerCommands";
import { boot, saveAll } from "./shell/workspace";

void startAnalytics();
registerAllCommands();
installShortcuts();
serveDevCommands(runCommand);
startPlugins();
if (DEV_CHANNEL) void import("./shell/devCommands").then((m) => m.registerDevCommands());
window.addEventListener("blur", () => void saveAll());

createRoot(document.getElementById("root")!).render(<App />);
// The setup and the update pop-up belong to the first window; a second one opens straight to work.
void boot().then(() => isMainWindow() && startOnboarding());
if (isMainWindow()) startUpdates();
