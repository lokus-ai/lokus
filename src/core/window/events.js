// Window-scoped event listening.
//
// Tauri's bare `listen()` subscribes with target { kind: "Any" }, which receives
// EVERY event in the app — including `emit_to(label)` events addressed to a
// different window. Under multi-window that turns every targeted event into an
// accidental broadcast (e.g. every workspace window switching to whichever
// workspace was activated last).
//
// `listenWindow` subscribes with target { kind: "Window", label: <this window> }.
// The handler still receives global broadcasts (`emit`, target Any) and events
// addressed to this window, but never events addressed to other windows.
//
// Use this for every frontend listener unless the handler genuinely needs to
// observe events addressed to other windows.
import { listen } from "@tauri-apps/api/event";
import { getWindowContext } from "./context.js";

export function listenWindow(event, handler) {
  return listen(event, handler, {
    target: { kind: "Window", label: getWindowContext().label },
  });
}
